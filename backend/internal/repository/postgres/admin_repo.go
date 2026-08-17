package postgres

import (
	"context"
	"encoding/json"
	"errors"
	"strconv"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/TrollLOLik/sutki/backend/internal/domain"
)

type AdminRepo struct {
	pool *pgxpool.Pool
}

func NewAdminRepo(pool *pgxpool.Pool) *AdminRepo {
	return &AdminRepo{pool: pool}
}

func (r *AdminRepo) FindAccountByEmail(ctx context.Context, email string) (domain.AdminAccount, error) {
	var out domain.AdminAccount
	err := r.pool.QueryRow(ctx, `
		SELECT a.id, a.user_id, COALESCE(u.email, ''),
		       COALESCE(NULLIF(trim(concat_ws(' ', u.name, u.surname)), ''), u.email, 'Администратор'),
		       a.role, a.enabled, a.created_at
		FROM admin_account a
		JOIN "user" u ON u.id = a.user_id
		WHERE lower(u.email) = lower($1)
		  AND u.deleted = false`, email).Scan(
		&out.ID,
		&out.UserID,
		&out.Email,
		&out.Name,
		&out.Role,
		&out.Enabled,
		&out.CreatedAt,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return domain.AdminAccount{}, domain.ErrNotFound
	}
	return out, err
}

func (r *AdminRepo) CreateSession(ctx context.Context, session domain.AdminSession, audit domain.AdminAuditEntry) (domain.AdminSession, error) {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return domain.AdminSession{}, err
	}
	defer tx.Rollback(ctx)

	err = tx.QueryRow(ctx, `
		INSERT INTO admin_session (
		  admin_account_id, token_hash, csrf_token_hash, ip_address,
		  user_agent, created_at, last_active_at, expires_at
		)
		VALUES ($1, $2, $3, NULLIF($4, '')::inet, NULLIF($5, ''), $6, $6, $7)
		RETURNING id, created_at, last_active_at`,
		session.AdminAccountID,
		session.TokenHash,
		session.CSRFTokenHash,
		session.IPAddress,
		session.UserAgent,
		session.CreatedAt,
		session.ExpiresAt,
	).Scan(&session.ID, &session.CreatedAt, &session.LastActiveAt)
	if err != nil {
		return domain.AdminSession{}, err
	}

	if _, err := tx.Exec(ctx, `
		UPDATE admin_account
		SET last_login_at = $2, updated_at = $2
		WHERE id = $1 AND enabled = true`, session.AdminAccountID, session.CreatedAt); err != nil {
		return domain.AdminSession{}, err
	}

	audit.ActorAdminID = session.AdminAccountID
	audit.TargetType = "admin_session"
	audit.TargetID = formatInt64(session.ID)
	if err := insertAdminAudit(ctx, tx, audit); err != nil {
		return domain.AdminSession{}, err
	}

	if err := tx.Commit(ctx); err != nil {
		return domain.AdminSession{}, err
	}
	return session, nil
}

func (r *AdminRepo) GetAndTouchSession(ctx context.Context, tokenHash []byte, now, activeAfter time.Time) (domain.AdminSession, error) {
	var out domain.AdminSession
	err := r.pool.QueryRow(ctx, `
		UPDATE admin_session s
		SET last_active_at = $2
		FROM admin_account a
		JOIN "user" u ON u.id = a.user_id
		WHERE s.token_hash = $1
		  AND s.admin_account_id = a.id
		  AND s.revoked_at IS NULL
		  AND s.expires_at > $2
		  AND s.last_active_at >= $3
		  AND a.enabled = true
		  AND u.deleted = false
		RETURNING s.id, s.admin_account_id, s.csrf_token_hash,
		          COALESCE(host(s.ip_address), ''), COALESCE(s.user_agent, ''),
		          s.created_at, s.last_active_at, s.expires_at,
		          a.id, a.user_id, COALESCE(u.email, ''),
		          COALESCE(NULLIF(trim(concat_ws(' ', u.name, u.surname)), ''), u.email, 'Администратор'),
		          a.role, a.enabled, a.created_at`, tokenHash, now, activeAfter).Scan(
		&out.ID,
		&out.AdminAccountID,
		&out.CSRFTokenHash,
		&out.IPAddress,
		&out.UserAgent,
		&out.CreatedAt,
		&out.LastActiveAt,
		&out.ExpiresAt,
		&out.Account.ID,
		&out.Account.UserID,
		&out.Account.Email,
		&out.Account.Name,
		&out.Account.Role,
		&out.Account.Enabled,
		&out.Account.CreatedAt,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return domain.AdminSession{}, domain.ErrNotFound
	}
	return out, err
}

func (r *AdminRepo) RevokeSession(ctx context.Context, tokenHash []byte, audit domain.AdminAuditEntry) error {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	var sessionID, adminID int64
	err = tx.QueryRow(ctx, `
		UPDATE admin_session
		SET revoked_at = now()
		WHERE token_hash = $1 AND revoked_at IS NULL
		RETURNING id, admin_account_id`, tokenHash).Scan(&sessionID, &adminID)
	if errors.Is(err, pgx.ErrNoRows) {
		return domain.ErrNotFound
	}
	if err != nil {
		return err
	}

	audit.ActorAdminID = adminID
	audit.TargetType = "admin_session"
	audit.TargetID = formatInt64(sessionID)
	if err := insertAdminAudit(ctx, tx, audit); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

func (r *AdminRepo) AppendAudit(ctx context.Context, entry domain.AdminAuditEntry) error {
	return insertAdminAudit(ctx, r.pool, entry)
}

type adminAuditQueryer interface {
	QueryRow(context.Context, string, ...any) pgx.Row
}

func insertAdminAudit(ctx context.Context, q adminAuditQueryer, entry domain.AdminAuditEntry) error {
	metadata := entry.Metadata
	if len(metadata) == 0 || !json.Valid(metadata) {
		metadata = json.RawMessage(`{}`)
	}
	createdAt := entry.CreatedAt
	if createdAt.IsZero() {
		createdAt = time.Now().UTC()
	}
	var id int64
	return q.QueryRow(ctx, `
		INSERT INTO admin_audit_log (
		  actor_admin_id, action, target_type, target_id, reason, metadata,
		  ip_address, user_agent, created_at
		)
		VALUES (
		  $1, $2, NULLIF($3, ''), NULLIF($4, ''), NULLIF($5, ''), $6::jsonb,
		  NULLIF($7, '')::inet, NULLIF($8, ''), $9
		)
		RETURNING id`,
		entry.ActorAdminID,
		entry.Action,
		entry.TargetType,
		entry.TargetID,
		entry.Reason,
		string(metadata),
		entry.IPAddress,
		entry.UserAgent,
		createdAt,
	).Scan(&id)
}

func formatInt64(value int64) string {
	return strconv.FormatInt(value, 10)
}
