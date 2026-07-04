package postgres

import (
	"context"
	"errors"
	"fmt"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/TrollLOLik/sutki/backend/internal/domain"
)

// EmailPrefsRepo implements domain.EmailPreferencesRepository on the
// email_preferences table. A missing row means "all enabled" so users get
// notifications without any setup step.
type EmailPrefsRepo struct {
	pool *pgxpool.Pool
}

func NewEmailPrefsRepo(pool *pgxpool.Pool) *EmailPrefsRepo {
	return &EmailPrefsRepo{pool: pool}
}

var _ domain.EmailPreferencesRepository = (*EmailPrefsRepo)(nil)

func (r *EmailPrefsRepo) Get(ctx context.Context, userID int32) (domain.EmailPreferences, error) {
	const q = `
SELECT user_id, booking, chat_digest, reviews
FROM email_preferences
WHERE user_id = $1`
	p := domain.EmailPreferences{UserID: userID, Booking: true, ChatDigest: true, Reviews: true}
	err := r.pool.QueryRow(ctx, q, userID).Scan(&p.UserID, &p.Booking, &p.ChatDigest, &p.Reviews)
	if errors.Is(err, pgx.ErrNoRows) {
		return p, nil // default: everything enabled
	}
	if err != nil {
		return domain.EmailPreferences{}, fmt.Errorf("email prefs get: %w", err)
	}
	return p, nil
}

func (r *EmailPrefsRepo) Update(ctx context.Context, p domain.EmailPreferences) error {
	const q = `
INSERT INTO email_preferences (user_id, booking, chat_digest, reviews, updated_at)
VALUES ($1, $2, $3, $4, now())
ON CONFLICT (user_id) DO UPDATE
SET booking = EXCLUDED.booking,
    chat_digest = EXCLUDED.chat_digest,
    reviews = EXCLUDED.reviews,
    updated_at = now()`
	if _, err := r.pool.Exec(ctx, q, p.UserID, p.Booking, p.ChatDigest, p.Reviews); err != nil {
		return fmt.Errorf("email prefs update: %w", err)
	}
	return nil
}

func (r *EmailPrefsRepo) SetCategory(ctx context.Context, userID int32, cat domain.EmailCategory, enabled bool) error {
	// The column name is interpolated from a closed set of constants, never
	// from user input; the switch below is the whitelist.
	var col string
	switch cat {
	case domain.EmailCategoryBooking:
		col = "booking"
	case domain.EmailCategoryChatDigest:
		col = "chat_digest"
	case domain.EmailCategoryReviews:
		col = "reviews"
	default:
		return fmt.Errorf("unknown email category %q", cat)
	}
	q := fmt.Sprintf(`
INSERT INTO email_preferences (user_id, %[1]s, updated_at)
VALUES ($1, $2, now())
ON CONFLICT (user_id) DO UPDATE
SET %[1]s = EXCLUDED.%[1]s, updated_at = now()`, col)
	if _, err := r.pool.Exec(ctx, q, userID, enabled); err != nil {
		return fmt.Errorf("email prefs set %s: %w", col, err)
	}
	return nil
}
