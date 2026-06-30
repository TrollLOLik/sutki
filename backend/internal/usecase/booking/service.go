package booking

import (
	"context"
	"crypto/tls"
	"fmt"
	"log"
	"mime"
	"net/mail"
	"net/smtp"
	"strings"
	"time"

	"github.com/TrollLOLik/sutki/backend/internal/domain"
)

const (
	defaultLimit int32 = 20
	maxLimit     int32 = 100
	// houseActive is the legacy `house.status` value for a published listing.
	houseActive = "active"
)

// Config tunes the booking service.
type Config struct {
	SMTPHost     string
	SMTPPort     int
	SMTPUsername string
	SMTPPassword string
	SMTPFrom     string
	ExposeCode   bool
}

// Service implements booking (rental request) use cases.
type Service struct {
	repo         domain.BookingRepository
	smtpHost     string
	smtpPort     int
	smtpUsername string
	smtpPassword string
	smtpFrom     string
	exposeCode   bool
}

func New(repo domain.BookingRepository, cfg Config) *Service {
	return &Service{
		repo:         repo,
		smtpHost:     cfg.SMTPHost,
		smtpPort:     cfg.SMTPPort,
		smtpUsername: cfg.SMTPUsername,
		smtpPassword: cfg.SMTPPassword,
		smtpFrom:     cfg.SMTPFrom,
		exposeCode:   cfg.ExposeCode,
	}
}

func (s *Service) ExposeCode() bool {
	return s.exposeCode
}

// ListResult is a page of bookings plus pagination metadata.
type ListResult struct {
	Items  []domain.Booking
	Total  int64
	Limit  int32
	Offset int32
}

func clamp(limit, offset int32) (int32, int32) {
	if limit <= 0 {
		limit = defaultLimit
	}
	if limit > maxLimit {
		limit = maxLimit
	}
	if offset < 0 {
		offset = 0
	}
	return limit, offset
}

// Create validates and creates a booking for b.UserID. The listing must exist
// and be active, and a user cannot book their own listing.
func (s *Service) Create(ctx context.Context, b domain.NewBooking) (domain.Booking, error) {
	ownerID, status, _, err := s.repo.GetHouseForBooking(ctx, b.HouseID)
	if err != nil {
		return domain.Booking{}, err
	}
	if status != houseActive {
		return domain.Booking{}, domain.ErrListingUnavailable
	}
	if b.UserID != 0 && ownerID == b.UserID {
		return domain.Booking{}, domain.ErrBookingOwnListing
	}
	// Reject requests that overlap an already-confirmed booking so users cannot
	// request dates that are taken.
	overlap, err := s.repo.HasConfirmedOverlap(ctx, b.HouseID, b.StartDate, b.EndDate)
	if err != nil {
		return domain.Booking{}, err
	}
	if overlap {
		return domain.Booking{}, domain.ErrDatesUnavailable
	}
	return s.repo.Create(ctx, b)
}

// BlockingRanges returns all non-terminal date ranges for a house so clients
// can separate BLOCK (confirmed, active) from WARN (in_progress, pending)
// ranges in the booking calendar. Public listing information.
func (s *Service) BlockingRanges(ctx context.Context, houseID int32) ([]domain.BookedRange, error) {
	return s.repo.BlockingRanges(ctx, houseID)
}

// Get returns a booking visible to actorID (its author or the listing owner) or guestID.
func (s *Service) Get(ctx context.Context, id, actorID int32, guestID string) (domain.Booking, error) {
	b, err := s.repo.GetByID(ctx, id)
	if err != nil {
		return domain.Booking{}, err
	}
	if actorID != 0 {
		if !canView(b, actorID) {
			return domain.Booking{}, domain.ErrBookingForbidden
		}
	} else if guestID != "" {
		if b.GuestID != guestID {
			return domain.Booking{}, domain.ErrBookingForbidden
		}
	} else {
		return domain.Booking{}, domain.ErrBookingForbidden
	}
	return b, nil
}

// ListMine returns bookings created by userID (as a tenant). scope selects the
// subset: "active" (pending or upcoming-confirmed), "history" (cancelled or
// past-confirmed), or "all" (default, backwards compatible).
func (s *Service) ListMine(ctx context.Context, userID, limit, offset int32, scope string) (ListResult, error) {
	limit, offset = clamp(limit, offset)
	scope = normalizeScope(scope)
	items, err := s.repo.ListByUser(ctx, userID, limit, offset, scope)
	if err != nil {
		return ListResult{}, err
	}
	total, err := s.repo.CountByUser(ctx, userID, scope)
	if err != nil {
		return ListResult{}, err
	}
	return ListResult{Items: items, Total: total, Limit: limit, Offset: offset}, nil
}

