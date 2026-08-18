package postgres

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/TrollLOLik/sutki/backend/internal/domain"
)

type AdminInboxRepo struct {
	pool *pgxpool.Pool
}

func NewAdminInboxRepo(pool *pgxpool.Pool) *AdminInboxRepo {
	return &AdminInboxRepo{pool: pool}
}

// adminInboxUnion deliberately selects only actionable rows. It does not
// create another moderation queue: the source tables remain authoritative.
const adminInboxUnion = `
	SELECT 'report'::text AS kind,
	       ar.id,
	       ar.reported_user_id AS subject_user_id,
	       ar.status::text,
	       ('Жалоба: ' || CASE ar.target_type
	          WHEN 'user' THEN 'пользователь'
	          WHEN 'listing' THEN 'объявление'
	          WHEN 'message' THEN 'сообщение'
	          WHEN 'review' THEN 'отзыв'
	          ELSE ar.target_type
	        END || ' #' || ar.target_id::text)::text AS title,
	       left(COALESCE(NULLIF(ar.details, ''), ar.reason), 240)::text AS summary,
	       ar.reason::text,
	       0::int AS attempts,
	       ar.created_at,
	       ar.updated_at
	FROM abuse_report ar
	WHERE ar.status IN ('new', 'in_review')

	UNION ALL

	SELECT 'listing'::text,
	       h.id::bigint,
	       h.owner_id,
	       h.status::text,
	       COALESCE(NULLIF(trim(concat_ws(' ', h.street, h.house_number)), ''), 'Объявление #' || h.id::text)::text,
	       left(COALESCE(h.description, ''), 240)::text,
	       COALESCE(NULLIF(mv.reason, ''), NULLIF(h.rejection_reason, ''), '')::text,
	       COALESCE(mv.attempts, 0)::int,
	       h.created_at AT TIME ZONE 'UTC',
	       h.updated_at AT TIME ZONE 'UTC'
	FROM house h
	LEFT JOIN LATERAL (
	  SELECT v.reason, v.attempts
	  FROM moderation_verdict v
	  WHERE v.house_id = h.id
	  ORDER BY v.created_at DESC, v.id DESC
	  LIMIT 1
	) mv ON true
	WHERE $1::boolean AND h.status = 'moderation_review' AND h.deleted = false

	UNION ALL

	SELECT 'review'::text,
	       rv.id::bigint,
	       rv.owner_id,
	       rv.status::text,
	       ('Отзыв к объявлению #' || rv.house_id::text)::text,
	       left(COALESCE(rv.original_body, rv.body, ''), 240)::text,
	       COALESCE(j.reason, '')::text,
	       COALESCE(j.attempts, 0)::int,
	       rv.created_at AT TIME ZONE 'UTC',
	       COALESCE(rv.updated_at, rv.created_at AT TIME ZONE 'UTC')
	FROM review rv
	LEFT JOIN LATERAL (
	  SELECT job.reason, job.attempts
	  FROM review_moderation_job job
	  WHERE job.target_type = 'review' AND job.target_id = rv.id
	  ORDER BY job.created_at DESC, job.id DESC
	  LIMIT 1
	) j ON true
	WHERE $1::boolean AND rv.status = 'moderation_review'

	UNION ALL

	SELECT 'review_reply'::text,
	       rp.id,
	       rp.owner_id,
	       rp.status::text,
	       ('Ответ владельца на отзыв #' || rp.review_id::text)::text,
	       left(COALESCE(rp.original_body, ''), 240)::text,
	       COALESCE(j.reason, '')::text,
	       COALESCE(j.attempts, 0)::int,
	       rp.created_at,
	       rp.updated_at
	FROM review_reply rp
	LEFT JOIN LATERAL (
	  SELECT job.reason, job.attempts
	  FROM review_moderation_job job
	  WHERE job.target_type = 'reply' AND job.target_id = rp.id
	  ORDER BY job.created_at DESC, job.id DESC
	  LIMIT 1
	) j ON true
	WHERE $1::boolean AND rp.status = 'moderation_review'

	UNION ALL

	SELECT 'attachment'::text,
	       ma.id,
	       m.sender_id,
	       ma.moderation_status::text,
	       COALESCE(NULLIF(ma.file_name, ''), 'Вложение #' || ma.id::text)::text,
	       concat_ws(' · ', COALESCE(NULLIF(ma.mime_type, ''), 'Файл'),
	         CASE WHEN COALESCE(ma.size_bytes, 0) > 0 THEN ma.size_bytes::text || ' байт' END)::text,
	       COALESCE(NULLIF(ma.moderation_reason, ''), NULLIF(job.last_error, ''), '')::text,
	       COALESCE(job.attempts, 0)::int,
	       ma.created_at,
	       COALESCE(job.updated_at, ma.created_at)
	FROM message_attachment ma
	JOIN message m ON m.id = ma.message_id
	LEFT JOIN attachment_moderation_job job ON job.attachment_id = ma.id
	WHERE $1::boolean AND ma.moderation_status = 'failed'
`

func (r *AdminInboxRepo) AdminInboxSummary(ctx context.Context, includeModeration bool) (domain.AdminInboxSummary, error) {
	var out domain.AdminInboxSummary
	err := r.pool.QueryRow(ctx, `
		SELECT
		  (SELECT count(*) FROM abuse_report WHERE status IN ('new', 'in_review')),
		  CASE WHEN $1::boolean THEN (SELECT count(*) FROM house WHERE status='moderation_review' AND deleted=false) ELSE 0 END,
		  CASE WHEN $1::boolean THEN (
		    (SELECT count(*) FROM review WHERE status='moderation_review') +
		    (SELECT count(*) FROM review_reply WHERE status='moderation_review')
		  ) ELSE 0 END,
		  CASE WHEN $1::boolean THEN (SELECT count(*) FROM message_attachment WHERE moderation_status='failed') ELSE 0 END
	`, includeModeration).Scan(&out.Reports, &out.Listings, &out.Reviews, &out.Attachments)
	out.Total = out.Reports + out.Listings + out.Reviews + out.Attachments
	return out, err
}

func (r *AdminInboxRepo) ListAdminInbox(ctx context.Context, filter domain.AdminInboxFilter, includeModeration bool) (domain.AdminInboxPage, error) {
	page := domain.AdminInboxPage{Items: []domain.AdminInboxItem{}, Limit: filter.Limit, Offset: filter.Offset}
	countQuery := `WITH inbox AS (` + adminInboxUnion + `)
		SELECT count(*) FROM inbox WHERE ($2::text = '' OR kind = $2::text)`
	if err := r.pool.QueryRow(ctx, countQuery, includeModeration, filter.Kind).Scan(&page.Total); err != nil {
		return domain.AdminInboxPage{}, err
	}

	listQuery := `WITH inbox AS (` + adminInboxUnion + `)
		SELECT kind, id, subject_user_id, status, title, summary, reason,
		       attempts, created_at, updated_at
		FROM inbox
		WHERE ($2::text = '' OR kind = $2::text)
		ORDER BY created_at DESC, kind, id DESC
		LIMIT $3 OFFSET $4`
	rows, err := r.pool.Query(ctx, listQuery, includeModeration, filter.Kind, filter.Limit, filter.Offset)
	if err != nil {
		return domain.AdminInboxPage{}, err
	}
	defer rows.Close()
	for rows.Next() {
		item, err := scanAdminInboxItem(rows)
		if err != nil {
			return domain.AdminInboxPage{}, err
		}
		page.Items = append(page.Items, item)
	}
	if err := rows.Err(); err != nil {
		return domain.AdminInboxPage{}, err
	}
	return page, nil
}

func (r *AdminInboxRepo) GetAdminInboxItem(ctx context.Context, kind string, id int64) (domain.AdminInboxDetail, error) {
	var detail domain.AdminInboxDetail
	var err error
	switch kind {
	case domain.AdminInboxKindReport:
		detail, err = r.getAdminReport(ctx, id)
	case domain.AdminInboxKindListing:
		detail, err = r.getAdminListing(ctx, id)
	case domain.AdminInboxKindReview:
		detail, err = r.getAdminReview(ctx, id, false)
	case domain.AdminInboxKindReviewReply:
		detail, err = r.getAdminReview(ctx, id, true)
	case domain.AdminInboxKindAttachment:
		detail, err = r.getAdminAttachment(ctx, id)
	default:
		return domain.AdminInboxDetail{}, domain.ErrNotFound
	}
	if errors.Is(err, pgx.ErrNoRows) {
		return domain.AdminInboxDetail{}, domain.ErrNotFound
	}
	if err != nil {
		return domain.AdminInboxDetail{}, err
	}
	detail.Evidence = validAdminJSON(detail.Evidence)
	detail.Context = validAdminJSON(detail.Context)
	detail.Media, err = r.listAdminInboxMedia(ctx, kind, id)
	if err != nil {
		return domain.AdminInboxDetail{}, err
	}
	detail.Users, err = r.listAdminInboxUsers(ctx, kind, id, detail.Item.SubjectUserID)
	if err != nil {
		return domain.AdminInboxDetail{}, err
	}
	if kind == domain.AdminInboxKindReport {
		detail.RelatedReports, err = r.listAdminRelatedReports(ctx, id)
		if err != nil {
			return domain.AdminInboxDetail{}, err
		}
		detail.ActiveSanctions, err = r.listActiveAdminSanctions(ctx, id)
		if err != nil {
			return domain.AdminInboxDetail{}, err
		}
	} else {
		detail.RelatedReports = []domain.AdminInboxRelatedReport{}
		detail.ActiveSanctions = []domain.AdminInboxSanctionRecord{}
	}
	return detail, nil
}

