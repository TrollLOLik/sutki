package postgres

import (
	"context"
	"encoding/json"
	"errors"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/TrollLOLik/sutki/backend/internal/domain"
)

const abuseReportLockNamespace int32 = 49049

type AbuseRepo struct {
	pool *pgxpool.Pool
}

func NewAbuseRepo(pool *pgxpool.Pool) *AbuseRepo {
	return &AbuseRepo{pool: pool}
}

func (r *AbuseRepo) CreateReport(ctx context.Context, in domain.CreateAbuseReport, maxPerDay int32) (domain.AbuseReport, error) {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return domain.AbuseReport{}, err
	}
	defer tx.Rollback(ctx)

	// Serialize the reporter's daily budget across every API replica. Without
	// this lock concurrent requests can all observe the same pre-limit count.
	if _, err := tx.Exec(ctx, `SELECT pg_advisory_xact_lock($1, $2)`, abuseReportLockNamespace, in.ReporterUserID); err != nil {
		return domain.AbuseReport{}, err
	}

	var reportsToday int32
	if err := tx.QueryRow(ctx, `
		SELECT count(*)::int
		FROM abuse_report
		WHERE reporter_user_id = $1
		  AND created_at >= now() - interval '24 hours'`, in.ReporterUserID).Scan(&reportsToday); err != nil {
		return domain.AbuseReport{}, err
	}
	if reportsToday >= maxPerDay {
		return domain.AbuseReport{}, domain.ErrReportRateLimit
	}

	target, err := resolveReportTarget(ctx, tx, in.ReporterUserID, in.TargetType, in.TargetID)
	if err != nil {
		return domain.AbuseReport{}, err
	}
	if target.UserID == in.ReporterUserID {
		return domain.AbuseReport{}, domain.ErrSelfReport
	}

	report := domain.AbuseReport{
		ReporterUserID: in.ReporterUserID,
		ReportedUserID: target.UserID,
		TargetType:     in.TargetType,
		TargetID:       in.TargetID,
		Reason:         in.Reason,
		Details:        in.Details,
		Status:         domain.ReportStatusNew,
		Evidence:       target.Evidence,
		Source:         in.Source,
		AppVersion:     in.AppVersion,
		IPAddress:      in.IPAddress,
		UserAgent:      in.UserAgent,
	}

	err = tx.QueryRow(ctx, `
		INSERT INTO abuse_report (
		  reporter_user_id, reported_user_id, target_type, target_id,
		  reason, details, status, evidence, source, app_version,
		  ip_address, user_agent
		) VALUES (
		  $1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9,
		  NULLIF($10, ''), NULLIF($11, '')::inet, NULLIF($12, '')
		)
		RETURNING id, created_at`,
		report.ReporterUserID,
		report.ReportedUserID,
		report.TargetType,
		report.TargetID,
		report.Reason,
		report.Details,
		report.Status,
		string(report.Evidence),
		report.Source,
		report.AppVersion,
		report.IPAddress,
		report.UserAgent,
	).Scan(&report.ID, &report.CreatedAt)
	if err != nil {
		return domain.AbuseReport{}, err
	}

	if err := tx.Commit(ctx); err != nil {
		return domain.AbuseReport{}, err
	}
	return report, nil
}

func resolveReportTarget(ctx context.Context, tx pgx.Tx, reporterUserID int32, targetType string, targetID int64) (domain.ReportTarget, error) {
	var (
		userID   int32
		evidence []byte
		err      error
	)

	switch targetType {
	case domain.ReportTargetUser:
		err = tx.QueryRow(ctx, `
			SELECT id,
			       jsonb_build_object(
			         'user_id', id,
			         'name', COALESCE(name, ''),
			         'surname', COALESCE(surname, ''),
			         'city', COALESCE(city, ''),
			         'avatar_url', COALESCE(avatar_url, '')
			       )
			FROM "user"
			WHERE id = $1 AND deleted = false`, targetID).Scan(&userID, &evidence)
	case domain.ReportTargetListing:
		err = tx.QueryRow(ctx, `
			SELECT owner_id,
			       jsonb_build_object(
			         'listing_id', id,
			         'street', street,
			         'house_number', house_number,
			         'city', city,
			         'status', status,
			         'description', left(description, 2000)
			       )
			FROM house
			WHERE id = $1 AND deleted = false`, targetID).Scan(&userID, &evidence)
	case domain.ReportTargetReview:
		err = tx.QueryRow(ctx, `
			SELECT owner_id,
			       jsonb_build_object(
			         'review_id', id,
			         'house_id', house_id,
			         'body', body,
			         'rating', rating,
			         'status', status,
			         'created_at', created_at
			       )
			FROM review
			WHERE id = $1`, targetID).Scan(&userID, &evidence)
	case domain.ReportTargetMessage:
		err = tx.QueryRow(ctx, `
			SELECT m.sender_id,
			       jsonb_build_object(
			         'message_id', m.id,
			         'conversation_id', m.conversation_id,
			         'body', COALESCE(m.body, ''),
			         'kind', m.kind,
			         'payload', m.payload,
			         'created_at', m.created_at,
			         'attachments', COALESCE((
			           SELECT jsonb_agg(jsonb_build_object(
			             'id', a.id,
			             'file_name', COALESCE(a.file_name, ''),
			             'mime_type', COALESCE(a.mime_type, ''),
			             'moderation_status', a.moderation_status
			           ) ORDER BY a.id)
			           FROM message_attachment a
			           WHERE a.message_id = m.id
			         ), '[]'::jsonb)
			       )
			FROM message m
			WHERE m.id = $1
			  AND m.sender_id IS NOT NULL
			  AND EXISTS (
			    SELECT 1
			    FROM conversation_participant cp
			    WHERE cp.conversation_id = m.conversation_id
			      AND cp.user_id = $2
			  )`, targetID, reporterUserID).Scan(&userID, &evidence)
	default:
		return domain.ReportTarget{}, domain.ErrNotFound
	}

	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			if targetType == domain.ReportTargetMessage {
				return domain.ReportTarget{}, domain.ErrReportTargetForbidden
			}
			return domain.ReportTarget{}, domain.ErrNotFound
		}
		return domain.ReportTarget{}, err
	}
	if !json.Valid(evidence) {
		return domain.ReportTarget{}, errors.New("invalid report evidence generated by database")
	}
	return domain.ReportTarget{UserID: userID, Evidence: evidence}, nil
}

