package email

import (
	"context"
	"fmt"
	"log"
	"strings"
	"time"

	"github.com/TrollLOLik/sutki/backend/internal/domain"
)

// Notifier implements domain.EmailNotifier on top of the durable Mailer.
// It renders templates, assigns dedup keys, and skips silently when SMTP is
// not configured (dev environments), mirroring the previous inline behavior.
type Notifier struct {
	mailer   *Mailer
	renderer *renderer
}

// NewNotifier fails only on template parse errors, i.e. at startup.
func NewNotifier(mailer *Mailer) (*Notifier, error) {
	r, err := newRenderer()
	if err != nil {
		return nil, err
	}
	return &Notifier{mailer: mailer, renderer: r}, nil
}

var _ domain.EmailNotifier = (*Notifier)(nil)

func (n *Notifier) SendLoginCode(ctx context.Context, email, code string, ttl time.Duration) error {
	data := struct {
		Code       string
		TTLMinutes int
	}{Code: code, TTLMinutes: int(ttl.Minutes())}

	return n.enqueue(ctx, OutboxMessage{
		// No dedup key: codes are intentionally repeatable (cooldown is
		// enforced by the auth service, not the outbox).
		Recipient: email,
		EventType: EventOTPCode,
		Subject:   "Код подтверждения для приложения Дом Рядом",
	}, data)
}

func (n *Notifier) NotifyBookingRequested(ctx context.Context, ownerEmail string, b domain.Booking) error {
	data := struct {
		Address     string
		GuestName   string
		Dates       string
		GuestsCount int32
	}{
		Address:     bookingAddress(b),
		GuestName:   guestName(b),
		Dates:       bookingDates(b),
		GuestsCount: b.Count,
	}

	return n.enqueue(ctx, OutboxMessage{
		DedupKey:  fmt.Sprintf("%s:%d", EventBookingNew, b.ID),
		Recipient: ownerEmail,
		EventType: EventBookingNew,
		Subject:   "Новая заявка на бронирование — Дом Рядом",
	}, data)
}

func (n *Notifier) NotifyBookingConfirmed(ctx context.Context, b domain.Booking) error {
	data := struct {
		Address string
		Dates   string
	}{Address: bookingAddress(b), Dates: bookingDates(b)}

	return n.enqueue(ctx, OutboxMessage{
		DedupKey:  fmt.Sprintf("%s:%d", EventBookingConfirmed, b.ID),
		UserID:    b.UserID,
		Recipient: b.Email,
		EventType: EventBookingConfirmed,
		Subject:   "Ваша заявка на бронирование подтверждена!",
	}, data)
}

func (n *Notifier) NotifyBookingRejected(ctx context.Context, b domain.Booking, reason string) error {
	data := struct {
		Address string
		Dates   string
		Reason  string
	}{Address: bookingAddress(b), Dates: bookingDates(b), Reason: reason}

	return n.enqueue(ctx, OutboxMessage{
		DedupKey:  fmt.Sprintf("%s:%d", EventBookingRejected, b.ID),
		UserID:    b.UserID,
		Recipient: b.Email,
		EventType: EventBookingRejected,
		Subject:   "Ваша заявка на бронирование отклонена",
	}, data)
}

// enqueue renders the event and persists it into the outbox. All EmailNotifier
// methods funnel through here so skip/log behavior stays consistent.
func (n *Notifier) enqueue(ctx context.Context, msg OutboxMessage, data any) error {
	if msg.Recipient == "" {
		return nil // guest bookings may have no email; nothing to send
	}
	if !n.mailer.Configured() {
		log.Printf("email: SMTP not configured, skipping %s to %s",
			msg.EventType, domain.MaskEmail(msg.Recipient))
		return nil
	}

	textBody, htmlBody, err := n.renderer.render(msg.EventType, data)
	if err != nil {
		return err
	}
	msg.BodyText = textBody
	msg.BodyHTML = htmlBody

	inserted, err := n.mailer.Enqueue(ctx, msg)
	if err != nil {
		return fmt.Errorf("enqueue %s: %w", msg.EventType, err)
	}
	if !inserted {
		log.Printf("email: %s to %s already queued/sent (dedup), skipping",
			msg.EventType, domain.MaskEmail(msg.Recipient))
	}
	return nil
}

// bookingAddress renders the listing address for email copy, degrading
// gracefully when the house summary is missing.
func bookingAddress(b domain.Booking) string {
	if b.House == nil {
		return "из вашей заявки"
	}
	parts := make([]string, 0, 3)
	if b.House.City != "" {
		parts = append(parts, b.House.City)
	}
	street := strings.TrimSpace(b.House.Street + " " + b.House.HouseNumber)
	if street != "" {
		parts = append(parts, street)
	}
	if len(parts) == 0 {
		return "из вашей заявки"
	}
	return strings.Join(parts, ", ")
}

// bookingDates formats the stay range in Russian date notation.
func bookingDates(b domain.Booking) string {
	const layout = "02.01.2006"
	if b.StartDate.IsZero() {
		return ""
	}
	if b.EndDate == nil {
		return b.StartDate.Format(layout)
	}
	return b.StartDate.Format(layout) + " — " + b.EndDate.Format(layout)
}

// guestName builds a display name for the booking author without leaking
// more personal data than the owner already sees in the app.
func guestName(b domain.Booking) string {
	name := strings.TrimSpace(strings.TrimSpace(b.Name) + " " + strings.TrimSpace(b.Surname))
	if name == "" {
		return "Гость"
	}
	return name
}