func (r *AdminInboxRepo) SearchAdminItems(
	ctx context.Context,
	filter domain.AdminSearchFilter,
) (domain.AdminSearchPage, error) {
	if filter.Kind != domain.AdminInboxKindUser {
		detail, err := r.GetAdminSearchItem(ctx, filter.Kind, filter.ID)
		if errors.Is(err, domain.ErrNotFound) {
			return domain.AdminSearchPage{Items: []domain.AdminInboxItem{}}, nil
		}
		if err != nil {
			return domain.AdminSearchPage{}, err
		}
		return domain.AdminSearchPage{Items: []domain.AdminInboxItem{detail.Item}}, nil
	}

	rows, err := r.pool.Query(ctx, `
		SELECT 'user',u.id::bigint,u.id,
		       CASE WHEN u.deleted THEN 'deleted' WHEN NOT u.enable THEN 'disabled' ELSE 'active' END,
		       COALESCE(NULLIF(trim(concat_ws(' ',u.name,u.surname)),''),'Пользователь #' || u.id::text),
		       concat_ws(' · ',NULLIF(u.email,''),NULLIF(u.phone,''),NULLIF(u.city,'')),
		       '',0,u.created_at AT TIME ZONE 'UTC',u.updated_at AT TIME ZONE 'UTC'
		FROM "user" u
		WHERE ($1::bigint > 0 AND u.id=$1)
		   OR lower(COALESCE(u.email,''))=lower($2)
		   OR ($3 <> '' AND length($3) >= 10 AND COALESCE(
		        NULLIF(u.phone_normalized,''),regexp_replace(COALESCE(u.phone,''),'[^0-9]','','g')
		      )=$3)
		ORDER BY u.id
		LIMIT 20`, filter.ID, filter.Query, filter.Phone)
	if err != nil {
		return domain.AdminSearchPage{}, err
	}
	defer rows.Close()
	items := make([]domain.AdminInboxItem, 0, 1)
	for rows.Next() {
		item, scanErr := scanAdminInboxItem(rows)
		if scanErr != nil {
			return domain.AdminSearchPage{}, scanErr
		}
		items = append(items, item)
	}
	if err := rows.Err(); err != nil {
		return domain.AdminSearchPage{}, err
	}
	return domain.AdminSearchPage{Items: items}, nil
}

func (r *AdminInboxRepo) GetAdminSearchItem(
	ctx context.Context,
	kind string,
	id int64,
) (domain.AdminInboxDetail, error) {
	var detail domain.AdminInboxDetail
	var err error
	switch kind {
	case domain.AdminInboxKindUser:
		detail, err = r.getAdminSearchUser(ctx, id)
	case domain.AdminInboxKindListing:
		detail, err = r.getAdminSearchListing(ctx, id)
	case domain.AdminInboxKindReview:
		detail, err = r.getAdminSearchReview(ctx, id)
	case domain.AdminInboxKindMessage:
		detail, err = r.getAdminSearchMessage(ctx, id)
	default:
		return domain.AdminInboxDetail{}, domain.ErrNotFound
	}
	if errors.Is(err, pgx.ErrNoRows) {
		return domain.AdminInboxDetail{}, domain.ErrNotFound
	}
	if err != nil {
		return domain.AdminInboxDetail{}, err
	}
	detail.Evidence = validAdminJSON(detail.Evidence)
	detail.Context = validAdminJSON(detail.Context)

	switch kind {
	case domain.AdminInboxKindListing:
		detail.Media, err = r.listAdminListingMedia(ctx, id)
	case domain.AdminInboxKindMessage:
		detail.Media, err = r.listAdminMessageMedia(ctx, id, 0)
	default:
		detail.Media = []domain.AdminInboxMedia{}
	}
	if err != nil {
		return domain.AdminInboxDetail{}, err
	}
	if kind == domain.AdminInboxKindUser {
		userID := int32(id)
		user, userErr := r.getAdminInboxUser(ctx, userID, domain.AdminInboxUserRelationSubject)
		if userErr != nil {
			return domain.AdminInboxDetail{}, userErr
		}
		detail.Users = []domain.AdminInboxUser{user}
	} else {
		detail.Users, err = r.listAdminInboxUsers(ctx, kind, id, detail.Item.SubjectUserID)
		if err != nil {
			return domain.AdminInboxDetail{}, err
		}
	}
	detail.RelatedReports, err = r.listAdminSearchReports(ctx, kind, id, detail.Item.SubjectUserID)
	if err != nil {
		return domain.AdminInboxDetail{}, err
	}
	detail.SanctionHistory, err = r.listAdminSanctionHistory(ctx, kind, id, detail.Item.SubjectUserID)
	if err != nil {
		return domain.AdminInboxDetail{}, err
	}
	detail.ActiveSanctions = make([]domain.AdminInboxSanctionRecord, 0)
	for _, sanction := range detail.SanctionHistory {
		if !sanction.Active {
			continue
		}
		detail.ActiveSanctions = append(detail.ActiveSanctions, domain.AdminInboxSanctionRecord{
			ID: sanction.ID, Type: sanction.Type, TargetType: sanction.TargetType,
			TargetID: sanction.TargetID, SubjectUserID: sanction.SubjectUserID,
			AppliedByAdminID: sanction.AppliedByAdminID, AppliedByEmail: sanction.AppliedByEmail,
			AppliedReason: sanction.AppliedReason, AppliedAt: sanction.AppliedAt,
		})
	}
	return detail, nil
}

func (r *AdminInboxRepo) GetAdminSearchMedia(
	ctx context.Context,
	kind string,
	id, mediaID int64,
	variant string,
) (domain.AdminInboxMediaObject, error) {
	switch kind {
	case domain.AdminInboxKindListing:
		if variant != domain.AdminInboxMediaVariantOriginal {
			return domain.AdminInboxMediaObject{}, domain.ErrNotFound
		}
		return r.getAdminListingMediaObject(ctx, id, mediaID)
	case domain.AdminInboxKindMessage:
		return r.getAdminMessageMediaObject(ctx, id, mediaID, variant, false)
	default:
		return domain.AdminInboxMediaObject{}, domain.ErrNotFound
	}
}

func (r *AdminInboxRepo) listAdminSearchReports(
	ctx context.Context,
	kind string,
	id int64,
	subjectUserID *int32,
) ([]domain.AdminInboxRelatedReport, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT ar.id,ar.status,ar.target_type,ar.target_id,ar.reason,ar.details,
		       ar.reporter_user_id,ar.reported_user_id,
		       ar.target_type=$1 AND ar.target_id=$2,
		       $3::integer IS NOT NULL AND ar.reported_user_id=$3,
		       ar.created_at,ar.updated_at
		FROM abuse_report ar
		WHERE (ar.target_type=$1 AND ar.target_id=$2)
		   OR ($3::integer IS NOT NULL AND ar.reported_user_id=$3)
		   OR ($1='user' AND (ar.reporter_user_id=$2 OR ar.reported_user_id=$2))
		ORDER BY CASE WHEN ar.status IN ('new','in_review') THEN 0 ELSE 1 END,
		         ar.updated_at DESC,ar.id DESC
		LIMIT 100`, kind, id, subjectUserID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	reports := make([]domain.AdminInboxRelatedReport, 0)
	for rows.Next() {
		var report domain.AdminInboxRelatedReport
		if err := rows.Scan(
			&report.ID, &report.Status, &report.TargetType, &report.TargetID,
			&report.Reason, &report.Details, &report.ReporterUserID,
			&report.ReportedUserID, &report.SameTarget, &report.SameUser,
			&report.CreatedAt, &report.UpdatedAt,
		); err != nil {
			return nil, err
		}
		reports = append(reports, report)
	}
	return reports, rows.Err()
}

func (r *AdminInboxRepo) listAdminSanctionHistory(
	ctx context.Context,
	kind string,
	id int64,
	subjectUserID *int32,
) ([]domain.AdminSanctionHistory, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT sanction.id,sanction.report_id,sanction.sanction_type,
		       sanction.target_type,sanction.target_id,sanction.subject_user_id,
		       sanction.applied_by_admin_id,
		       COALESCE(NULLIF(applied_user.email,''),'Администратор #' || sanction.applied_by_admin_id::text),
		       sanction.applied_reason,sanction.applied_at,
		       sanction.revoked_at IS NULL,sanction.revoked_at,sanction.revoked_by_admin_id,
		       COALESCE(revoked_user.email,''),COALESCE(sanction.revoke_reason,'')
		FROM admin_sanction sanction
		JOIN admin_account applied_admin ON applied_admin.id=sanction.applied_by_admin_id
		JOIN "user" applied_user ON applied_user.id=applied_admin.user_id
		LEFT JOIN admin_account revoked_admin ON revoked_admin.id=sanction.revoked_by_admin_id
		LEFT JOIN "user" revoked_user ON revoked_user.id=revoked_admin.user_id
		WHERE (sanction.target_type=$1 AND sanction.target_id=$2)
		   OR ($3::integer IS NOT NULL AND sanction.subject_user_id=$3)
		ORDER BY sanction.applied_at DESC,sanction.id DESC
		LIMIT 100`, kind, id, subjectUserID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	items := make([]domain.AdminSanctionHistory, 0)
	for rows.Next() {
		var item domain.AdminSanctionHistory
		if err := rows.Scan(
			&item.ID, &item.ReportID, &item.Type, &item.TargetType, &item.TargetID,
			&item.SubjectUserID, &item.AppliedByAdminID, &item.AppliedByEmail,
			&item.AppliedReason, &item.AppliedAt, &item.Active, &item.RevokedAt,
			&item.RevokedByAdminID, &item.RevokedByEmail, &item.RevocationReason,
		); err != nil {
			return nil, err
		}
		items = append(items, item)
	}
	return items, rows.Err()
}

