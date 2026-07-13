package postgres

import (
	"context"
	"errors"
	"time"

	"github.com/TrollLOLik/sutki/backend/internal/domain"
	"github.com/TrollLOLik/sutki/backend/internal/repository/postgres/sqlc"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// ReviewRepo implements domain.ReviewRepository on top of sqlc-generated queries.
type ReviewRepo struct {
	q    *sqlc.Queries
	pool *pgxpool.Pool
}

func NewReviewRepo(pool *pgxpool.Pool, q *sqlc.Queries) *ReviewRepo {
	return &ReviewRepo{q: q, pool: pool}
}

func (r *ReviewRepo) HouseExists(ctx context.Context, houseID int32) (bool, error) {
	return r.q.HouseExists(ctx, houseID)
}

func (r *ReviewRepo) ListByHouse(ctx context.Context, houseID, limit, offset int32) ([]domain.Review, error) {
	rows, err := r.q.ListReviewsByHouse(ctx, sqlc.ListReviewsByHouseParams{
		HouseID:      houseID,
		ResultLimit:  limit,
		ResultOffset: offset,
	})
	if err != nil {
		return nil, err
	}
	out := make([]domain.Review, 0, len(rows))
	for _, row := range rows {
		out = append(out, domain.Review{
			ID:              row.ID,
			HouseID:         row.HouseID,
			AuthorID:        row.AuthorID,
			AuthorName:      row.AuthorName,
			AuthorAvatarURL: row.AuthorAvatarUrl,
			Rating:          row.Rating,
			Body:            row.Body,
			Status:          "active",
			CreatedAt:       row.CreatedAt.Time,
		})
	}
	if err := r.attachReplies(ctx, out); err != nil {
		return nil, err
	}
	return out, nil
}

func (r *ReviewRepo) CountByHouse(ctx context.Context, houseID int32) (int64, error) {
	return r.q.CountReviewsByHouse(ctx, houseID)
}

func (r *ReviewRepo) Summary(ctx context.Context, houseID int32) (domain.RatingSummary, error) {
	row, err := r.q.ReviewSummaryByHouse(ctx, houseID)
	if err != nil {
		return domain.RatingSummary{}, err
	}
	return domain.RatingSummary{
		Average:      row.Average,
		Total:        row.Total,
		Distribution: [5]int32{row.Count1, row.Count2, row.Count3, row.Count4, row.Count5},
	}, nil
}

func (r *ReviewRepo) Create(ctx context.Context, nr domain.NewReview) (domain.Review, error) {
	id, err := r.q.CreateReview(ctx, sqlc.CreateReviewParams{
		OwnerID: nr.AuthorID,
		HouseID: nr.HouseID,
		Body:    nr.Body,
		Rating:  nr.Rating,
	})
	if err != nil {
		return domain.Review{}, err
	}
	row, err := r.q.GetReviewByID(ctx, id)
	if err != nil {
		return domain.Review{}, err
	}
	return domain.Review{
		ID:              row.ID,
		HouseID:         row.HouseID,
		AuthorID:        row.AuthorID,
		AuthorName:      row.AuthorName,
		AuthorAvatarURL: row.AuthorAvatarUrl,
		Rating:          row.Rating,
		Body:            row.Body,
		Status:          row.Status,
		RejectionReason: row.RejectionReason,
		RequestID:       row.RequestID,
		CreatedAt:       row.CreatedAt.Time,
	}, nil
}

func (r *ReviewRepo) ListByAuthor(ctx context.Context, userID, limit, offset int32) ([]domain.Review, error) {
	rows, err := r.q.ListReviewsByAuthor(ctx, sqlc.ListReviewsByAuthorParams{
		OwnerID:      userID,
		ResultLimit:  limit,
		ResultOffset: offset,
	})
	if err != nil {
		return nil, err
	}
	out := make([]domain.Review, 0, len(rows))
	for _, row := range rows {
		out = append(out, domain.Review{
			ID:              row.ID,
			HouseID:         row.HouseID,
			AuthorID:        row.AuthorID,
			Rating:          row.Rating,
			Body:            row.Body,
			Status:          row.Status,
			RejectionReason: row.RejectionReason,
			RequestID:       row.RequestID,
			CreatedAt:       row.CreatedAt.Time,
			HouseStreet:     row.HouseStreet,
			HouseNumber:     row.HouseNumber,
			HouseCity:       row.HouseCity,
			HouseCoverPath:  row.HouseCoverPath,
		})
	}
	if err := r.attachReplies(ctx, out); err != nil {
		return nil, err
	}
	return out, nil
}

func (r *ReviewRepo) Eligibility(ctx context.Context, requestID, userID int32) (domain.ReviewEligibility, error) {
	var e domain.ReviewEligibility
	var checkout time.Time
	err := r.pool.QueryRow(ctx, `
		SELECT 
			rq.id, 
			rq.house_id, 
			COALESCE(rq.end_date, rq.start_date+1), 
			rv.id, 
			COALESCE(rv.status, ''), 
			rq.status IN ('confirmed','active') AND (rv.id IS NULL OR (rv.status IN ('rejected','moderation_review') AND COALESCE(rv.edit_attempts,0) < 3)) AND CURRENT_DATE>=COALESCE(rq.end_date,rq.start_date+1) AND CURRENT_DATE<COALESCE(rq.end_date,rq.start_date+1)+90,
			rv.rating,
			COALESCE(rv.original_body, rv.body, ''),
			COALESCE(rv.rejection_reason, ''),
			COALESCE(rv.edit_attempts, 0)
		FROM request rq 
		LEFT JOIN review rv ON rv.request_id=rq.id 
		WHERE rq.id=$1 AND rq.user_id=$2`, requestID, userID).Scan(
			&e.RequestID, &e.HouseID, &checkout, &e.ReviewID, &e.ReviewStatus, &e.CanReview,
			&e.ReviewRating, &e.ReviewBody, &e.RejectionReason, &e.EditAttempts,
		)
	if errors.Is(err, pgx.ErrNoRows) {
		return e, domain.ErrReviewNotAllowed
	}
	if err != nil {
		return e, err
	}
	e.MaxAttempts = 3
	e.ReviewDeadline = checkout.AddDate(0, 0, 90)
	return e, nil
}

func (r *ReviewRepo) ListEligibility(ctx context.Context, userID int32) ([]domain.ReviewEligibility, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT 
			rq.id, 
			rq.house_id, 
			COALESCE(rq.end_date, rq.start_date+1), 
			rv.id, 
			COALESCE(rv.status, ''), 
			(rv.id IS NULL OR (rv.status IN ('rejected','moderation_review') AND COALESCE(rv.edit_attempts,0) < 3)) AND CURRENT_DATE>=COALESCE(rq.end_date,rq.start_date+1) AND CURRENT_DATE<COALESCE(rq.end_date,rq.start_date+1)+90,
			rv.rating,
			COALESCE(rv.original_body, rv.body, ''),
			COALESCE(rv.rejection_reason, ''),
			COALESCE(rv.edit_attempts, 0)
		FROM request rq 
		LEFT JOIN review rv ON rv.request_id=rq.id 
		WHERE rq.user_id=$1 AND rq.status IN ('confirmed','active') 
		ORDER BY rq.id DESC`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []domain.ReviewEligibility
	for rows.Next() {
		var e domain.ReviewEligibility
		var checkout time.Time
		if err := rows.Scan(
			&e.RequestID, &e.HouseID, &checkout, &e.ReviewID, &e.ReviewStatus, &e.CanReview,
			&e.ReviewRating, &e.ReviewBody, &e.RejectionReason, &e.EditAttempts,
		); err != nil {
			return nil, err
		}
		e.MaxAttempts = 3
		e.ReviewDeadline = checkout.AddDate(0, 0, 90)
		out = append(out, e)
	}
	return out, rows.Err()
}

func (r *ReviewRepo) CountByAuthor(ctx context.Context, userID int32) (int64, error) {
	return r.q.CountReviewsByAuthor(ctx, userID)
}

func (r *ReviewRepo) ListForHost(ctx context.Context, userID, limit, offset int32) ([]domain.Review, error) {
	rows, err := r.q.ListReviewsForHost(ctx, sqlc.ListReviewsForHostParams{
		OwnerID:      userID,
		ResultLimit:  limit,
		ResultOffset: offset,
	})
	if err != nil {
		return nil, err
	}
	out := make([]domain.Review, 0, len(rows))
	for _, row := range rows {
		out = append(out, domain.Review{
			ID:              row.ID,
			HouseID:         row.HouseID,
			AuthorID:        row.AuthorID,
			AuthorName:      row.AuthorName,
			AuthorAvatarURL: row.AuthorAvatarUrl,
			Rating:          row.Rating,
			Body:            row.Body,
			CreatedAt:       row.CreatedAt.Time,
			HouseStreet:     row.HouseStreet,
			HouseNumber:     row.HouseNumber,
			HouseCity:       row.HouseCity,
			HouseCoverPath:  row.HouseCoverPath,
		})
	}
	if err := r.attachReplies(ctx, out); err != nil {
		return nil, err
	}
	return out, nil
}

func (r *ReviewRepo) attachReplies(ctx context.Context, reviews []domain.Review) error {
	if len(reviews) == 0 {
		return nil
	}
	ids := make([]int32, len(reviews))
	positions := make(map[int32]int, len(reviews))
	for i, review := range reviews {
		ids[i] = review.ID
		positions[review.ID] = i
	}
	rows, err := r.pool.Query(ctx, `SELECT id,review_id,owner_id,COALESCE(published_body,''),status,COALESCE(rejection_reason,''),created_at FROM review_reply WHERE review_id=ANY($1) AND status='active'`, ids)
	if err != nil {
		return err
	}
	defer rows.Close()
	for rows.Next() {
		var reply domain.ReviewReply
		if err := rows.Scan(&reply.ID, &reply.ReviewID, &reply.OwnerID, &reply.Body, &reply.Status, &reply.RejectionReason, &reply.CreatedAt); err != nil {
			return err
		}
		if pos, ok := positions[reply.ReviewID]; ok {
			reviews[pos].Reply = &reply
		}
	}
	return rows.Err()
}

func (r *ReviewRepo) CountForHost(ctx context.Context, userID int32) (int64, error) {
	return r.q.CountReviewsForHost(ctx, userID)
}

func (r *ReviewRepo) SummaryForHost(ctx context.Context, ownerID int32) (domain.RatingSummary, error) {
	row, err := r.q.ReviewSummaryForHost(ctx, ownerID)
	if err != nil {
		return domain.RatingSummary{}, err
	}
	return domain.RatingSummary{
		Average:      row.Average,
		Total:        row.Total,
		Distribution: [5]int32{row.Count1, row.Count2, row.Count3, row.Count4, row.Count5},
	}, nil
}