// ListGuest returns bookings created by guestID (as a guest tenant).
func (s *Service) ListGuest(ctx context.Context, guestID string, limit, offset int32) (ListResult, error) {
	limit, offset = clamp(limit, offset)
	items, err := s.repo.ListByGuest(ctx, guestID, limit, offset)
	if err != nil {
		return ListResult{}, err
	}
	total, err := s.repo.CountByGuest(ctx, guestID)
	if err != nil {
		return ListResult{}, err
	}
	return ListResult{Items: items, Total: total, Limit: limit, Offset: offset}, nil
}

// StartCleanupJob starts a background cleaner to delete expired pending guest requests.
func (s *Service) StartCleanupJob(ctx context.Context, interval time.Duration) {
	go func() {
		ticker := time.NewTicker(interval)
		defer ticker.Stop()
		for {
			select {
			case <-ctx.Done():
				return
			case <-ticker.C:
				before := time.Now().Add(-24 * time.Hour)
				if err := s.repo.DeleteExpiredPendingRequests(ctx, before); err != nil {
					log.Printf("booking cleanup job error: %v", err)
				}
			}
		}
	}()
}

// normalizeScope maps an incoming scope value onto the three supported values,
// defaulting unknown/empty input to "all".
func normalizeScope(scope string) string {
	switch scope {
	case "active", "history":
		return scope
	default:
		return "all"
	}
}

// ListIncoming returns bookings on listings owned by ownerID.
func (s *Service) ListIncoming(ctx context.Context, ownerID, limit, offset int32) (ListResult, error) {
	limit, offset = clamp(limit, offset)
	items, err := s.repo.ListForOwner(ctx, ownerID, limit, offset)
	if err != nil {
		return ListResult{}, err
	}
	total, err := s.repo.CountForOwner(ctx, ownerID)
	if err != nil {
		return ListResult{}, err
	}
	return ListResult{Items: items, Total: total, Limit: limit, Offset: offset}, nil
}

// Confirm transitions a pending booking to confirmed. Only the listing owner
// may confirm, and only while the booking is pending.
func (s *Service) Confirm(ctx context.Context, id, ownerID int32) (domain.Booking, error) {
	b, err := s.requireOwnerPending(ctx, id, ownerID)
	if err != nil {
		return domain.Booking{}, err
	}
	updated, err := s.repo.Confirm(ctx, id)
	if err != nil {
		return domain.Booking{}, err
	}
	updated.House = b.House

	if updated.Email != "" && s.smtpUsername != "" && s.smtpPassword != "" {
		go func() {
			defer func() {
				if r := recover(); r != nil {
					log.Printf("booking notify panic recovered: %v", r)
				}
			}()
			subject := "Ваша заявка на бронирование подтверждена!"
			body := fmt.Sprintf("Здравствуйте!\nВаша заявка на бронирование жилья по адресу %s %s подтверждена владельцем.\nПриятного отдыха!", updated.House.Street, updated.House.HouseNumber)
			err := sendEmail(s.smtpHost, s.smtpPort, s.smtpUsername, s.smtpPassword, s.smtpFrom, updated.Email, subject, body)
			if err != nil {
				log.Printf("booking notify: failed to send email to %s: %v", updated.Email, err)
			}
		}()
	}

	return updated, nil
}

// Reject transitions a pending booking to cancelled with a reason. Only the
// listing owner may reject, and only while the booking is pending.
func (s *Service) Reject(ctx context.Context, id, ownerID int32, reason string) (domain.Booking, error) {
	b, err := s.requireOwnerPending(ctx, id, ownerID)
	if err != nil {
		return domain.Booking{}, err
	}
	updated, err := s.repo.Reject(ctx, id, reason)
	if err != nil {
		return domain.Booking{}, err
	}
	updated.House = b.House

	if updated.Email != "" && s.smtpUsername != "" && s.smtpPassword != "" {
		go func() {
			defer func() {
				if r := recover(); r != nil {
					log.Printf("booking notify panic recovered: %v", r)
				}
			}()
			subject := "Ваша заявка на бронирование отклонена"
			body := fmt.Sprintf("Здравствуйте!\nВаша заявка на бронирование жилья по адресу %s %s была отклонена владельцем.\n", updated.House.Street, updated.House.HouseNumber)
			if reason != "" {
				body += fmt.Sprintf("Причина отклонения: %s\n", reason)
			}
			err := sendEmail(s.smtpHost, s.smtpPort, s.smtpUsername, s.smtpPassword, s.smtpFrom, updated.Email, subject, body)
			if err != nil {
				log.Printf("booking notify: failed to send email to %s: %v", updated.Email, err)
			}
		}()
	}

	return updated, nil
}