func (r *AdminInboxRepo) listActiveAdminSanctions(ctx context.Context, reportID int64) ([]domain.AdminInboxSanctionRecord, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT sanction.id,sanction.sanction_type,sanction.target_type,sanction.target_id,
		       sanction.subject_user_id,sanction.applied_by_admin_id,
		       COALESCE(NULLIF(admin_user.email,''),'Администратор #' || sanction.applied_by_admin_id::text),
		       sanction.applied_reason,sanction.applied_at
		FROM admin_sanction sanction
		JOIN admin_account admin ON admin.id=sanction.applied_by_admin_id
		JOIN "user" admin_user ON admin_user.id=admin.user_id
		WHERE sanction.report_id=$1 AND sanction.revoked_at IS NULL
		ORDER BY sanction.applied_at,sanction.id`, reportID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := make([]domain.AdminInboxSanctionRecord, 0)
	for rows.Next() {
		var item domain.AdminInboxSanctionRecord
		if err := rows.Scan(
			&item.ID, &item.Type, &item.TargetType, &item.TargetID,
			&item.SubjectUserID, &item.AppliedByAdminID, &item.AppliedByEmail,
			&item.AppliedReason, &item.AppliedAt,
		); err != nil {
			return nil, err
		}
		items = append(items, item)
	}
	return items, rows.Err()
}

func (r *AdminInboxRepo) listAdminRelatedReports(ctx context.Context, reportID int64) ([]domain.AdminInboxRelatedReport, error) {
	rows, err := r.pool.Query(ctx, `
		WITH current_report AS (
		  SELECT id,target_type,target_id,reported_user_id
		  FROM abuse_report
		  WHERE id=$1
		)
		SELECT candidate.id,candidate.status,candidate.target_type,candidate.target_id,
		       candidate.reason,candidate.details,candidate.reporter_user_id,
		       candidate.reported_user_id,
		       candidate.target_type=current_report.target_type
		         AND candidate.target_id=current_report.target_id AS same_target,
		       current_report.reported_user_id IS NOT NULL
		         AND COALESCE(candidate.reported_user_id=current_report.reported_user_id,false) AS same_user,
		       candidate.created_at,candidate.updated_at
		FROM abuse_report candidate
		CROSS JOIN current_report
		WHERE candidate.id<>current_report.id
		  AND (
		    (candidate.target_type=current_report.target_type AND candidate.target_id=current_report.target_id)
		    OR (
		      current_report.reported_user_id IS NOT NULL
		      AND candidate.reported_user_id=current_report.reported_user_id
		    )
		  )
		ORDER BY CASE WHEN candidate.status IN ('new','in_review') THEN 0 ELSE 1 END,
		         candidate.updated_at DESC,candidate.id DESC
		LIMIT 30`, reportID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	reports := make([]domain.AdminInboxRelatedReport, 0)
	for rows.Next() {
		var report domain.AdminInboxRelatedReport
		if err := rows.Scan(
			&report.ID, &report.Status, &report.TargetType, &report.TargetID,
			&report.Reason, &report.Details, &report.ReporterUserID,
			&report.ReportedUserID, &report.SameTarget, &report.SameUser,
			&report.CreatedAt, &report.UpdatedAt,
		); err != nil {
			return nil, err
		}
		reports = append(reports, report)
	}
	return reports, rows.Err()
}

func (r *AdminInboxRepo) listAdminInboxUsers(
	ctx context.Context,
	kind string,
	id int64,
	subjectUserID *int32,
) ([]domain.AdminInboxUser, error) {
	users := make([]domain.AdminInboxUser, 0, 2)
	seen := make(map[int32]struct{}, 2)
	appendUser := func(userID *int32, relation string) error {
		if userID == nil || *userID <= 0 {
			return nil
		}
		if _, ok := seen[*userID]; ok {
			return nil
		}
		user, err := r.getAdminInboxUser(ctx, *userID, relation)
		if errors.Is(err, pgx.ErrNoRows) {
			return nil
		}
		if err != nil {
			return err
		}
		seen[*userID] = struct{}{}
		users = append(users, user)
		return nil
	}

	if err := appendUser(subjectUserID, domain.AdminInboxUserRelationSubject); err != nil {
		return nil, err
	}
	if kind == domain.AdminInboxKindReport {
		var reporterUserID *int32
		if err := r.pool.QueryRow(ctx, `
			SELECT reporter_user_id FROM abuse_report WHERE id=$1`, id,
		).Scan(&reporterUserID); err != nil {
			return nil, err
		}
		if err := appendUser(reporterUserID, domain.AdminInboxUserRelationReporter); err != nil {
			return nil, err
		}
	}
	return users, nil
}

func (r *AdminInboxRepo) getAdminInboxUser(
	ctx context.Context,
	userID int32,
	relation string,
) (domain.AdminInboxUser, error) {
	var user domain.AdminInboxUser
	user.Relation = relation
	err := r.pool.QueryRow(ctx, `
		SELECT u.id,
		       COALESCE(NULLIF(trim(concat_ws(' ',u.name,u.surname)),''),'Пользователь #' || u.id::text),
		       COALESCE(u.email,''),COALESCE(u.phone,''),u.phone_verified_at IS NOT NULL,
		       COALESCE(u.city,''),u.enable,u.deleted,u.is_verified,
		       COALESCE(u.public_profile_visible,false),u.created_at AT TIME ZONE 'UTC',
		       GREATEST(u.last_seen_at,last_session.last_active_at),
		       COALESCE(last_session.app_version,''),
		       (SELECT count(*)::int FROM refresh_token rt
		          WHERE rt.user_id=u.id AND rt.revoked_at IS NULL AND rt.expires_at > now()),
		       (SELECT count(*)::int FROM house h WHERE h.owner_id=u.id AND h.deleted=false),
		       (SELECT count(*)::int FROM house h
		          WHERE h.owner_id=u.id AND h.deleted=false AND h.status='active'),
		       (SELECT count(*)::int FROM review rv WHERE rv.owner_id=u.id),
		       (SELECT count(*)::int FROM request rq WHERE rq.user_id=u.id),
		       (SELECT count(*)::int FROM request rq JOIN house h ON h.id=rq.house_id
		          WHERE h.owner_id=u.id),
		       (SELECT count(*)::int FROM abuse_report ar WHERE ar.reporter_user_id=u.id),
		       (SELECT count(*)::int FROM abuse_report ar WHERE ar.reported_user_id=u.id),
		       (SELECT count(*)::int FROM user_block ub
		          WHERE ub.blocker_user_id=u.id AND ub.revoked_at IS NULL),
		       (SELECT count(*)::int FROM user_block ub
		          WHERE ub.blocked_user_id=u.id AND ub.revoked_at IS NULL)
		FROM "user" u
		LEFT JOIN LATERAL (
		  SELECT rt.last_active_at,rt.app_version
		  FROM refresh_token rt
		  WHERE rt.user_id=u.id
		  ORDER BY rt.last_active_at DESC,rt.id DESC
		  LIMIT 1
		) last_session ON true
		WHERE u.id=$1`, userID).Scan(
		&user.ID, &user.Name, &user.Email, &user.Phone, &user.PhoneVerified,
		&user.City, &user.AccountEnabled, &user.Deleted, &user.IdentityVerified,
		&user.PublicProfileVisible, &user.CreatedAt, &user.LastSeenAt,
		&user.LastAppVersion, &user.ActiveSessions, &user.ListingsTotal,
		&user.ListingsActive, &user.ReviewsAuthored, &user.BookingsAsGuest,
		&user.BookingsAsOwner, &user.ReportsSubmitted, &user.ReportsReceived,
		&user.BlocksCreated, &user.BlocksReceived,
	)
	return user, err
}

func (r *AdminInboxRepo) listAdminInboxMedia(ctx context.Context, kind string, id int64) ([]domain.AdminInboxMedia, error) {
	switch kind {
	case domain.AdminInboxKindListing:
		return r.listAdminListingMedia(ctx, id)
	case domain.AdminInboxKindAttachment:
		return r.listAdminMessageMedia(ctx, 0, id)
	case domain.AdminInboxKindReport:
		var targetType string
		var targetID int64
		if err := r.pool.QueryRow(ctx, `
			SELECT target_type,target_id FROM abuse_report WHERE id=$1`, id,
		).Scan(&targetType, &targetID); err != nil {
			return nil, mapAdminMediaReadError(err)
		}
		switch targetType {
		case domain.ReportTargetListing:
			return r.listAdminListingMedia(ctx, targetID)
		case domain.ReportTargetMessage:
			return r.listAdminMessageMedia(ctx, targetID, 0)
		default:
			return []domain.AdminInboxMedia{}, nil
		}
	default:
		return []domain.AdminInboxMedia{}, nil
	}
}

func (r *AdminInboxRepo) listAdminListingMedia(ctx context.Context, houseID int64) ([]domain.AdminInboxMedia, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT f.id::bigint,
		       COALESCE(NULLIF(f.name,''),'Фото #' || f.id::text),
		       CASE
		         WHEN position('/' in COALESCE(f.format,'')) > 0 THEN lower(f.format)
		         WHEN lower(trim(COALESCE(f.format,''))) IN ('jpg','jpeg') THEN 'image/jpeg'
		         WHEN trim(COALESCE(f.format,'')) <> '' THEN 'image/' || lower(trim(leading '.' from f.format))
		         ELSE 'image/jpeg'
		       END,
		       COALESCE(f.size,0)::bigint
		FROM file f
		WHERE f.house_id=$1 AND f.deleted=false AND NULLIF(trim(f.path),'') IS NOT NULL
		ORDER BY f.position,f.id`, houseID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	items := make([]domain.AdminInboxMedia, 0)
	for rows.Next() {
		var item domain.AdminInboxMedia
		if err := rows.Scan(&item.ID, &item.FileName, &item.MimeType, &item.SizeBytes); err != nil {
			return nil, err
		}
		items = append(items, item)
	}
	return items, rows.Err()
}

