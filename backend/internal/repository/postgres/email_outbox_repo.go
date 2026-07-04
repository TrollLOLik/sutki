package postgres

import (
	"context"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/TrollLOLik/sutki/backend/internal/infrastructure/email"
)

// EmailOutboxRepo implements email.OutboxRepository against the email_outbox
// table. It uses the pool directly (not sqlc) because the queue's queries are
// simple and self-contained; migrate to sqlc alongside the next regeneration
// if desired.
type EmailOutboxRepo struct {
	pool *pgxpool.Pool
}

func NewEmailOutboxRepo(pool *pgxpool.Pool) *EmailOutboxRepo {
	return &EmailOutboxRepo{pool: pool}
}

var _ email.OutboxRepository = (*EmailOutboxRepo)(nil)

// Enqueue inserts a queued message. A duplicate dedup_key is not an error:
// it means the notification is already queued or sent, so we report
// inserted=false and the caller skips. NULL dedup keys (login codes) never
// conflict.
func (r *EmailOutboxRepo) Enqueue(ctx context.Context, msg email.OutboxMessage) (bool, error) {
	var dedupKey *string
	if msg.DedupKey != "" {
		dedupKey = &msg.DedupKey
	}
	var userID *int32
	if msg.UserID != 0 {
		userID = &msg.UserID
	}

	tag, err := r.pool.Exec(ctx, `
		INSERT INTO email_outbox (dedup_key, user_id, recipient, event_type, subject, body_text, body_html)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
		ON CONFLICT (dedup_key) DO NOTHING
	`, dedupKey, userID, msg.Recipient, msg.EventType, msg.Subject, msg.BodyText, msg.BodyHTML)
	if err != nil {
		return false, err
	}
	return tag.RowsAffected() > 0, nil
}

// DueBatch loads the oldest queued rows whose retry time has passed.
func (r *EmailOutboxRepo) DueBatch(ctx context.Context, limit int32) ([]email.OutboxItem, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT id, recipient, event_type, subject,
		       COALESCE(body_text, ''), COALESCE(body_html, ''), attempts
		FROM email_outbox
		WHERE status = 'queued' AND next_attempt_at <= now()
		ORDER BY id
		LIMIT $1
	`, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var items []email.OutboxItem
	for rows.Next() {
		var it email.OutboxItem
		if err := rows.Scan(&it.ID, &it.Recipient, &it.EventType, &it.Subject,
			&it.BodyText, &it.BodyHTML, &it.Attempts); err != nil {
			return nil, err
		}
		items = append(items, it)
	}
	return items, rows.Err()
}

// MarkSent finalizes a delivery and clears the bodies so plaintext login
// codes and personal data do not linger in the table.
func (r *EmailOutboxRepo) MarkSent(ctx context.Context, id int64) error {
	_, err := r.pool.Exec(ctx, `
		UPDATE email_outbox
		SET status = 'sent', sent_at = now(), attempts = attempts + 1,
		    last_error = NULL, body_text = NULL, body_html = NULL
		WHERE id = $1
	`, id)
	return err
}

// MarkRetry schedules another attempt after a transient failure.
func (r *EmailOutboxRepo) MarkRetry(ctx context.Context, id int64, lastError string, nextAttemptAt time.Time) error {
	_, err := r.pool.Exec(ctx, `
		UPDATE email_outbox
		SET attempts = attempts + 1, last_error = $2, next_attempt_at = $3
		WHERE id = $1
	`, id, truncateError(lastError), nextAttemptAt)
	return err
}

// MarkFailed gives up on a message; bodies are cleared for the same hygiene
// reasons as MarkSent, while last_error is kept for diagnostics.
func (r *EmailOutboxRepo) MarkFailed(ctx context.Context, id int64, lastError string) error {
	_, err := r.pool.Exec(ctx, `
		UPDATE email_outbox
		SET status = 'failed', attempts = attempts + 1, last_error = $2,
		    body_text = NULL, body_html = NULL
		WHERE id = $1
	`, id, truncateError(lastError))
	return err
}

// Prune deletes terminal rows older than the cutoff.
func (r *EmailOutboxRepo) Prune(ctx context.Context, before time.Time) (int64, error) {
	tag, err := r.pool.Exec(ctx, `
		DELETE FROM email_outbox
		WHERE status IN ('sent', 'failed') AND created_at < $1
	`, before)
	if err != nil {
		return 0, err
	}
	return tag.RowsAffected(), nil
}

// truncateError bounds stored error text so a pathological SMTP response
// cannot bloat the table.
func truncateError(s string) string {
	const max = 500
	if len(s) <= max {
		return s
	}
	return s[:max]
}
