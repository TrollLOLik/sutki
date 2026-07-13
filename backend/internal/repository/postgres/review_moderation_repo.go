package postgres

import (
	"context"
	"encoding/json"
	"errors"
	"time"

	"github.com/TrollLOLik/sutki/backend/internal/domain"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
)

func (r *ReviewRepo) CreatePending(ctx context.Context, in domain.NewReview, contentHash, maskedBody string, categories []string) (domain.Review, error) {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return domain.Review{}, err
	}
	defer tx.Rollback(ctx)

	// 1. Check if the booking is eligible for review
	var houseID, houseOwner int32
	var eligible bool
	err = tx.QueryRow(ctx, `SELECT rq.house_id,h.owner_id,rq.status IN ('confirmed','active') AND CURRENT_DATE>=COALESCE(rq.end_date,rq.start_date+1) AND CURRENT_DATE<COALESCE(rq.end_date,rq.start_date+1)+90 FROM request rq JOIN house h ON h.id=rq.house_id WHERE rq.id=$1 AND rq.user_id=$2 FOR UPDATE OF rq`, in.RequestID, in.AuthorID).Scan(&houseID, &houseOwner, &eligible)
	if errors.Is(err, pgx.ErrNoRows) || !eligible || houseOwner == in.AuthorID {
		return domain.Review{}, domain.ErrReviewNotAllowed
	}
	if err != nil {
		return domain.Review{}, err
	}

	// 2. Check if a review already exists for this request
	var existingID int32
	var existingStatus, existingHash string
	var existingAttempts int32
	var existingCreatedAt time.Time
	exists := true
	err = tx.QueryRow(ctx, `SELECT id, status, content_hash, edit_attempts, created_at FROM review WHERE request_id = $1`, in.RequestID).Scan(&existingID, &existingStatus, &existingHash, &existingAttempts, &existingCreatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		exists = false
	} else if err != nil {
		return domain.Review{}, err
	}

	var out domain.Review
	if exists {
		// Verify if edit is allowed
		if existingStatus != "rejected" && existingStatus != "moderation_review" {
			return domain.Review{}, domain.ErrReviewNotAllowed
		}
		if existingAttempts >= 3 {
			return domain.Review{}, domain.ErrReviewAttemptsExceeded
		}
		if contentHash == existingHash {
			return domain.Review{}, domain.ErrReviewUnchanged
		}

		// Check duplicates (excluding this review itself)
		var duplicate bool
		if err = tx.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM review WHERE owner_id=$1 AND content_hash=$2 AND id != $3 AND status IN ('pending_moderation','active','moderation_review'))`, in.AuthorID, contentHash, existingID).Scan(&duplicate); err != nil {
			return domain.Review{}, err
		}
		if duplicate {
			categories = append(categories, "duplicate")
		}

		categoriesJSON, _ := json.Marshal(categories)
		// Update existing review
		_, err = tx.Exec(ctx, `UPDATE review SET rating = $2, body = $3, original_body = $4, published_body = NULL, status = 'pending_moderation', content_hash = $5, rejection_reason = NULL, edit_attempts = edit_attempts + 1, updated_at = now() WHERE id = $1`, existingID, in.Rating, in.Body, in.Body, contentHash)
		if err != nil {
			return domain.Review{}, err
		}

		// Insert new moderation job
		_, err = tx.Exec(ctx, `INSERT INTO review_moderation_job(target_type,target_id,content_hash,detected_categories,masked_body) VALUES('review',$1,$2,$3,$4)`, existingID, contentHash, categoriesJSON, nullableText(maskedBody))
		if err != nil {
			return domain.Review{}, err
		}

		out.ID = existingID
		out.CreatedAt = existingCreatedAt
	} else {
		// Check duplicates
		var duplicate bool
		if err = tx.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM review WHERE owner_id=$1 AND content_hash=$2 AND status IN ('pending_moderation','active','moderation_review'))`, in.AuthorID, contentHash).Scan(&duplicate); err != nil {
			return domain.Review{}, err
		}
		if duplicate {
			categories = append(categories, "duplicate")
		}

		categoriesJSON, _ := json.Marshal(categories)
		// Insert new review
		err = tx.QueryRow(ctx, `INSERT INTO review(owner_id,house_id,request_id,body,original_body,published_body,rating,status,content_hash,created_at,updated_at) VALUES($1,$2,$3,$4,$5,NULL,$6,'pending_moderation',$7,now(),now()) RETURNING id,created_at`, in.AuthorID, houseID, in.RequestID, in.Body, in.Body, in.Rating, contentHash).Scan(&out.ID, &out.CreatedAt)
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) && pgErr.Code == "23505" {
			return out, domain.ErrReviewNotAllowed
		}
		if err != nil {
			return out, err
		}

		// Insert moderation job
		_, err = tx.Exec(ctx, `INSERT INTO review_moderation_job(target_type,target_id,content_hash,detected_categories,masked_body) VALUES('review',$1,$2,$3,$4)`, out.ID, contentHash, categoriesJSON, nullableText(maskedBody))
		if err != nil {
			return out, err
		}
	}

	if err = tx.Commit(ctx); err != nil {
		return out, err
	}

	out.HouseID = houseID
	out.AuthorID = in.AuthorID
	out.RequestID = &in.RequestID
	out.Rating = in.Rating
	out.Body = in.Body
	out.Status = "pending_moderation"
	return out, nil
}

