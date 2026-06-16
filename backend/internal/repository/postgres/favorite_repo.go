package postgres

import (
	"context"

	"github.com/TrollLOLik/sutki/backend/internal/domain"
	"github.com/TrollLOLik/sutki/backend/internal/repository/postgres/sqlc"
)

// FavoriteRepo implements domain.FavoriteRepository on top of sqlc-generated queries.
type FavoriteRepo struct {
	q *sqlc.Queries
}

func NewFavoriteRepo(q *sqlc.Queries) *FavoriteRepo {
	return &FavoriteRepo{q: q}
}

func (r *FavoriteRepo) HouseExists(ctx context.Context, houseID int32) (bool, error) {
	return r.q.HouseExists(ctx, houseID)
}

func (r *FavoriteRepo) Add(ctx context.Context, userID, houseID int32) error {
	return r.q.AddFavorite(ctx, sqlc.AddFavoriteParams{UserID: userID, HouseID: houseID})
}

func (r *FavoriteRepo) Remove(ctx context.Context, userID, houseID int32) error {
	return r.q.RemoveFavorite(ctx, sqlc.RemoveFavoriteParams{UserID: userID, HouseID: houseID})
}

func (r *FavoriteRepo) ListHouses(ctx context.Context, userID, limit, offset int32) ([]domain.House, error) {
	rows, err := r.q.ListFavoriteHouses(ctx, sqlc.ListFavoriteHousesParams{
		UserID:       userID,
		ResultLimit:  limit,
		ResultOffset: offset,
	})
	if err != nil {
		return nil, err
	}
	houses := make([]domain.House, 0, len(rows))
	for _, row := range rows {
		houses = append(houses, domain.House{
			ID:          row.ID,
			Street:      row.Street,
			HouseNumber: row.HouseNumber,
			Description: row.Description,
			Price:       row.Price,
			CountRoom:   row.CountRoom,
			Area:        row.Area,
			City:        row.Country,
			Status:      row.Status,
			Lat:         row.Lat,
			Lng:         row.Lng,
			Views:       row.Views,
			CoverPath:   row.CoverPath,
			CreatedAt:   row.CreatedAt.Time,
		})
	}
	return houses, nil
}

func (r *FavoriteRepo) CountHouses(ctx context.Context, userID int32) (int64, error) {
	return r.q.CountFavoriteHouses(ctx, userID)
}

func (r *FavoriteRepo) ListIDs(ctx context.Context, userID int32) ([]int32, error) {
	ids, err := r.q.ListFavoriteIDs(ctx, userID)
	if err != nil {
		return nil, err
	}
	if ids == nil {
		return []int32{}, nil
	}
	return ids, nil
}