// Exactly one of messageID or attachmentID must be non-zero. The latter is
// used by the failed-attachment moderation queue and prevents a caller from
// widening one queue item into every attachment in the conversation.
func (r *AdminInboxRepo) listAdminMessageMedia(ctx context.Context, messageID, attachmentID int64) ([]domain.AdminInboxMedia, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT ma.id,COALESCE(NULLIF(ma.file_name,''),'Вложение #' || ma.id::text),
		       COALESCE(NULLIF(ma.mime_type,''),'application/octet-stream'),
		       COALESCE(ma.size_bytes,0),ma.width,ma.height,
		       NULLIF(ma.thumbnail_url,'') IS NOT NULL
		FROM message_attachment ma
		WHERE (($1::bigint > 0 AND ma.message_id=$1) OR ($2::bigint > 0 AND ma.id=$2))
		  AND NULLIF(ma.url,'') IS NOT NULL
		ORDER BY ma.id`, messageID, attachmentID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	items := make([]domain.AdminInboxMedia, 0)
	for rows.Next() {
		var item domain.AdminInboxMedia
		if err := rows.Scan(
			&item.ID, &item.FileName, &item.MimeType, &item.SizeBytes,
			&item.Width, &item.Height, &item.HasThumbnail,
		); err != nil {
			return nil, err
		}
		items = append(items, item)
	}
	return items, rows.Err()
}

// GetAdminInboxMedia resolves a media ID through its queue item. No object
// key supplied by the HTTP client ever reaches storage.
func (r *AdminInboxRepo) GetAdminInboxMedia(
	ctx context.Context,
	kind string,
	id, mediaID int64,
	variant string,
) (domain.AdminInboxMediaObject, error) {
	if mediaID <= 0 {
		return domain.AdminInboxMediaObject{}, domain.ErrNotFound
	}
	switch kind {
	case domain.AdminInboxKindListing:
		if variant != domain.AdminInboxMediaVariantOriginal {
			return domain.AdminInboxMediaObject{}, domain.ErrNotFound
		}
		return r.getAdminListingMediaObject(ctx, id, mediaID)
	case domain.AdminInboxKindAttachment:
		if id != mediaID {
			return domain.AdminInboxMediaObject{}, domain.ErrNotFound
		}
		return r.getAdminMessageMediaObject(ctx, 0, mediaID, variant, true)
	case domain.AdminInboxKindReport:
		var targetType string
		var targetID int64
		if err := r.pool.QueryRow(ctx, `
			SELECT target_type,target_id FROM abuse_report WHERE id=$1`, id,
		).Scan(&targetType, &targetID); err != nil {
			return domain.AdminInboxMediaObject{}, mapAdminMediaReadError(err)
		}
		switch targetType {
		case domain.ReportTargetListing:
			if variant != domain.AdminInboxMediaVariantOriginal {
				return domain.AdminInboxMediaObject{}, domain.ErrNotFound
			}
			return r.getAdminListingMediaObject(ctx, targetID, mediaID)
		case domain.ReportTargetMessage:
			return r.getAdminMessageMediaObject(ctx, targetID, mediaID, variant, false)
		default:
			return domain.AdminInboxMediaObject{}, domain.ErrNotFound
		}
	default:
		return domain.AdminInboxMediaObject{}, domain.ErrNotFound
	}
}

func (r *AdminInboxRepo) getAdminListingMediaObject(ctx context.Context, houseID, mediaID int64) (domain.AdminInboxMediaObject, error) {
	var object domain.AdminInboxMediaObject
	object.Storage = domain.AdminInboxMediaStoragePublic
	err := r.pool.QueryRow(ctx, `
		SELECT f.path,
		       CASE
		         WHEN position('/' in COALESCE(f.format,'')) > 0 THEN lower(f.format)
		         WHEN lower(trim(COALESCE(f.format,''))) IN ('jpg','jpeg') THEN 'image/jpeg'
		         WHEN trim(COALESCE(f.format,'')) <> '' THEN 'image/' || lower(trim(leading '.' from f.format))
		         ELSE 'image/jpeg'
		       END,
		       COALESCE(NULLIF(f.name,''),'Фото #' || f.id::text)
		FROM file f
		WHERE f.id=$1 AND f.house_id=$2 AND f.deleted=false AND NULLIF(trim(f.path),'') IS NOT NULL`,
		mediaID, houseID,
	).Scan(&object.Key, &object.MimeType, &object.FileName)
	if err != nil {
		return domain.AdminInboxMediaObject{}, mapAdminMediaReadError(err)
	}
	return object, nil
}

func (r *AdminInboxRepo) getAdminMessageMediaObject(
	ctx context.Context,
	messageID, mediaID int64,
	variant string,
	failedOnly bool,
) (domain.AdminInboxMediaObject, error) {
	column := "ma.url"
	if variant == domain.AdminInboxMediaVariantThumbnail {
		column = "ma.thumbnail_url"
	}
	query := fmt.Sprintf(`
		SELECT %s,COALESCE(NULLIF(ma.mime_type,''),'application/octet-stream'),
		       COALESCE(NULLIF(ma.file_name,''),'Вложение #' || ma.id::text)
		FROM message_attachment ma
		WHERE ma.id=$1
		  AND ($2::bigint=0 OR ma.message_id=$2)
		  AND ($3::boolean=false OR ma.moderation_status='failed')
		  AND NULLIF(%s,'') IS NOT NULL`, column, column)
	var object domain.AdminInboxMediaObject
	object.Storage = domain.AdminInboxMediaStoragePrivate
	if err := r.pool.QueryRow(ctx, query, mediaID, messageID, failedOnly).Scan(
		&object.Key, &object.MimeType, &object.FileName,
	); err != nil {
		return domain.AdminInboxMediaObject{}, mapAdminMediaReadError(err)
	}
	if variant == domain.AdminInboxMediaVariantThumbnail {
		object.MimeType = "image/jpeg"
	}
	return object, nil
}

func mapAdminMediaReadError(err error) error {
	if errors.Is(err, pgx.ErrNoRows) {
		return domain.ErrNotFound
	}
	return err
}

// ApplyAdminInboxAction changes the authoritative source row and appends the
// operator audit entry in the same transaction. Locking the source row makes
// double clicks and decisions from two operators deterministic: one commits,
// the other receives ErrAdminActionConflict.
func (r *AdminInboxRepo) ApplyAdminInboxAction(ctx context.Context, action domain.AdminInboxAction) (domain.AdminInboxActionResult, error) {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return domain.AdminInboxActionResult{}, err
	}
	defer tx.Rollback(ctx)

	var result domain.AdminInboxActionResult
	switch action.Kind {
	case domain.AdminInboxKindReport:
		result, err = applyAdminReportAction(ctx, tx, action)
	case domain.AdminInboxKindListing:
		result, err = applyAdminListingAction(ctx, tx, action)
	case domain.AdminInboxKindReview:
		result, err = applyAdminReviewAction(ctx, tx, action, false)
	case domain.AdminInboxKindReviewReply:
		result, err = applyAdminReviewAction(ctx, tx, action, true)
	case domain.AdminInboxKindAttachment:
		result, err = applyAdminAttachmentAction(ctx, tx, action)
	default:
		return domain.AdminInboxActionResult{}, domain.ErrNotFound
	}
	if err != nil {
		return domain.AdminInboxActionResult{}, err
	}

	metadata, err := json.Marshal(map[string]any{
		"result_status":        result.Status,
		"sanctions":            result.Sanctions,
		"revoked_sanction_ids": result.RevokedSanctionIDs,
	})
	if err != nil {
		return domain.AdminInboxActionResult{}, err
	}
	if err := insertAdminAudit(ctx, tx, domain.AdminAuditEntry{
		ActorAdminID: action.ActorAdminID,
		Action:       "admin_inbox." + action.Kind + "." + action.Action,
		TargetType:   action.Kind,
		TargetID:     formatInt64(action.ID),
		Reason:       action.Reason,
		Metadata:     metadata,
		IPAddress:    action.ActorIPAddress,
		UserAgent:    action.ActorUserAgent,
	}); err != nil {
		return domain.AdminInboxActionResult{}, err
	}
	if err := tx.Commit(ctx); err != nil {
		return domain.AdminInboxActionResult{}, err
	}
	return result, nil
}

func applyAdminReportAction(ctx context.Context, tx pgx.Tx, action domain.AdminInboxAction) (domain.AdminInboxActionResult, error) {
	var status, targetType string
	var targetID int64
	var subjectUserID *int32
	if err := tx.QueryRow(ctx, `
		SELECT status,reported_user_id,target_type,target_id
		FROM abuse_report
		WHERE id=$1
		FOR UPDATE`, action.ID).Scan(&status, &subjectUserID, &targetType, &targetID); err != nil {
		return domain.AdminInboxActionResult{}, mapAdminActionReadError(err)
	}

	next := ""
	revokedSessionIDs := make([]int64, 0)
	revokedSanctionIDs := make([]int64, 0)
	resultSanctions := action.Sanctions
	switch action.Action {
	case domain.AdminInboxActionStartReview:
		if status != "new" {
			return domain.AdminInboxActionResult{}, domain.ErrAdminActionConflict
		}
		next = "in_review"
	case domain.AdminInboxActionResolve:
		if status != "new" && status != "in_review" {
			return domain.AdminInboxActionResult{}, domain.ErrAdminActionConflict
		}
		if containsAdminSanction(action.Sanctions, domain.AdminInboxSanctionDisableUser) {
			if subjectUserID == nil || *subjectUserID <= 0 {
				return domain.AdminInboxActionResult{}, domain.ErrAdminActionConflict
			}
			rows, err := tx.Query(ctx, `
				SELECT id FROM refresh_token
				WHERE user_id=$1 AND revoked_at IS NULL AND expires_at>now()
				ORDER BY id`, *subjectUserID)
			if err != nil {
				return domain.AdminInboxActionResult{}, err
			}
			for rows.Next() {
				var sessionID int64
				if err := rows.Scan(&sessionID); err != nil {
					rows.Close()
					return domain.AdminInboxActionResult{}, err
				}
				revokedSessionIDs = append(revokedSessionIDs, sessionID)
			}
			if err := rows.Err(); err != nil {
				rows.Close()
				return domain.AdminInboxActionResult{}, err
			}
			rows.Close()
		}
		if err := applyAdminReportSanctions(ctx, tx, action, targetType, targetID, subjectUserID); err != nil {
			return domain.AdminInboxActionResult{}, err
		}
		next = "resolved"
	case domain.AdminInboxActionRevoke:
		if status != "resolved" || len(action.SanctionIDs) == 0 {
			return domain.AdminInboxActionResult{}, domain.ErrAdminActionConflict
		}
		var err error
		resultSanctions, revokedSanctionIDs, err = revokeAdminReportSanctions(ctx, tx, action)
		if err != nil {
			return domain.AdminInboxActionResult{}, err
		}
		next = status
	case domain.AdminInboxActionDismiss:
		if status != "new" && status != "in_review" {
			return domain.AdminInboxActionResult{}, domain.ErrAdminActionConflict
		}
		next = "dismissed"
	default:
		return domain.AdminInboxActionResult{}, domain.ErrAdminActionConflict
	}
	if action.Action != domain.AdminInboxActionRevoke {
		if _, err := tx.Exec(ctx, `UPDATE abuse_report SET status=$2,updated_at=now() WHERE id=$1`, action.ID, next); err != nil {
			return domain.AdminInboxActionResult{}, err
		}
	}
	result := domain.AdminInboxActionResult{
		Kind: action.Kind, ID: action.ID, Status: next, Sanctions: resultSanctions,
		SubjectUserID: subjectUserID, TargetType: targetType, TargetID: targetID,
		RevokedSessionIDs: revokedSessionIDs, RevokedSanctionIDs: revokedSanctionIDs,
	}
	return result, nil
}

func applyAdminReportSanctions(
	ctx context.Context,
	tx pgx.Tx,
	action domain.AdminInboxAction,
	targetType string,
	targetID int64,
	subjectUserID *int32,
) error {
	for _, sanction := range action.Sanctions {
		switch sanction {
		case domain.AdminInboxSanctionRejectListing:
			if targetType != domain.ReportTargetListing {
				return domain.ErrAdminActionConflict
			}
			var previous adminListingSanctionState
			if err := tx.QueryRow(ctx, `
				SELECT status,rejection_reason FROM house
				WHERE id=$1 AND deleted=false FOR UPDATE`, targetID,
			).Scan(&previous.Status, &previous.RejectionReason); err != nil {
				return mapAdminActionReadError(err)
			}
			if previous.Status == "rejected" {
				return domain.ErrAdminActionConflict
			}
			if err := insertAdminSanction(ctx, tx, action, sanction, domain.ReportTargetListing, targetID, subjectUserID, previous); err != nil {
				return err
			}
			tag, err := tx.Exec(ctx, `
				UPDATE house
				SET status='rejected',rejection_reason=left($2,2000),updated_at=now()
				WHERE id=$1 AND deleted=false AND status<>'rejected'`, targetID, action.Reason)
			if err != nil {
				return err
			}
			if tag.RowsAffected() != 1 {
				return domain.ErrAdminActionConflict
			}
		case domain.AdminInboxSanctionHideReview:
			if targetType != domain.ReportTargetReview {
				return domain.ErrAdminActionConflict
			}
			var previous adminReviewSanctionState
			if err := tx.QueryRow(ctx, `
				SELECT status,published_body,rejection_reason,moderated_at
				FROM review WHERE id=$1 FOR UPDATE`, targetID,
			).Scan(&previous.Status, &previous.PublishedBody, &previous.RejectionReason, &previous.ModeratedAt); err != nil {
				return mapAdminActionReadError(err)
			}
			if previous.Status == "rejected" {
				return domain.ErrAdminActionConflict
			}
			if err := insertAdminSanction(ctx, tx, action, sanction, domain.ReportTargetReview, targetID, subjectUserID, previous); err != nil {
				return err
			}
			tag, err := tx.Exec(ctx, `
				UPDATE review
				SET status='rejected',published_body=NULL,
				    rejection_reason=left($2,500),moderated_at=now(),updated_at=now()
				WHERE id=$1 AND status<>'rejected'`, targetID, action.Reason)
			if err != nil {
				return err
			}
			if tag.RowsAffected() != 1 {
				return domain.ErrAdminActionConflict
			}
			if _, err := tx.Exec(ctx, `
				INSERT INTO review_summary_job(house_id)
				SELECT house_id FROM review WHERE id=$1
				ON CONFLICT(house_id) DO UPDATE
				SET status='queued',run_after=now(),updated_at=now()`, targetID); err != nil {
				return err
			}
		case domain.AdminInboxSanctionHideMessage:
			if targetType != domain.ReportTargetMessage {
				return domain.ErrAdminActionConflict
			}
			var previous adminMessageSanctionState
			if err := tx.QueryRow(ctx, `
				SELECT deleted_at FROM message WHERE id=$1 FOR UPDATE`, targetID,
			).Scan(&previous.DeletedAt); err != nil {
				return mapAdminActionReadError(err)
			}
			if previous.DeletedAt != nil {
				return domain.ErrAdminActionConflict
			}
			if err := insertAdminSanction(ctx, tx, action, sanction, domain.ReportTargetMessage, targetID, subjectUserID, previous); err != nil {
				return err
			}
			tag, err := tx.Exec(ctx, `
				UPDATE message
				SET deleted_at=now()
				WHERE id=$1 AND deleted_at IS NULL`, targetID)
			if err != nil {
				return err
			}
			if tag.RowsAffected() != 1 {
				return domain.ErrAdminActionConflict
			}
		case domain.AdminInboxSanctionDisableUser:
			if subjectUserID == nil || *subjectUserID <= 0 {
				return domain.ErrAdminActionConflict
			}
			var protectedOwner bool
			if err := tx.QueryRow(ctx, `
				SELECT EXISTS(
				  SELECT 1 FROM admin_account
				  WHERE user_id=$1 AND role='owner' AND enabled=true
				)`, *subjectUserID).Scan(&protectedOwner); err != nil {
				return err
			}
			if protectedOwner {
				return domain.ErrAdminActionConflict
			}
			var previous adminUserSanctionState
			if err := tx.QueryRow(ctx, `
				SELECT enable,public_profile_visible FROM "user"
				WHERE id=$1 AND deleted=false FOR UPDATE`, *subjectUserID,
			).Scan(&previous.Enabled, &previous.PublicProfileVisible); err != nil {
				return mapAdminActionReadError(err)
			}
			if !previous.Enabled {
				return domain.ErrAdminActionConflict
			}
			if err := tx.QueryRow(ctx, `
				SELECT enabled FROM admin_account WHERE user_id=$1 FOR UPDATE`, *subjectUserID,
			).Scan(&previous.AdminEnabled); err != nil && !errors.Is(err, pgx.ErrNoRows) {
				return err
			}
			if err := insertAdminSanction(ctx, tx, action, sanction, domain.ReportTargetUser, int64(*subjectUserID), subjectUserID, previous); err != nil {
				return err
			}
			tag, err := tx.Exec(ctx, `
				UPDATE "user"
				SET enable=false,public_profile_visible=false,updated_at=now()
				WHERE id=$1 AND deleted=false`, *subjectUserID)
			if err != nil {
				return err
			}
			if tag.RowsAffected() != 1 {
				return domain.ErrAdminActionConflict
			}
			if _, err := tx.Exec(ctx, `
				UPDATE refresh_token SET revoked_at=now()
				WHERE user_id=$1 AND revoked_at IS NULL`, *subjectUserID); err != nil {
				return err
			}
			if _, err := tx.Exec(ctx, `
				WITH disabled_admins AS (
				  UPDATE admin_account
				  SET enabled=false,updated_at=now()
				  WHERE user_id=$1 AND role<>'owner'
				  RETURNING id
				)
				UPDATE admin_session SET revoked_at=now()
				WHERE admin_account_id IN (SELECT id FROM disabled_admins)
				  AND revoked_at IS NULL`, *subjectUserID); err != nil {
				return err
			}
		default:
			return domain.ErrAdminActionConflict
		}
	}
	return nil
}

type adminListingSanctionState struct {
	Status          string  `json:"status"`
	RejectionReason *string `json:"rejection_reason"`
}

type adminReviewSanctionState struct {
	Status          string     `json:"status"`
	PublishedBody   *string    `json:"published_body"`
	RejectionReason *string    `json:"rejection_reason"`
	ModeratedAt     *time.Time `json:"moderated_at"`
}

type adminMessageSanctionState struct {
	DeletedAt *time.Time `json:"deleted_at"`
}

type adminUserSanctionState struct {
	Enabled              bool  `json:"enabled"`
	PublicProfileVisible bool  `json:"public_profile_visible"`
	AdminEnabled         *bool `json:"admin_enabled"`
}

func insertAdminSanction(
	ctx context.Context,
	tx pgx.Tx,
	action domain.AdminInboxAction,
	sanctionType, targetType string,
	targetID int64,
	subjectUserID *int32,
	previousState any,
) error {
	payload, err := json.Marshal(previousState)
	if err != nil {
		return err
	}
	var sanctionID int64
	err = tx.QueryRow(ctx, `
		INSERT INTO admin_sanction (
		  report_id,sanction_type,target_type,target_id,subject_user_id,
		  previous_state,applied_by_admin_id,applied_reason
		) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
		ON CONFLICT (sanction_type,target_type,target_id) WHERE revoked_at IS NULL
		DO NOTHING
		RETURNING id`,
		action.ID, sanctionType, targetType, targetID, subjectUserID,
		payload, action.ActorAdminID, action.Reason,
	).Scan(&sanctionID)
	if errors.Is(err, pgx.ErrNoRows) {
		return domain.ErrAdminActionConflict
	}
	return err
}

type adminSanctionForRevoke struct {
	ID            int64
	Type          string
	TargetType    string
	TargetID      int64
	SubjectUserID *int32
	PreviousState json.RawMessage
	AppliedReason string
}

func revokeAdminReportSanctions(
	ctx context.Context,
	tx pgx.Tx,
	action domain.AdminInboxAction,
) ([]string, []int64, error) {
	rows, err := tx.Query(ctx, `
		SELECT id,sanction_type,target_type,target_id,subject_user_id,previous_state,applied_reason
		FROM admin_sanction
		WHERE report_id=$1 AND id=ANY($2::bigint[]) AND revoked_at IS NULL
		ORDER BY id
		FOR UPDATE`, action.ID, action.SanctionIDs)
	if err != nil {
		return nil, nil, err
	}

	items := make([]adminSanctionForRevoke, 0, len(action.SanctionIDs))
	for rows.Next() {
		var item adminSanctionForRevoke
		if err := rows.Scan(
			&item.ID, &item.Type, &item.TargetType, &item.TargetID,
			&item.SubjectUserID, &item.PreviousState, &item.AppliedReason,
		); err != nil {
			rows.Close()
			return nil, nil, err
		}
		items = append(items, item)
	}
	if err := rows.Err(); err != nil {
		rows.Close()
		return nil, nil, err
	}
	rows.Close()
	if len(items) != len(action.SanctionIDs) {
		return nil, nil, domain.ErrAdminActionConflict
	}

	types := make([]string, 0, len(items))
	ids := make([]int64, 0, len(items))
	for _, item := range items {
		if err := restoreAdminSanction(ctx, tx, item); err != nil {
			return nil, nil, err
		}
		tag, err := tx.Exec(ctx, `
			UPDATE admin_sanction
			SET revoked_at=now(),revoked_by_admin_id=$2,revoke_reason=$3
			WHERE id=$1 AND revoked_at IS NULL`, item.ID, action.ActorAdminID, action.Reason)
		if err != nil {
			return nil, nil, err
		}
		if tag.RowsAffected() != 1 {
			return nil, nil, domain.ErrAdminActionConflict
		}
		types = append(types, item.Type)
		ids = append(ids, item.ID)
	}
	return types, ids, nil
}

func restoreAdminSanction(ctx context.Context, tx pgx.Tx, item adminSanctionForRevoke) error {
	var tag pgconn.CommandTag
	var err error
	switch item.Type {
	case domain.AdminInboxSanctionRejectListing:
		var previous adminListingSanctionState
		if err := json.Unmarshal(item.PreviousState, &previous); err != nil {
			return err
		}
		tag, err = tx.Exec(ctx, `
			UPDATE house SET status=$2,rejection_reason=$3,updated_at=now()
			WHERE id=$1 AND deleted=false AND status='rejected'
			  AND rejection_reason=left($4,2000)`,
			item.TargetID, previous.Status, previous.RejectionReason, item.AppliedReason)
	case domain.AdminInboxSanctionHideReview:
		var previous adminReviewSanctionState
		if err := json.Unmarshal(item.PreviousState, &previous); err != nil {
			return err
		}
		tag, err = tx.Exec(ctx, `
			UPDATE review
			SET status=$2,published_body=$3,rejection_reason=$4,moderated_at=$5,updated_at=now()
			WHERE id=$1 AND status='rejected' AND published_body IS NULL
			  AND rejection_reason=left($6,500)`,
			item.TargetID, previous.Status, previous.PublishedBody, previous.RejectionReason,
			previous.ModeratedAt, item.AppliedReason)
		if err == nil && tag.RowsAffected() == 1 {
			_, err = tx.Exec(ctx, `
				INSERT INTO review_summary_job(house_id)
				SELECT house_id FROM review WHERE id=$1
				ON CONFLICT(house_id) DO UPDATE
				SET status='queued',run_after=now(),updated_at=now()`, item.TargetID)
		}
	case domain.AdminInboxSanctionHideMessage:
		var previous adminMessageSanctionState
		if err := json.Unmarshal(item.PreviousState, &previous); err != nil {
			return err
		}
		tag, err = tx.Exec(ctx, `
			UPDATE message SET deleted_at=$2
			WHERE id=$1 AND deleted_at IS NOT NULL`, item.TargetID, previous.DeletedAt)
	case domain.AdminInboxSanctionDisableUser:
		var previous adminUserSanctionState
		if err := json.Unmarshal(item.PreviousState, &previous); err != nil {
			return err
		}
		tag, err = tx.Exec(ctx, `
			UPDATE "user" SET enable=$2,public_profile_visible=$3,updated_at=now()
			WHERE id=$1 AND deleted=false AND enable=false`,
			item.TargetID, previous.Enabled, previous.PublicProfileVisible)
		if err == nil && tag.RowsAffected() == 1 && previous.AdminEnabled != nil {
			_, err = tx.Exec(ctx, `
				UPDATE admin_account SET enabled=$2,updated_at=now()
				WHERE user_id=$1 AND role<>'owner'`, item.TargetID, *previous.AdminEnabled)
		}
	default:
		return domain.ErrAdminActionConflict
	}
	if err != nil {
		return err
	}
	if tag.RowsAffected() != 1 {
		return domain.ErrAdminActionConflict
	}
	return nil
}

func containsAdminSanction(sanctions []string, wanted string) bool {
	for _, sanction := range sanctions {
		if sanction == wanted {
			return true
		}
	}
	return false
}

func applyAdminListingAction(ctx context.Context, tx pgx.Tx, action domain.AdminInboxAction) (domain.AdminInboxActionResult, error) {
	var status, contentHash string
	var ownerID int32
	if err := tx.QueryRow(ctx, `
		SELECT h.status, h.owner_id,
		       COALESCE((
		         SELECT mv.content_hash FROM moderation_verdict mv
		         WHERE mv.house_id=h.id
		         ORDER BY mv.created_at DESC,mv.id DESC LIMIT 1
		       ), md5(h.id::text || ':' || COALESCE(h.description,'')) || md5(COALESCE(h.city,'') || ':' || COALESCE(h.street,'')))
		FROM house h
		WHERE h.id=$1 AND h.deleted=false
		FOR UPDATE`, action.ID).Scan(&status, &ownerID, &contentHash); err != nil {
		return domain.AdminInboxActionResult{}, mapAdminActionReadError(err)
	}
	if status != domain.HouseStatusModerationReview {
		return domain.AdminInboxActionResult{}, domain.ErrAdminActionConflict
	}

	decision, next, reason := domain.ModerationApprove, domain.HouseStatusActive, ""
	if action.Action == domain.AdminInboxActionReject {
		decision, next, reason = domain.ModerationReject, domain.HouseStatusRejected, action.Reason
	} else if action.Action != domain.AdminInboxActionApprove {
		return domain.AdminInboxActionResult{}, domain.ErrAdminActionConflict
	}
	if _, err := tx.Exec(ctx, `
		INSERT INTO moderation_verdict (
		  house_id,content_hash,source,decision,category,reason,confidence,
		  raw_response,moderator_id,status,created_at,updated_at
		) VALUES ($1,$2,'human',$3,'manual_review',NULLIF($4,''),1,
		          jsonb_build_object('admin_account_id',$5),$6,'done',now(),now())`,
		action.ID, contentHash, decision, reason, action.ActorAdminID, action.ActorUserID); err != nil {
		return domain.AdminInboxActionResult{}, err
	}
	if _, err := tx.Exec(ctx, `
		UPDATE house SET status=$2,rejection_reason=NULLIF(left($3,2000),''),updated_at=now()
		WHERE id=$1`, action.ID, next, reason); err != nil {
		return domain.AdminInboxActionResult{}, err
	}
	return domain.AdminInboxActionResult{Kind: action.Kind, ID: action.ID, Status: next, SubjectUserID: &ownerID}, nil
}

func applyAdminReviewAction(ctx context.Context, tx pgx.Tx, action domain.AdminInboxAction, reply bool) (domain.AdminInboxActionResult, error) {
	var status string
	var ownerID int32
	if !reply {
		if err := tx.QueryRow(ctx, `SELECT status,owner_id FROM review WHERE id=$1 FOR UPDATE`, action.ID).Scan(&status, &ownerID); err != nil {
			return domain.AdminInboxActionResult{}, mapAdminActionReadError(err)
		}
	} else if err := tx.QueryRow(ctx, `SELECT status,owner_id FROM review_reply WHERE id=$1 FOR UPDATE`, action.ID).Scan(&status, &ownerID); err != nil {
		return domain.AdminInboxActionResult{}, mapAdminActionReadError(err)
	}
	if status != domain.HouseStatusModerationReview {
		return domain.AdminInboxActionResult{}, domain.ErrAdminActionConflict
	}

	next, reason := "active", ""
	if action.Action == domain.AdminInboxActionReject {
		next, reason = "rejected", action.Reason
	} else if action.Action != domain.AdminInboxActionApprove {
		return domain.AdminInboxActionResult{}, domain.ErrAdminActionConflict
	}
	if !reply {
		if _, err := tx.Exec(ctx, `
			UPDATE review
			SET status=$2,
			    published_body=CASE WHEN $2='active' THEN COALESCE(original_body,body) ELSE NULL END,
			    rejection_reason=NULLIF(left($3,500),''),moderated_at=now(),updated_at=now()
			WHERE id=$1`, action.ID, next, reason); err != nil {
			return domain.AdminInboxActionResult{}, err
		}
		if next == "active" {
			if _, err := tx.Exec(ctx, `
				INSERT INTO review_summary_job(house_id)
				SELECT house_id FROM review WHERE id=$1
				ON CONFLICT(house_id) DO UPDATE
				SET status='queued',run_after=LEAST(now()+interval '5 minutes',review_summary_job.dirty_since+interval '30 minutes'),updated_at=now()`, action.ID); err != nil {
				return domain.AdminInboxActionResult{}, err
			}
		}
	} else if _, err := tx.Exec(ctx, `
		UPDATE review_reply
		SET status=$2,
		    published_body=CASE WHEN $2='active' THEN original_body ELSE NULL END,
		    rejection_reason=NULLIF(left($3,500),''),moderated_at=now(),updated_at=now()
		WHERE id=$1`, action.ID, next, reason); err != nil {
		return domain.AdminInboxActionResult{}, err
	}
	return domain.AdminInboxActionResult{Kind: action.Kind, ID: action.ID, Status: next, SubjectUserID: &ownerID}, nil
}

func applyAdminAttachmentAction(ctx context.Context, tx pgx.Tx, action domain.AdminInboxAction) (domain.AdminInboxActionResult, error) {
	if action.Action != domain.AdminInboxActionRetry {
		return domain.AdminInboxActionResult{}, domain.ErrAdminActionConflict
	}
	var attachmentStatus, jobStatus string
	var senderID *int32
	if err := tx.QueryRow(ctx, `
		SELECT ma.moderation_status,m.sender_id,job.status
		FROM message_attachment ma
		JOIN message m ON m.id=ma.message_id
		JOIN attachment_moderation_job job ON job.attachment_id=ma.id
		WHERE ma.id=$1
		FOR UPDATE OF ma,job`, action.ID).Scan(&attachmentStatus, &senderID, &jobStatus); err != nil {
		return domain.AdminInboxActionResult{}, mapAdminActionReadError(err)
	}
	if attachmentStatus != "failed" || jobStatus != "done" {
		return domain.AdminInboxActionResult{}, domain.ErrAdminActionConflict
	}
	if _, err := tx.Exec(ctx, `
		UPDATE message_attachment SET moderation_status='pending',moderation_reason=NULL WHERE id=$1`, action.ID); err != nil {
		return domain.AdminInboxActionResult{}, err
	}
	if _, err := tx.Exec(ctx, `
		UPDATE attachment_moderation_job
		SET status='queued',attempts=0,next_attempt_at=now(),decision=NULL,category=NULL,reason=NULL,
		    confidence=NULL,frames_checked=NULL,last_error=NULL,updated_at=now()
		WHERE attachment_id=$1`, action.ID); err != nil {
		return domain.AdminInboxActionResult{}, err
	}
	return domain.AdminInboxActionResult{Kind: action.Kind, ID: action.ID, Status: "pending", SubjectUserID: senderID}, nil
}

func mapAdminActionReadError(err error) error {
	if errors.Is(err, pgx.ErrNoRows) {
		return domain.ErrNotFound
	}
	return err
}

type adminInboxScanner interface {
	Scan(dest ...any) error
}

func scanAdminInboxItem(row adminInboxScanner) (domain.AdminInboxItem, error) {
	var item domain.AdminInboxItem
	err := row.Scan(
		&item.Kind, &item.ID, &item.SubjectUserID, &item.Status, &item.Title,
		&item.Summary, &item.Reason, &item.Attempts, &item.CreatedAt, &item.UpdatedAt,
	)
	return item, err
}

func scanAdminInboxDetail(row adminInboxScanner) (domain.AdminInboxDetail, error) {
	var detail domain.AdminInboxDetail
	err := row.Scan(
		&detail.Item.Kind, &detail.Item.ID, &detail.Item.SubjectUserID,
		&detail.Item.Status, &detail.Item.Title, &detail.Item.Summary,
		&detail.Item.Reason, &detail.Item.Attempts, &detail.Item.CreatedAt,
		&detail.Item.UpdatedAt, &detail.Evidence, &detail.Context,
	)
	return detail, err
}

func validAdminJSON(value json.RawMessage) json.RawMessage {
	if len(value) == 0 || !json.Valid(value) {
		return json.RawMessage(`{}`)
	}
	return value
}

func (r *AdminInboxRepo) getAdminReport(ctx context.Context, id int64) (domain.AdminInboxDetail, error) {
	return scanAdminInboxDetail(r.pool.QueryRow(ctx, `
		SELECT 'report', ar.id, ar.reported_user_id, ar.status,
		       'Жалоба: ' || ar.target_type || ' #' || ar.target_id::text,
		       left(COALESCE(NULLIF(ar.details,''), ar.reason), 240), ar.reason, 0,
		       ar.created_at, ar.updated_at, ar.evidence,
		       jsonb_strip_nulls(jsonb_build_object(
		         'reporter_user_id', ar.reporter_user_id,
		         'reported_user_id', ar.reported_user_id,
		         'target_type', ar.target_type,
		         'target_id', ar.target_id,
		         'details', ar.details,
		         'source', ar.source,
		         'app_version', ar.app_version,
		         'ip_address', host(ar.ip_address),
		         'user_agent', ar.user_agent
		       ))
		FROM abuse_report ar
		WHERE ar.id=$1`, id))
}

func (r *AdminInboxRepo) getAdminListing(ctx context.Context, id int64) (domain.AdminInboxDetail, error) {
	return scanAdminInboxDetail(r.pool.QueryRow(ctx, `
		SELECT 'listing', h.id::bigint, h.owner_id, h.status,
		       COALESCE(NULLIF(trim(concat_ws(' ', h.street, h.house_number)), ''), 'Объявление #' || h.id::text),
		       left(COALESCE(h.description,''), 240),
		       COALESCE(NULLIF(mv.reason,''), NULLIF(h.rejection_reason,''), ''),
		       COALESCE(mv.attempts,0), h.created_at AT TIME ZONE 'UTC', h.updated_at AT TIME ZONE 'UTC',
		       jsonb_build_object(
		         'listing_id', h.id, 'owner_id', h.owner_id,
		         'owner_name', COALESCE(NULLIF(trim(concat_ws(' ',u.name,u.surname)),''),'Пользователь'),
		         'owner_email', COALESCE(u.email,''), 'city', COALESCE(h.city,''),
		         'street', h.street, 'house_number', h.house_number,
		         'description', COALESCE(h.description,''), 'price', h.price,
		         'rooms', COALESCE(h.count_room,''), 'area', h.area,
		         'max_guests', h.max_guests,
		         'categories', COALESCE((SELECT jsonb_agg(c.name ORDER BY c.name) FROM house_house_category hc JOIN house_category c ON c.id=hc.house_category_id WHERE hc.house_id=h.id),'[]'::jsonb),
		         'services', COALESCE((SELECT jsonb_agg(s.name ORDER BY s.name) FROM house_house_service hs JOIN service s ON s.id=hs.service_id WHERE hs.house_id=h.id),'[]'::jsonb),
		         'photos', COALESCE((SELECT jsonb_agg(jsonb_build_object('id',f.id,'path',f.path,'position',f.position) ORDER BY f.position,f.id) FROM file f WHERE f.house_id=h.id AND f.deleted=false),'[]'::jsonb)
		       ),
		       jsonb_strip_nulls(jsonb_build_object(
		         'verdict_id', mv.id, 'source', mv.source, 'decision', mv.decision,
		         'category', mv.category, 'reason', mv.reason,
		         'confidence', mv.confidence, 'status', mv.status,
		         'attempts', mv.attempts, 'last_error', mv.last_error,
		         'raw_response', mv.raw_response
		       ))
		FROM house h
		JOIN "user" u ON u.id=h.owner_id
		LEFT JOIN LATERAL (
		  SELECT v.* FROM moderation_verdict v
		  WHERE v.house_id=h.id ORDER BY v.created_at DESC,v.id DESC LIMIT 1
		) mv ON true
		WHERE h.id=$1 AND h.status='moderation_review' AND h.deleted=false`, id))
}

func (r *AdminInboxRepo) getAdminReview(ctx context.Context, id int64, reply bool) (domain.AdminInboxDetail, error) {
	if !reply {
		return scanAdminInboxDetail(r.pool.QueryRow(ctx, `
			SELECT 'review', rv.id::bigint, rv.owner_id, rv.status,
			       'Отзыв к объявлению #' || rv.house_id::text,
			       left(COALESCE(rv.original_body,rv.body,''),240), COALESCE(job.reason,''),
			       COALESCE(job.attempts,0), rv.created_at AT TIME ZONE 'UTC',
			       COALESCE(rv.updated_at,rv.created_at AT TIME ZONE 'UTC'),
			       jsonb_build_object(
			         'review_id',rv.id,'house_id',rv.house_id,'author_id',rv.owner_id,
			         'author_name',COALESCE(NULLIF(trim(concat_ws(' ',u.name,u.surname)),''),'Пользователь'),
			         'rating',rv.rating,'body',COALESCE(rv.original_body,rv.body,''),
			         'listing_address',trim(concat_ws(' ',h.city,h.street,h.house_number))
			       ),
			       jsonb_strip_nulls(jsonb_build_object(
			         'job_id',job.id,'detected_categories',job.detected_categories,
			         'masked_body',job.masked_body,'decision',job.decision,
			         'category',job.category,'reason',job.reason,'confidence',job.confidence,
			         'raw_response',job.raw_response,'last_error',job.last_error,'attempts',job.attempts
			       ))
			FROM review rv
			JOIN "user" u ON u.id=rv.owner_id
			JOIN house h ON h.id=rv.house_id
			LEFT JOIN LATERAL (
			  SELECT j.* FROM review_moderation_job j
			  WHERE j.target_type='review' AND j.target_id=rv.id
			  ORDER BY j.created_at DESC,j.id DESC LIMIT 1
			) job ON true
			WHERE rv.id=$1 AND rv.status='moderation_review'`, id))
	}
	return scanAdminInboxDetail(r.pool.QueryRow(ctx, `
		SELECT 'review_reply', rp.id, rp.owner_id, rp.status,
		       'Ответ владельца на отзыв #' || rp.review_id::text,
		       left(COALESCE(rp.original_body,''),240), COALESCE(job.reason,''),
		       COALESCE(job.attempts,0), rp.created_at, rp.updated_at,
		       jsonb_build_object(
		         'reply_id',rp.id,'review_id',rp.review_id,'house_id',rv.house_id,
		         'author_id',rp.owner_id,
		         'author_name',COALESCE(NULLIF(trim(concat_ws(' ',u.name,u.surname)),''),'Пользователь'),
		         'body',rp.original_body,'review_body',COALESCE(rv.original_body,rv.body,''),
		         'listing_address',trim(concat_ws(' ',h.city,h.street,h.house_number))
		       ),
		       jsonb_strip_nulls(jsonb_build_object(
		         'job_id',job.id,'detected_categories',job.detected_categories,
		         'masked_body',job.masked_body,'decision',job.decision,
		         'category',job.category,'reason',job.reason,'confidence',job.confidence,
		         'raw_response',job.raw_response,'last_error',job.last_error,'attempts',job.attempts
		       ))
		FROM review_reply rp
		JOIN review rv ON rv.id=rp.review_id
		JOIN house h ON h.id=rv.house_id
		JOIN "user" u ON u.id=rp.owner_id
		LEFT JOIN LATERAL (
		  SELECT j.* FROM review_moderation_job j
		  WHERE j.target_type='reply' AND j.target_id=rp.id
		  ORDER BY j.created_at DESC,j.id DESC LIMIT 1
		) job ON true
		WHERE rp.id=$1 AND rp.status='moderation_review'`, id))
}

func (r *AdminInboxRepo) getAdminAttachment(ctx context.Context, id int64) (domain.AdminInboxDetail, error) {
	return scanAdminInboxDetail(r.pool.QueryRow(ctx, `
		SELECT 'attachment', ma.id, m.sender_id, ma.moderation_status,
		       COALESCE(NULLIF(ma.file_name,''),'Вложение #' || ma.id::text),
		       concat_ws(' · ',COALESCE(NULLIF(ma.mime_type,''),'Файл'),CASE WHEN COALESCE(ma.size_bytes,0)>0 THEN ma.size_bytes::text || ' байт' END),
		       COALESCE(NULLIF(ma.moderation_reason,''),NULLIF(job.last_error,''),''),
		       COALESCE(job.attempts,0), ma.created_at, COALESCE(job.updated_at,ma.created_at),
		       jsonb_build_object(
		         'attachment_id',ma.id,'message_id',ma.message_id,'conversation_id',m.conversation_id,
		         'sender_id',m.sender_id,'message_body',COALESCE(m.body,''),
		         'file_name',COALESCE(ma.file_name,''),'mime_type',COALESCE(ma.mime_type,''),
		         'size_bytes',COALESCE(ma.size_bytes,0),'width',ma.width,'height',ma.height,
		         'url',ma.url,'thumbnail_url',ma.thumbnail_url
		       ),
		       jsonb_strip_nulls(jsonb_build_object(
		         'job_id',job.id,'kind',job.kind,'object_key',job.object_key,
		         'decision',job.decision,'category',job.category,'reason',job.reason,
		         'confidence',job.confidence,'frames_checked',job.frames_checked,
		         'attempts',job.attempts,'last_error',job.last_error
		       ))
		FROM message_attachment ma
		JOIN message m ON m.id=ma.message_id
		LEFT JOIN attachment_moderation_job job ON job.attachment_id=ma.id
		WHERE ma.id=$1 AND ma.moderation_status='failed'`, id))
}

func (r *AdminInboxRepo) getAdminSearchUser(ctx context.Context, id int64) (domain.AdminInboxDetail, error) {
	return scanAdminInboxDetail(r.pool.QueryRow(ctx, `
		SELECT 'user',u.id::bigint,u.id,
		       CASE WHEN u.deleted THEN 'deleted' WHEN NOT u.enable THEN 'disabled' ELSE 'active' END,
		       COALESCE(NULLIF(trim(concat_ws(' ',u.name,u.surname)),''),'Пользователь #' || u.id::text),
		       concat_ws(' · ',NULLIF(u.email,''),NULLIF(u.phone,''),NULLIF(u.city,'')),
		       '',0,u.created_at AT TIME ZONE 'UTC',u.updated_at AT TIME ZONE 'UTC',
		       jsonb_build_object('user_id',u.id), '{}'::jsonb
		FROM "user" u
		WHERE u.id=$1`, id))
}

func (r *AdminInboxRepo) getAdminSearchListing(ctx context.Context, id int64) (domain.AdminInboxDetail, error) {
	return scanAdminInboxDetail(r.pool.QueryRow(ctx, `
		SELECT 'listing',h.id::bigint,h.owner_id,
		       CASE WHEN h.deleted THEN 'deleted' ELSE h.status END,
		       COALESCE(NULLIF(trim(concat_ws(' ',h.street,h.house_number)),''),'Объявление #' || h.id::text),
		       left(COALESCE(h.description,''),240),COALESCE(h.rejection_reason,''),
		       COALESCE(mv.attempts,0),h.created_at AT TIME ZONE 'UTC',h.updated_at AT TIME ZONE 'UTC',
		       jsonb_build_object(
		         'listing_id',h.id,'owner_id',h.owner_id,
		         'owner_name',COALESCE(NULLIF(trim(concat_ws(' ',u.name,u.surname)),''),'Пользователь'),
		         'owner_email',COALESCE(u.email,''),'deleted',h.deleted,'city',COALESCE(h.city,''),
		         'street',h.street,'house_number',h.house_number,'description',COALESCE(h.description,''),
		         'price',h.price,'rooms',COALESCE(h.count_room,''),'area',h.area,'max_guests',h.max_guests,
		         'categories',COALESCE((SELECT jsonb_agg(c.name ORDER BY c.name) FROM house_house_category hc JOIN house_category c ON c.id=hc.house_category_id WHERE hc.house_id=h.id),'[]'::jsonb),
		         'services',COALESCE((SELECT jsonb_agg(s.name ORDER BY s.name) FROM house_house_service hs JOIN service s ON s.id=hs.service_id WHERE hs.house_id=h.id),'[]'::jsonb)
		       ),
		       jsonb_strip_nulls(jsonb_build_object(
		         'verdict_id',mv.id,'source',mv.source,'decision',mv.decision,'category',mv.category,
		         'reason',mv.reason,'confidence',mv.confidence,'status',mv.status,
		         'attempts',mv.attempts,'last_error',mv.last_error,'raw_response',mv.raw_response
		       ))
		FROM house h
		JOIN "user" u ON u.id=h.owner_id
		LEFT JOIN LATERAL (
		  SELECT v.* FROM moderation_verdict v
		  WHERE v.house_id=h.id ORDER BY v.created_at DESC,v.id DESC LIMIT 1
		) mv ON true
		WHERE h.id=$1`, id))
}

func (r *AdminInboxRepo) getAdminSearchReview(ctx context.Context, id int64) (domain.AdminInboxDetail, error) {
	return scanAdminInboxDetail(r.pool.QueryRow(ctx, `
		SELECT 'review',rv.id::bigint,rv.owner_id,rv.status,
		       'Отзыв к объявлению #' || rv.house_id::text,
		       left(COALESCE(rv.original_body,rv.body,''),240),COALESCE(rv.rejection_reason,''),
		       COALESCE(job.attempts,0),rv.created_at AT TIME ZONE 'UTC',
		       COALESCE(rv.updated_at,rv.created_at AT TIME ZONE 'UTC'),
		       jsonb_build_object(
		         'review_id',rv.id,'house_id',rv.house_id,'author_id',rv.owner_id,
		         'author_name',COALESCE(NULLIF(trim(concat_ws(' ',u.name,u.surname)),''),'Пользователь'),
		         'rating',rv.rating,'body',COALESCE(rv.original_body,rv.body,''),
		         'published_body',rv.published_body,'rejection_reason',rv.rejection_reason,
		         'listing_address',trim(concat_ws(' ',h.city,h.street,h.house_number))
		       ),
		       jsonb_strip_nulls(jsonb_build_object(
		         'job_id',job.id,'detected_categories',job.detected_categories,'masked_body',job.masked_body,
		         'decision',job.decision,'category',job.category,'reason',job.reason,
		         'confidence',job.confidence,'raw_response',job.raw_response,
		         'last_error',job.last_error,'attempts',job.attempts
		       ))
		FROM review rv
		JOIN "user" u ON u.id=rv.owner_id
		JOIN house h ON h.id=rv.house_id
		LEFT JOIN LATERAL (
		  SELECT j.* FROM review_moderation_job j
		  WHERE j.target_type='review' AND j.target_id=rv.id
		  ORDER BY j.created_at DESC,j.id DESC LIMIT 1
		) job ON true
		WHERE rv.id=$1`, id))
}

func (r *AdminInboxRepo) getAdminSearchMessage(ctx context.Context, id int64) (domain.AdminInboxDetail, error) {
	return scanAdminInboxDetail(r.pool.QueryRow(ctx, `
		SELECT 'message',m.id,m.sender_id,
		       CASE WHEN m.deleted_at IS NULL THEN 'active' ELSE 'hidden' END,
		       'Сообщение #' || m.id::text,
		       left(COALESCE(NULLIF(m.body,''),'Сообщение без текста'),240),'',0,
		       m.created_at,COALESCE(m.edited_at,m.created_at),
		       jsonb_strip_nulls(jsonb_build_object(
		         'message_id',m.id,'conversation_id',m.conversation_id,'sender_id',m.sender_id,
		         'kind',m.kind,'body',m.body,'reply_to_message_id',m.reply_to_message_id,
		         'edited_at',m.edited_at,'deleted_at',m.deleted_at,
		         'listing_id',c.house_id
		       )),
		       jsonb_build_object(
		         'participant_user_ids',COALESCE((
		           SELECT jsonb_agg(cp.user_id ORDER BY cp.user_id)
		           FROM conversation_participant cp WHERE cp.conversation_id=m.conversation_id
		         ),'[]'::jsonb),
		         'attachments_total',(SELECT count(*) FROM message_attachment ma WHERE ma.message_id=m.id)
		       )
		FROM message m
		JOIN conversation c ON c.id=m.conversation_id
		WHERE m.id=$1`, id))
}

var _ domain.AdminInboxRepository = (*AdminInboxRepo)(nil)
