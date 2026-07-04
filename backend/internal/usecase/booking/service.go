package booking

import (
	"context"
	"log"
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
	// Notifier queues booking status emails. May be nil in tests; sends are
	// then skipped.
	Notifier   domain.EmailNotifier
	ExposeCode bool
}

// Service implements booking (rental request) use cases.
type Service struct {
	repo       domain.BookingRepository
	notifier   domain.EmailNotifier
	exposeCode bool
}

func New(repo domain.BookingRepository, cfg Config) *Service {
	return &Service{
		repo:       repo,
		notifier:   cfg.Notifier,
		exposeCode: cfg.ExposeCode,
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
	ownerID, status, ownerEmail, err := s.repo.GetHouseForBooking(ctx, b.HouseID)
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
	created, err := s.repo.Create(ctx, b)
	if err != nil {
		return domain.Booking{}, err
	}

	// Notify the listing owner about the new request. Guest bookings start
	// as pending_verification (the email is not confirmed yet), so the owner
	// is only notified once the request is genuinely pending. Queueing
	// failures are logged, never surfaced: the booking itself succeeded.
	if s.notifier != nil && created.Status == domain.BookingPending {
		s.notifyOwnerOfNewRequest(ctx, created, ownerEmail)
	}
	return created, nil
}

// notifyOwnerOfNewRequest enqueues the "new booking request" email for the
// listing owner. The create result carries no house summary, so the booking
// is re-read to include the address in the email; if that lookup fails the
// email is still sent with degraded copy.
func (s *Service) notifyOwnerOfNewRequest(ctx context.Context, created domain.Booking, ownerEmail string) {
	withHouse, err := s.repo.GetByID(ctx, created.ID)
	if err != nil {
		log.Printf("booking notify: reload booking %d for owner email: %v", created.ID, err)
		withHouse = created
	}
	if err := s.notifier.NotifyBookingRequested(ctx, ownerEmail, withHouse); err != nil {
		log.Printf("booking notify: queue owner email for booking %d: %v", created.ID, err)
	}
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

	if s.notifier != nil && updated.Email != "" {
		if err := s.notifier.NotifyBookingConfirmed(ctx, updated); err != nil {
			log.Printf("booking notify: queue confirmed email for booking %d: %v", updated.ID, err)
		}
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

	if s.notifier != nil && updated.Email != "" {
		if err := s.notifier.NotifyBookingRejected(ctx, updated, reason); err != nil {
			log.Printf("booking notify: queue rejected email for booking %d: %v", updated.ID, err)
		}
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

	// Notify the owner only when the request was genuinely pending: for
	// pending_verification the owner never learned about the request, so a
	// cancellation email would only confuse them. Opt-outable via the
	// owner's "booking" preference inside the notifier.
	if s.notifier != nil && b.Status == domain.BookingPending {
		ownerID, _, ownerEmail, err := s.repo.GetHouseForBooking(ctx, b.HouseID)
		if err != nil {
			log.Printf("booking notify: owner lookup for cancelled booking %d: %v", updated.ID, err)
		} else if err := s.notifier.NotifyBookingCancelled(ctx, ownerID, ownerEmail, updated); err != nil {
			log.Printf("booking notify: queue cancelled email for booking %d: %v", updated.ID, err)
		}
	}
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

