package domain

import (
	"context"
	"time"
)

// EmailNotifier enqueues application emails for asynchronous delivery.
//
// Implementations must be non-blocking with respect to SMTP: methods persist
// the message into a durable outbox and return, so callers on the HTTP path
// never wait on a mail server. A returned error means the message could not
// be queued (e.g. DB failure); callers should log it and continue, because
// email delivery is never allowed to fail the business operation.
//
// All methods are transactional notifications (auth codes, booking status),
// so they are not subject to marketing preferences and are also sent to
// guest bookers who have no user account (user_id is unknown/zero).
type EmailNotifier interface {
	// SendLoginCode emails a one-time login/verification code. Codes are
	// repeatable per email (subject to the caller's cooldown), so this is
	// never deduplicated.
	SendLoginCode(ctx context.Context, email, code string, ttl time.Duration) error

	// NotifyBookingRequested tells the listing owner a new booking request
	// was created. Deduplicated per booking id.
	NotifyBookingRequested(ctx context.Context, ownerEmail string, b Booking) error

	// NotifyBookingConfirmed tells the tenant their request was confirmed.
	// Deduplicated per booking id.
	NotifyBookingConfirmed(ctx context.Context, b Booking) error

	// NotifyBookingRejected tells the tenant their request was rejected,
	// optionally with a reason. Deduplicated per booking id.
	NotifyBookingRejected(ctx context.Context, b Booking, reason string) error
}