func (r *ReviewRepo) CreateReply(ctx context.Context, reviewID, ownerID int32, body, contentHash, maskedBody string, categories []string) (domain.ReviewReply, error) {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return domain.ReviewReply{}, err
	}
	defer tx.Rollback(ctx)

	// Verify that the reply is allowed for this owner
	var allowed bool
	err = tx.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM review rv JOIN house h ON h.id=rv.house_id WHERE rv.id=$1 AND rv.status='active' AND h.owner_id=$2)`, reviewID, ownerID).Scan(&allowed)
	if err != nil {
		return domain.ReviewReply{}, err
	}
	if !allowed {
		return domain.ReviewReply{}, domain.ErrReviewNotAllowed
	}

	// Check if a reply already exists for this review
	var existingID int64
	var existingStatus, existingHash string
	var existingAttempts int32
	var existingCreatedAt time.Time
	exists := true
	err = tx.QueryRow(ctx, `SELECT id, status, content_hash, edit_attempts, created_at FROM review_reply WHERE review_id = $1`, reviewID).Scan(&existingID, &existingStatus, &existingHash, &existingAttempts, &existingCreatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		exists = false
	} else if err != nil {
		return domain.ReviewReply{}, err
	}

	var out domain.ReviewReply
	categoriesJSON, _ := json.Marshal(categories)

	if exists {
		// Verify if edit is allowed
		if existingStatus != "rejected" && existingStatus != "moderation_review" {
			return domain.ReviewReply{}, domain.ErrReviewNotAllowed
		}
		if existingAttempts >= 3 {
			return domain.ReviewReply{}, domain.ErrReviewAttemptsExceeded
		}
		if contentHash == existingHash {
			return domain.ReviewReply{}, domain.ErrReviewUnchanged
		}

		// Update existing reply
		_, err = tx.Exec(ctx, `UPDATE review_reply SET original_body = $2, published_body = NULL, status = 'pending_moderation', content_hash = $3, rejection_reason = NULL, edit_attempts = edit_attempts + 1, updated_at = now() WHERE id = $1`, existingID, body, contentHash)
		if err != nil {
			return domain.ReviewReply{}, err
		}

		// Insert new moderation job
		_, err = tx.Exec(ctx, `INSERT INTO review_moderation_job(target_type,target_id,content_hash,detected_categories,masked_body) VALUES('reply',$1,$2,$3,$4)`, existingID, contentHash, categoriesJSON, nullableText(maskedBody))
		if err != nil {
			return domain.ReviewReply{}, err
		}

		out.ID = existingID
		out.CreatedAt = existingCreatedAt
	} else {
		// Insert new reply
		err = tx.QueryRow(ctx, `INSERT INTO review_reply(review_id,owner_id,original_body,status,content_hash) VALUES($1,$2,$3,'pending_moderation',$4) RETURNING id,created_at`, reviewID, ownerID, body, contentHash).Scan(&out.ID, &out.CreatedAt)
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) && pgErr.Code == "23505" {
			return out, domain.ErrReviewNotAllowed
		}
		if err != nil {
			return out, err
		}

		// Insert moderation job
		_, err = tx.Exec(ctx, `INSERT INTO review_moderation_job(target_type,target_id,content_hash,detected_categories,masked_body) VALUES('reply',$1,$2,$3,$4)`, out.ID, contentHash, categoriesJSON, nullableText(maskedBody))
		if err != nil {
			return out, err
		}
	}

	if err = tx.Commit(ctx); err != nil {
		return out, err
	}

	out.ReviewID = reviewID
	out.OwnerID = ownerID
	out.Body = body
	out.Status = "pending_moderation"
	return out, nil
}

func nullableText(value string) any {
	if value == "" {
		return nil
	}
	return value
}

func (r *ReviewRepo) DueModerationJobs(ctx context.Context, limit int32) ([]domain.ReviewModerationJob, error) {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)
	if _, err = tx.Exec(ctx, `UPDATE review_moderation_job SET status='queued',last_error='processing lease expired',updated_at=now() WHERE status='processing' AND updated_at<now()-interval '5 minutes'`); err != nil {
		return nil, err
	}
	rows, err := tx.Query(ctx, `WITH due AS(SELECT id FROM review_moderation_job WHERE status='queued' AND next_attempt_at<=now() ORDER BY id FOR UPDATE SKIP LOCKED LIMIT $1) UPDATE review_moderation_job j SET status='processing',attempts=attempts+1,updated_at=now() FROM due WHERE j.id=due.id RETURNING j.id,j.target_type,j.target_id,j.attempts`, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []domain.ReviewModerationJob
	for rows.Next() {
		var j domain.ReviewModerationJob
		if err := rows.Scan(&j.ID, &j.TargetType, &j.TargetID, &j.Attempts); err != nil {
			return nil, err
		}
		out = append(out, j)
	}
	if err = rows.Err(); err != nil {
		return nil, err
	}
	if err = tx.Commit(ctx); err != nil {
		return nil, err
	}
	return out, nil
}

func (r *ReviewRepo) LoadModerationTarget(ctx context.Context, j domain.ReviewModerationJob) (domain.ReviewModerationTarget, error) {
	var t domain.ReviewModerationTarget
	var categoriesJSON []byte
	if j.TargetType == "review" {
		err := r.pool.QueryRow(ctx, `SELECT 'review',rv.id,rv.id,rv.house_id,rv.owner_id,rv.rating,COALESCE(rv.original_body,rv.body),COALESCE(j.masked_body,''),j.detected_categories FROM review_moderation_job j JOIN review rv ON rv.id=j.target_id WHERE j.id=$1 AND rv.status='pending_moderation'`, j.ID).Scan(&t.TargetType, &t.TargetID, &t.ReviewID, &t.HouseID, &t.AuthorID, &t.Rating, &t.Body, &t.MaskedBody, &categoriesJSON)
		if err != nil {
			return t, err
		}
	} else {
		err := r.pool.QueryRow(ctx, `SELECT 'reply',rp.id,rp.review_id,rv.house_id,rp.owner_id,rv.rating,rp.original_body,COALESCE(j.masked_body,''),j.detected_categories FROM review_moderation_job j JOIN review_reply rp ON rp.id=j.target_id JOIN review rv ON rv.id=rp.review_id WHERE j.id=$1 AND rp.status='pending_moderation'`, j.ID).Scan(&t.TargetType, &t.TargetID, &t.ReviewID, &t.HouseID, &t.AuthorID, &t.Rating, &t.Body, &t.MaskedBody, &categoriesJSON)
		if err != nil {
			return t, err
		}
	}
	_ = json.Unmarshal(categoriesJSON, &t.Categories)
	return t, nil
}

func (r *ReviewRepo) CompleteModeration(ctx context.Context, j domain.ReviewModerationJob, decision, category, reason string, confidence float32, raw []byte) error {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	var original, masked string
	err = tx.QueryRow(ctx, `SELECT CASE WHEN target_type='review' THEN COALESCE((SELECT original_body FROM review WHERE id=target_id),'') ELSE COALESCE((SELECT original_body FROM review_reply WHERE id=target_id),'') END,COALESCE(masked_body,'') FROM review_moderation_job WHERE id=$1 AND status='processing' FOR UPDATE`, j.ID).Scan(&original, &masked)
	if err != nil {
		return err
	}
	status, published := "moderation_review", any(nil)
	switch decision {
	case "approve":
		status = "active"
		published = original
	case "approve_masked":
		if masked != "" && masked != original {
			status = "active"
			published = masked
		} else {
			status = "rejected"
			decision = "reject"
			category = "unsafe_mask"
			reason = "Текст содержит выражения, которые не удалось безопасно скрыть"
		}
	case "reject":
		status = "rejected"
	}
	if j.TargetType == "review" {
		_, err = tx.Exec(ctx, `UPDATE review SET status=$2,published_body=$3,rejection_reason=NULLIF($4,''),moderated_at=now(),updated_at=now() WHERE id=$1 AND status='pending_moderation'`, j.TargetID, status, published, reason)
	} else {
		_, err = tx.Exec(ctx, `UPDATE review_reply SET status=$2,published_body=$3,rejection_reason=NULLIF($4,''),moderated_at=now(),updated_at=now() WHERE id=$1 AND status='pending_moderation'`, j.TargetID, status, published, reason)
	}
	if err != nil {
		return err
	}
	if j.TargetType == "review" && status == "active" {
		var houseID int32
		if err = tx.QueryRow(ctx, `SELECT house_id FROM review WHERE id=$1`, j.TargetID).Scan(&houseID); err != nil {
			return err
		}
		_, err = tx.Exec(ctx, `INSERT INTO review_summary_job(house_id) VALUES($1) ON CONFLICT(house_id) DO UPDATE SET status='queued',run_after=LEAST(now()+interval '5 minutes',review_summary_job.dirty_since+interval '30 minutes'),updated_at=now()`, houseID)
		if err != nil {
			return err
		}
	}
	_, err = tx.Exec(ctx, `UPDATE review_moderation_job SET status='done',decision=$2,category=$3,reason=$4,confidence=$5,raw_response=$6::jsonb,last_error=NULL,updated_at=now() WHERE id=$1`, j.ID, decision, category, reason, confidence, string(raw))
	if err != nil {
		return err
	}
	return tx.Commit(ctx)
}

func (r *ReviewRepo) RetryModeration(ctx context.Context, j domain.ReviewModerationJob, lastError string, next time.Time) error {
	_, err := r.pool.Exec(ctx, `UPDATE review_moderation_job SET status='queued',next_attempt_at=$2,last_error=left($3,1000),updated_at=now() WHERE id=$1`, j.ID, next, lastError)
	return err
}

func (r *ReviewRepo) DueSummaryHouses(ctx context.Context, limit int32) ([]int32, error) {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)
	_, _ = tx.Exec(ctx, `UPDATE review_summary_job SET status='queued',last_error='processing lease expired',updated_at=now() WHERE status='processing' AND updated_at<now()-interval '10 minutes'`)
	rows, err := tx.Query(ctx, `WITH due AS(SELECT house_id FROM review_summary_job WHERE status='queued' AND run_after<=now() ORDER BY run_after FOR UPDATE SKIP LOCKED LIMIT $1) UPDATE review_summary_job j SET status='processing',attempts=attempts+1,updated_at=now() FROM due WHERE j.house_id=due.house_id RETURNING j.house_id`, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []int32
	for rows.Next() {
		var id int32
		if err := rows.Scan(&id); err != nil {
			return nil, err
		}
		out = append(out, id)
	}
	if err = rows.Err(); err != nil {
		return nil, err
	}
	if err = tx.Commit(ctx); err != nil {
		return nil, err
	}
	return out, nil
}
func (r *ReviewRepo) CompleteSummary(ctx context.Context, houseID int32) error {
	_, err := r.pool.Exec(ctx, `DELETE FROM review_summary_job WHERE house_id=$1 AND status='processing'`, houseID)
	return err
}
func (r *ReviewRepo) RetrySummary(ctx context.Context, houseID int32, lastError string, next time.Time) error {
	_, err := r.pool.Exec(ctx, `UPDATE review_summary_job SET status='queued',run_after=$2,last_error=left($3,1000),updated_at=now() WHERE house_id=$1`, houseID, next, lastError)
	return err
}
