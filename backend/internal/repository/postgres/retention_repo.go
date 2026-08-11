package postgres

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/TrollLOLik/sutki/backend/internal/domain"
)

type RetentionRepo struct {
	pool *pgxpool.Pool
}

func NewRetentionRepo(pool *pgxpool.Pool) *RetentionRepo {
	return &RetentionRepo{pool: pool}
}

func (r *RetentionRepo) ExpiredChatObjectKeys(ctx context.Context, cutoff time.Time) ([]string, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT DISTINCT ma.upload_key
		FROM message_attachment ma
		JOIN message m ON m.id = ma.message_id
		WHERE m.created_at < $1 AND ma.upload_key IS NOT NULL`, cutoff)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	keys := make([]string, 0)
	for rows.Next() {
		var key string
		if err := rows.Scan(&key); err != nil {
			return nil, err
		}
		keys = append(keys, key)
	}
	return keys, rows.Err()
}

func (r *RetentionRepo) ExpiredListingObjectKeys(ctx context.Context, cutoff time.Time) ([]string, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT DISTINCT f.path
		FROM file f
		JOIN house h ON h.id = f.house_id
		WHERE (h.deleted = true OR h.status IN ('unpublished', 'rejected'))
		  AND h.updated_at < $1 AND f.path LIKE 'listings/%'`, cutoff)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	keys := make([]string, 0)
	for rows.Next() {
		var key string
		if err := rows.Scan(&key); err != nil {
			return nil, err
		}
		keys = append(keys, key)
	}
	return keys, rows.Err()
}