func (r *AbuseRepo) BlockUser(ctx context.Context, blockerUserID, blockedUserID int32) (domain.BlockedUser, error) {
	if blockerUserID == blockedUserID {
		return domain.BlockedUser{}, domain.ErrSelfBlock
	}

	var blocked domain.BlockedUser
	err := r.pool.QueryRow(ctx, `
		WITH target AS (
		  SELECT id,
		         COALESCE(NULLIF(BTRIM(CONCAT_WS(' ', name, surname)), ''), 'Пользователь') AS display_name,
		         COALESCE(avatar_url, '') AS avatar_url
		  FROM "user"
		  WHERE id = $2 AND deleted = false
		), inserted AS (
		  INSERT INTO user_block (blocker_user_id, blocked_user_id)
		  SELECT $1, id FROM target
		  ON CONFLICT (blocker_user_id, blocked_user_id) WHERE revoked_at IS NULL
		  DO UPDATE SET blocker_user_id = EXCLUDED.blocker_user_id
		  RETURNING blocked_user_id, created_at
		)
		SELECT target.id, target.display_name, target.avatar_url, inserted.created_at
		FROM target
		JOIN inserted ON inserted.blocked_user_id = target.id`, blockerUserID, blockedUserID).Scan(
		&blocked.UserID,
		&blocked.Name,
		&blocked.AvatarURL,
		&blocked.BlockedAt,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return domain.BlockedUser{}, domain.ErrNotFound
	}
	return blocked, err
}

func (r *AbuseRepo) UnblockUser(ctx context.Context, blockerUserID, blockedUserID int32) error {
	_, err := r.pool.Exec(ctx, `
		UPDATE user_block
		SET revoked_at = now()
		WHERE blocker_user_id = $1
		  AND blocked_user_id = $2
		  AND revoked_at IS NULL`, blockerUserID, blockedUserID)
	return err
}

func (r *AbuseRepo) ListBlockedUsers(ctx context.Context, blockerUserID, limit, offset int32) (domain.BlockedUsersPage, error) {
	page := domain.BlockedUsersPage{Items: []domain.BlockedUser{}, Limit: limit, Offset: offset}
	if err := r.pool.QueryRow(ctx, `
		SELECT count(*)
		FROM user_block
		WHERE blocker_user_id = $1 AND revoked_at IS NULL`, blockerUserID).Scan(&page.Total); err != nil {
		return domain.BlockedUsersPage{}, err
	}

	rows, err := r.pool.Query(ctx, `
		SELECT u.id,
		       CASE
		         WHEN u.deleted THEN 'Удалённый пользователь'
		         ELSE COALESCE(NULLIF(BTRIM(CONCAT_WS(' ', u.name, u.surname)), ''), 'Пользователь')
		       END AS display_name,
		       CASE WHEN u.deleted THEN '' ELSE COALESCE(u.avatar_url, '') END AS avatar_url,
		       b.created_at
		FROM user_block b
		JOIN "user" u ON u.id = b.blocked_user_id
		WHERE b.blocker_user_id = $1 AND b.revoked_at IS NULL
		ORDER BY b.created_at DESC, b.id DESC
		LIMIT $2 OFFSET $3`, blockerUserID, limit, offset)
	if err != nil {
		return domain.BlockedUsersPage{}, err
	}
	defer rows.Close()

	for rows.Next() {
		var item domain.BlockedUser
		if err := rows.Scan(&item.UserID, &item.Name, &item.AvatarURL, &item.BlockedAt); err != nil {
			return domain.BlockedUsersPage{}, err
		}
		page.Items = append(page.Items, item)
	}
	if err := rows.Err(); err != nil {
		return domain.BlockedUsersPage{}, err
	}
	return page, nil
}

func (r *AbuseRepo) IsBlockedBetween(ctx context.Context, firstUserID, secondUserID int32) (bool, error) {
	state, err := r.BlockState(ctx, firstUserID, secondUserID)
	return state.Blocked, err
}

func (r *AbuseRepo) BlockState(ctx context.Context, viewerUserID, otherUserID int32) (domain.UserBlockState, error) {
	var state domain.UserBlockState
	err := r.pool.QueryRow(ctx, `
		SELECT
		  EXISTS (
		    SELECT 1
		    FROM user_block
		    WHERE blocker_user_id = $1
		      AND blocked_user_id = $2
		      AND revoked_at IS NULL
		  ) AS blocked_by_me,
		  EXISTS (
		  SELECT 1
		  FROM user_block
		  WHERE revoked_at IS NULL
		    AND (
		      (blocker_user_id = $1 AND blocked_user_id = $2)
		      OR (blocker_user_id = $2 AND blocked_user_id = $1)
		    )
		) AS blocked`, viewerUserID, otherUserID).Scan(&state.BlockedByMe, &state.Blocked)
	return state, err
}

var _ domain.AbuseRepository = (*AbuseRepo)(nil)
var _ domain.UserBlockChecker = (*AbuseRepo)(nil)
