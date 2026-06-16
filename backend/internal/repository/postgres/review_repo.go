package postgres

import (
	"context"

	"github.com/TrollLOLik/sutki/backend/internal/domain"
	"github.com/TrollLOLik/sutki/backend/internal/repository/postgres/sqlc"
)

// ReviewRepo implements domain.ReviewRepository on top of sqlc-generated queries.
type ReviewRepo struct {
	q *sqlc.Queries
}

func NewReviewRepo(q *sqlc.Queries) *ReviewRepo {
	return &ReviewRepo{q: q}
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
			CreatedAt:       row.CreatedAt.Time,
		})
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
		CreatedAt:       row.CreatedAt.Time,
	}, nil
}