func (r *RetentionRepo) RunRetention(ctx context.Context, now time.Time, deletedChatObjectKeys, deletedListingObjectKeys []string) (result domain.RetentionResult, err error) {
	result.Counts = make(map[string]int64)
	runID := int64(0)
	if err = r.pool.QueryRow(ctx, `INSERT INTO data_retention_run DEFAULT VALUES RETURNING id`).Scan(&runID); err != nil {
		return result, err
	}
	defer func() {
		status := "completed"
		var lastError any
		if err != nil {
			status = "failed"
			lastError = err.Error()
		}
		counts, _ := json.Marshal(result.Counts)
		_, _ = r.pool.Exec(context.Background(), `
			UPDATE data_retention_run
			SET finished_at = now(), status = $2, counters = $3::jsonb, error = $4
			WHERE id = $1`, runID, status, string(counts), lastError)
	}()

	tx, err := r.pool.BeginTx(ctx, pgx.TxOptions{})
	if err != nil {
		return result, err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	chatCutoff := now.AddDate(0, -6, 0)
	steps := []struct {
		name string
		sql  string
		args []any
	}{
		{"chat_attachments", `DELETE FROM message_attachment WHERE upload_key = ANY($1::text[])`, []any{deletedChatObjectKeys}},
		{"legacy_chat_attachments", `DELETE FROM message_attachment WHERE upload_key IS NULL AND message_id IN (SELECT id FROM message WHERE created_at < $1)`, []any{chatCutoff}},
		{"chat_upload_registry", `DELETE FROM chat_upload WHERE object_key = ANY($1::text[]) AND NOT EXISTS (SELECT 1 FROM message_attachment WHERE upload_key = chat_upload.object_key)`, []any{deletedChatObjectKeys}},
		{"chat_messages", `UPDATE message SET body = '', deleted_at = COALESCE(deleted_at, $2), edited_at = NULL WHERE created_at < $1 AND body <> ''`, []any{chatCutoff, now}},
		{"refresh_tokens", `DELETE FROM refresh_token WHERE COALESCE(revoked_at, expires_at) < $1`, []any{now.AddDate(-1, 0, 0)}},
		{"auth_codes", `DELETE FROM auth_code WHERE created_at < $1`, []any{now.AddDate(-1, 0, 0)}},
		{"phone_challenges", `DELETE FROM phone_auth_challenge WHERE created_at < $1`, []any{now.AddDate(-1, 0, 0)}},
		{"reauth_challenges", `DELETE FROM reauth_challenge WHERE created_at < $1`, []any{now.AddDate(-1, 0, 0)}},
		{"listing_views", `DELETE FROM listing_view_event WHERE created_at < $1`, []any{now.AddDate(-1, 0, 0)}},
		{"legal_consent_history", `DELETE FROM legal_consent WHERE revoked_at IS NOT NULL AND revoked_at < $1`, []any{now.AddDate(-3, 0, 0)}},
		{"personal_data_revocations", `DELETE FROM personal_data_revocation WHERE revoked_at < $1`, []any{now.AddDate(-3, 0, 0)}},
		{"booking_personal_data", `UPDATE request SET name = '', surname = '', lastname = '', message = NULL, phone = '', phone_normalized = NULL, email = NULL WHERE updated_at < $1 AND status IN ('completed','cancelled','rejected') AND (phone <> '' OR email IS NOT NULL OR message IS NOT NULL)`, []any{now.AddDate(-3, 0, 0)}},
		{"deleted_listing_personal_data", `UPDATE house SET deleted = true, status = 'unpublished', street = '', house_number = '', description = '', lat = NULL, lng = NULL, reviews_summary = NULL, location_summary = NULL WHERE (deleted = true OR status IN ('unpublished','rejected')) AND updated_at < $1 AND (street <> '' OR description <> '' OR deleted = false)`, []any{now.AddDate(-3, 0, 0)}},
		{"deleted_listing_files", `UPDATE file SET deleted = true, path = '', dir = NULL, name = '' WHERE path = ANY($1::text[])`, []any{deletedListingObjectKeys}},
		{"legacy_deleted_listing_files", `UPDATE file SET deleted = true, path = '', dir = NULL, name = '' WHERE house_id IN (SELECT id FROM house WHERE deleted = true AND updated_at < $1) AND path <> '' AND path NOT LIKE 'listings/%'`, []any{now.AddDate(-3, 0, 0)}},
		{"review_personal_data", `UPDATE review SET body = '', published_body = NULL, rejection_reason = NULL WHERE created_at < $1 AND house_id IN (SELECT id FROM house WHERE deleted = true) AND body <> ''`, []any{now.AddDate(-3, 0, 0)}},
		{"payment_webhook_payload", `UPDATE payment_webhook_event SET payload = '{}'::jsonb, last_error = NULL WHERE created_at < $1 AND (payload <> '{}'::jsonb OR last_error IS NOT NULL)`, []any{now.AddDate(-5, 0, 0)}},
		{"payment_receipt_personal_data", `UPDATE payment_receipt SET customer_contact_masked = NULL, payload = '{}'::jsonb WHERE created_at < $1 AND (customer_contact_masked IS NOT NULL OR payload <> '{}'::jsonb)`, []any{now.AddDate(-5, 0, 0)}},
		{"payment_personal_data", `UPDATE payment SET request_id = NULL, user_id = NULL, confirmation_url = NULL, description = NULL, metadata = '{}'::jsonb WHERE created_at < $1 AND (request_id IS NOT NULL OR user_id IS NOT NULL OR confirmation_url IS NOT NULL OR description IS NOT NULL OR metadata <> '{}'::jsonb)`, []any{now.AddDate(-5, 0, 0)}},
		{"payment_refund_personal_data", `UPDATE payment_refund SET initiated_by = NULL, reason = '' WHERE created_at < $1 AND (initiated_by IS NOT NULL OR reason <> '')`, []any{now.AddDate(-5, 0, 0)}},
	}
	for _, step := range steps {
		tag, execErr := tx.Exec(ctx, step.sql, step.args...)
		if execErr != nil {
			return result, fmt.Errorf("retention %s: %w", step.name, execErr)
		}
		result.Counts[step.name] = tag.RowsAffected()
	}
	if err = tx.Commit(ctx); err != nil {
		return result, err
	}
	return result, nil
}
