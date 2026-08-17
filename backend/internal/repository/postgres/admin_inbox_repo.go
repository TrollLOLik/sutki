package postgres

import (
	"context"
	"encoding/json"
	"errors"

	"github.com/jackc/pgx/v5"
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
	return detail, nil
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

	metadata, err := json.Marshal(map[string]any{"result_status": result.Status})
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
	var status string
	var subjectUserID *int32
	if err := tx.QueryRow(ctx, `
		SELECT status, reported_user_id
		FROM abuse_report
		WHERE id=$1
		FOR UPDATE`, action.ID).Scan(&status, &subjectUserID); err != nil {
		return domain.AdminInboxActionResult{}, mapAdminActionReadError(err)
	}

	next := ""
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
		next = "resolved"
	case domain.AdminInboxActionDismiss:
		if status != "new" && status != "in_review" {
			return domain.AdminInboxActionResult{}, domain.ErrAdminActionConflict
		}
		next = "dismissed"
	default:
		return domain.AdminInboxActionResult{}, domain.ErrAdminActionConflict
	}
	if _, err := tx.Exec(ctx, `UPDATE abuse_report SET status=$2,updated_at=now() WHERE id=$1`, action.ID, next); err != nil {
		return domain.AdminInboxActionResult{}, err
	}
	return domain.AdminInboxActionResult{Kind: action.Kind, ID: action.ID, Status: next, SubjectUserID: subjectUserID}, nil
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

var _ domain.AdminInboxRepository = (*AdminInboxRepo)(nil)