// Cancel transitions a pending booking to cancelled. Only the tenant who
// created the booking may cancel, and only while it is pending.
func (s *Service) Cancel(ctx context.Context, id, userID int32, guestID string) (domain.Booking, error) {
	b, err := s.repo.GetByID(ctx, id)
	if err != nil {
		return domain.Booking{}, err
	}
	if userID != 0 {
		if b.UserID != userID {
			return domain.Booking{}, domain.ErrBookingForbidden
		}
	} else if guestID != "" {
		if b.GuestID != guestID {
			return domain.Booking{}, domain.ErrBookingForbidden
		}
	} else {
		return domain.Booking{}, domain.ErrBookingForbidden
	}

	if b.Status != domain.BookingPending && b.Status != domain.BookingPendingVerification {
		return domain.Booking{}, domain.ErrBookingNotPending
	}
	updated, err := s.repo.Cancel(ctx, id)
	if err != nil {
		return domain.Booking{}, err
	}
	updated.House = b.House
	return updated, nil
}

func (s *Service) requireOwnerPending(ctx context.Context, id, ownerID int32) (domain.Booking, error) {
	b, err := s.repo.GetByID(ctx, id)
	if err != nil {
		return domain.Booking{}, err
	}
	if b.House == nil || b.House.OwnerID != ownerID {
		return domain.Booking{}, domain.ErrBookingForbidden
	}
	if b.Status != domain.BookingPending {
		return domain.Booking{}, domain.ErrBookingNotPending
	}
	return b, nil
}

func canView(b domain.Booking, actorID int32) bool {
	if b.UserID == actorID {
		return true
	}
	return b.House != nil && b.House.OwnerID == actorID
}

func sendEmail(host string, port int, username, password, from, to, subject, body string) error {
	addr := fmt.Sprintf("%s:%d", host, port)
	tlsConfig := &tls.Config{
		InsecureSkipVerify: false,
		ServerName:         host,
	}
	conn, err := tls.Dial("tcp", addr, tlsConfig)
	if err != nil {
		return fmt.Errorf("tls dial: %w", err)
	}
	defer conn.Close()

	client, err := smtp.NewClient(conn, host)
	if err != nil {
		return fmt.Errorf("smtp client: %w", err)
	}
	defer client.Close()

	auth := smtp.PlainAuth("", username, password, host)
	if err = client.Auth(auth); err != nil {
		return fmt.Errorf("auth: %w", err)
	}

	fromCleaned := strings.TrimSpace(from)
	if len(fromCleaned) >= 2 && fromCleaned[0] == '\'' && fromCleaned[len(fromCleaned)-1] == '\'' {
		fromCleaned = fromCleaned[1 : len(fromCleaned)-1]
	}
	fromCleaned = strings.TrimSpace(fromCleaned)

	fromParsed, err := mail.ParseAddress(fromCleaned)
	if err != nil {
		return fmt.Errorf("parse sender address: %w", err)
	}

	if err = client.Mail(fromParsed.Address); err != nil {
		return fmt.Errorf("mail: %w", err)
	}
	if err = client.Rcpt(to); err != nil {
		return fmt.Errorf("rcpt: %w", err)
	}

	writer, err := client.Data()
	if err != nil {
		return fmt.Errorf("data: %w", err)
	}
	defer writer.Close()

	var fromHeader string
	if fromParsed.Name != "" {
		fromHeader = fmt.Sprintf("%s <%s>", mime.BEncoding.Encode("utf-8", fromParsed.Name), fromParsed.Address)
	} else {
		fromHeader = fromParsed.Address
	}
	subjectHeader := mime.BEncoding.Encode("utf-8", subject)

	msg := fmt.Sprintf("From: %s\r\nTo: %s\r\nSubject: %s\r\nContent-Type: text/plain; charset=UTF-8\r\n\r\n%s", fromHeader, to, subjectHeader, body)
	if _, err = writer.Write([]byte(msg)); err != nil {
		return fmt.Errorf("write: %w", err)
	}

	return nil
}
