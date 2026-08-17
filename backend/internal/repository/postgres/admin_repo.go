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

func (r *AdminRepo) ListAdminAccounts(ctx context.Context) ([]domain.AdminAccount, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT a.id, a.user_id, COALESCE(u.email, ''),
		       COALESCE(NULLIF(trim(concat_ws(' ', u.name, u.surname)), ''), u.email, 'Администратор'),
		       a.role, a.enabled, a.created_at, a.updated_at, a.last_login_at
		FROM admin_account a
		JOIN "user" u ON u.id = a.user_id
		ORDER BY a.enabled DESC,
		         CASE a.role WHEN 'owner' THEN 1 WHEN 'moderator' THEN 2 ELSE 3 END,
		         lower(COALESCE(u.email, '')), a.id`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	accounts := make([]domain.AdminAccount, 0)
	for rows.Next() {
		var account domain.AdminAccount
		if err := rows.Scan(
			&account.ID,
			&account.UserID,
			&account.Email,
			&account.Name,
			&account.Role,
			&account.Enabled,
			&account.CreatedAt,
			&account.UpdatedAt,
			&account.LastLoginAt,
		); err != nil {
			return nil, err
		}
		accounts = append(accounts, account)
	}
	return accounts, rows.Err()
}

func (r *AdminRepo) CreateAdminAccount(ctx context.Context, change domain.AdminStaffChange) (domain.AdminAccount, error) {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return domain.AdminAccount{}, err
	}
	defer tx.Rollback(ctx)

	var account domain.AdminAccount
	err = tx.QueryRow(ctx, `
		SELECT u.id, COALESCE(u.email, ''),
		       COALESCE(NULLIF(trim(concat_ws(' ', u.name, u.surname)), ''), u.email, 'Администратор')
		FROM "user" u
		WHERE lower(u.email) = lower($1)
		  AND u.deleted = false
		  AND u.enable = true
		FOR SHARE OF u`, change.Email).Scan(&account.UserID, &account.Email, &account.Name)
	if errors.Is(err, pgx.ErrNoRows) {
		return domain.AdminAccount{}, domain.ErrNotFound
	}
	if err != nil {
		return domain.AdminAccount{}, err
	}

	var exists bool
	if err := tx.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM admin_account WHERE user_id = $1)`, account.UserID).Scan(&exists); err != nil {
		return domain.AdminAccount{}, err
	}
	if exists {
		return domain.AdminAccount{}, domain.ErrAdminStaffConflict
	}

	err = tx.QueryRow(ctx, `
		INSERT INTO admin_account (user_id, role, enabled, created_at, updated_at)
		VALUES ($1, $2, true, $3, $3)
		ON CONFLICT (user_id) DO NOTHING
		RETURNING id, role, enabled, created_at, updated_at, last_login_at`,
		account.UserID, change.Role, change.CreatedAt,
	).Scan(
		&account.ID,
		&account.Role,
		&account.Enabled,
		&account.CreatedAt,
		&account.UpdatedAt,
		&account.LastLoginAt,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return domain.AdminAccount{}, domain.ErrAdminStaffConflict
	}
	if err != nil {
		return domain.AdminAccount{}, err
	}

	metadata, _ := json.Marshal(map[string]any{
		"email": account.Email,
		"role":  account.Role,
	})
	if err := insertAdminAudit(ctx, tx, domain.AdminAuditEntry{
		ActorAdminID: change.ActorAdminID,
		Action:       "admin.staff.create",
		TargetType:   "admin_account",
		TargetID:     formatInt64(account.ID),
		Metadata:     metadata,
		IPAddress:    change.IPAddress,
		UserAgent:    change.UserAgent,
		CreatedAt:    change.CreatedAt,
	}); err != nil {
		return domain.AdminAccount{}, err
	}

	if err := tx.Commit(ctx); err != nil {
		return domain.AdminAccount{}, err
	}
	return account, nil
}

