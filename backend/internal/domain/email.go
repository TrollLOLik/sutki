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

	// NotifyBookingCancelled tells the listing owner the tenant cancelled a
	// pending request. Gated by the owner's "booking" email preference.
	// Deduplicated per booking id.
	NotifyBookingCancelled(ctx context.Context, ownerID int32, ownerEmail string, b Booking) error

	// NotifyChatMessage tells a user someone wrote to them while they were
	// away. Gated by the recipient's "chat_digest" preference and
	// deduplicated per conversation within a quiet window, so a burst of
	// messages produces at most one email per window. The message body is
	// never included.
	NotifyChatMessage(ctx context.Context, recipientID int32, recipientEmail, senderName string, convID int64) error

	// SendWelcome greets a newly registered user. Deduplicated per user id,
	// so at-most-one welcome email is ever sent to an account.
	SendWelcome(ctx context.Context, userID int32, email string) error

	// NotifyReviewReceived tells a listing owner a new review was published.
	// Gated by the owner's "reviews" preference. The review body is not
	// included, only the rating. Deduplicated per review id.
	NotifyReviewReceived(ctx context.Context, ownerID int32, ownerEmail string, reviewID int64, rating int32, address string) error

	// NotifyReviewModerated tells an author whether their review or owner reply
	// was published, rejected, or held for an additional check. Gated by the
	// author's "reviews" preference and deduplicated per moderation outcome.
	NotifyReviewModerated(ctx context.Context, authorID int32, authorEmail string, reviewID int64, status, targetType, reason string) error
}

// EmailCategory names an opt-outable group of notifications. Values are
// stable: they appear in unsubscribe links.
type EmailCategory string

const (
	EmailCategoryBooking    EmailCategory = "booking"
	EmailCategoryChatDigest EmailCategory = "chat_digest"
	EmailCategoryReviews    EmailCategory = "reviews"
)

// EmailPreferences holds a user's per-category opt-outs. The zero row (no DB
// record) means everything enabled, matching the table defaults.
type EmailPreferences struct {
	UserID     int32
	Booking    bool
	ChatDigest bool
	Reviews    bool
}

// EmailPreferencesRepository persists per-user email opt-outs.
type EmailPreferencesRepository interface {
	// Get returns the user's preferences, or the all-enabled default when no
	// row exists.
	Get(ctx context.Context, userID int32) (EmailPreferences, error)
	// Update upserts the full preference set for the user.
	Update(ctx context.Context, p EmailPreferences) error
	// SetCategory flips a single category (used by unsubscribe links).
	SetCategory(ctx context.Context, userID int32, cat EmailCategory, enabled bool) error
}