func (r *AdminRepo) UpdateAdminAccount(ctx context.Context, change domain.AdminStaffChange) (domain.AdminAccount, error) {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return domain.AdminAccount{}, err
	}
	defer tx.Rollback(ctx)

	// Serializing roster changes makes the "last active owner" check stable
	// even when two owners edit access at the same time.
	if _, err := tx.Exec(ctx, `SELECT pg_advisory_xact_lock(hashtext('wigaj_admin_owner_roster'))`); err != nil {
		return domain.AdminAccount{}, err
	}

	var account domain.AdminAccount
	err = tx.QueryRow(ctx, `
		SELECT a.id, a.user_id, COALESCE(u.email, ''),
		       COALESCE(NULLIF(trim(concat_ws(' ', u.name, u.surname)), ''), u.email, 'Администратор'),
		       a.role, a.enabled, a.created_at, a.updated_at, a.last_login_at
		FROM admin_account a
		JOIN "user" u ON u.id = a.user_id
		WHERE a.id = $1
		FOR UPDATE OF a`, change.TargetAdminID).Scan(
		&account.ID,
		&account.UserID,
		&account.Email,
		&account.Name,
		&account.Role,
		&account.Enabled,
		&account.CreatedAt,
		&account.UpdatedAt,
		&account.LastLoginAt,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return domain.AdminAccount{}, domain.ErrNotFound
	}
	if err != nil {
		return domain.AdminAccount{}, err
	}

	previousRole := account.Role
	previousEnabled := account.Enabled
	removesActiveOwner := previousRole == domain.AdminRoleOwner && previousEnabled &&
		(change.Role != domain.AdminRoleOwner || !change.Enabled)
	if removesActiveOwner {
		var activeOwners int
		if err := tx.QueryRow(ctx, `
			SELECT count(*)
			FROM admin_account
			WHERE role = 'owner' AND enabled = true`).Scan(&activeOwners); err != nil {
			return domain.AdminAccount{}, err
		}
		if activeOwners <= 1 {
			return domain.AdminAccount{}, domain.ErrAdminStaffConflict
		}
	}

	err = tx.QueryRow(ctx, `
		UPDATE admin_account
		SET role = $2, enabled = $3, updated_at = $4
		WHERE id = $1
		RETURNING role, enabled, updated_at`,
		account.ID, change.Role, change.Enabled, change.CreatedAt,
	).Scan(&account.Role, &account.Enabled, &account.UpdatedAt)
	if err != nil {
		return domain.AdminAccount{}, err
	}

	if previousRole != account.Role || (previousEnabled && !account.Enabled) {
		if _, err := tx.Exec(ctx, `
			UPDATE admin_session
			SET revoked_at = $2
			WHERE admin_account_id = $1 AND revoked_at IS NULL`, account.ID, change.CreatedAt); err != nil {
			return domain.AdminAccount{}, err
		}
	}

	metadata, _ := json.Marshal(map[string]any{
		"email":    account.Email,
		"previous": map[string]any{"role": previousRole, "enabled": previousEnabled},
		"current":  map[string]any{"role": account.Role, "enabled": account.Enabled},
	})
	if err := insertAdminAudit(ctx, tx, domain.AdminAuditEntry{
		ActorAdminID: change.ActorAdminID,
		Action:       "admin.staff.update",
		TargetType:   "admin_account",
		TargetID:     formatInt64(account.ID),
		Metadata:     metadata,
		IPAddress:    change.IPAddress,
		UserAgent:    change.UserAgent,
		CreatedAt:    change.CreatedAt,
	}); err != nil {
		return domain.AdminAccount{}, err
	}

	if err := tx.Commit(ctx); err != nil {
		return domain.AdminAccount{}, err
	}
	return account, nil
}

func (r *AdminRepo) ListAdminAudit(ctx context.Context, filter domain.AdminAuditFilter) (domain.AdminAuditPage, error) {
	page := domain.AdminAuditPage{Limit: filter.Limit, Offset: filter.Offset}
	if err := r.pool.QueryRow(ctx, `
		SELECT count(*)
		FROM admin_audit_log l
		WHERE $1 = '' OR l.action LIKE $1 || '%'`, filter.Action).Scan(&page.Total); err != nil {
		return domain.AdminAuditPage{}, err
	}

	rows, err := r.pool.Query(ctx, `
		SELECT l.id,
		       a.id, a.user_id, COALESCE(u.email, ''),
		       COALESCE(NULLIF(trim(concat_ws(' ', u.name, u.surname)), ''), u.email, 'Администратор'),
		       a.role, a.enabled, a.created_at, a.updated_at, a.last_login_at,
		       l.action, COALESCE(l.target_type, ''), COALESCE(l.target_id, ''),
		       COALESCE(l.reason, ''), l.metadata, COALESCE(host(l.ip_address), ''),
		       COALESCE(l.user_agent, ''), l.created_at
		FROM admin_audit_log l
		JOIN admin_account a ON a.id = l.actor_admin_id
		JOIN "user" u ON u.id = a.user_id
		WHERE $1 = '' OR l.action LIKE $1 || '%'
		ORDER BY l.created_at DESC, l.id DESC
		LIMIT $2 OFFSET $3`, filter.Action, filter.Limit, filter.Offset)
	if err != nil {
		return domain.AdminAuditPage{}, err
	}
	defer rows.Close()

	page.Items = make([]domain.AdminAuditRecord, 0)
	for rows.Next() {
		var record domain.AdminAuditRecord
		var metadata []byte
		if err := rows.Scan(
			&record.ID,
			&record.Actor.ID,
			&record.Actor.UserID,
			&record.Actor.Email,
			&record.Actor.Name,
			&record.Actor.Role,
			&record.Actor.Enabled,
			&record.Actor.CreatedAt,
			&record.Actor.UpdatedAt,
			&record.Actor.LastLoginAt,
			&record.Action,
			&record.TargetType,
			&record.TargetID,
			&record.Reason,
			&metadata,
			&record.IPAddress,
			&record.UserAgent,
			&record.CreatedAt,
		); err != nil {
			return domain.AdminAuditPage{}, err
		}
		record.Metadata = append(json.RawMessage(nil), metadata...)
		page.Items = append(page.Items, record)
	}
	if err := rows.Err(); err != nil {
		return domain.AdminAuditPage{}, err
	}
	return page, nil
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

var _ domain.AdminManagementRepository = (*AdminRepo)(nil)
