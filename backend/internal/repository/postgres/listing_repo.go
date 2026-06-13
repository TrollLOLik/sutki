package postgres

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"

	"github.com/TrollLOLik/sutki/backend/internal/domain"
	"github.com/TrollLOLik/sutki/backend/internal/repository/postgres/sqlc"
)

// ListingRepo implements domain.ListingRepository on top of sqlc-generated queries.
type ListingRepo struct {
	q *sqlc.Queries
}

func NewListingRepo(q *sqlc.Queries) *ListingRepo {
	return &ListingRepo{q: q}
}

func (r *ListingRepo) ListActive(ctx context.Context, limit, offset int32) ([]domain.House, error) {
	rows, err := r.q.ListActiveHouses(ctx, sqlc.ListActiveHousesParams{Limit: limit, Offset: offset})
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

func (r *ListingRepo) CountActive(ctx context.Context) (int64, error) {
	return r.q.CountActiveHouses(ctx)
}

func (r *ListingRepo) GetByID(ctx context.Context, id int32) (domain.House, error) {
	row, err := r.q.GetHouseByID(ctx, id)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return domain.House{}, domain.ErrNotFound
		}
		return domain.House{}, err
	}
	h := domain.House{
		ID:          row.ID,
		OwnerID:     row.OwnerID,
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
		CreatedAt:   row.CreatedAt.Time,
		UpdatedAt:   row.UpdatedAt.Time,
	}
	if row.NumberRoom != nil {
		h.NumberRoom = *row.NumberRoom
	}
	return h, nil
}

func (r *ListingRepo) ListPhotos(ctx context.Context, houseID int32) ([]domain.Photo, error) {
	rows, err := r.q.ListHousePhotos(ctx, &houseID)
	if err != nil {
		return nil, err
	}
	photos := make([]domain.Photo, 0, len(rows))
	for _, row := range rows {
		photos = append(photos, domain.Photo{ID: row.ID, Path: row.Path, Position: row.Position})
	}
	return photos, nil
}

func (r *ListingRepo) ListServices(ctx context.Context, houseID int32) ([]domain.Ref, error) {
	rows, err := r.q.ListHouseServices(ctx, houseID)
	if err != nil {
		return nil, err
	}
	refs := make([]domain.Ref, 0, len(rows))
	for _, row := range rows {
		refs = append(refs, domain.Ref{ID: row.ID, Name: row.Name})
	}
	return refs, nil
}

func (r *ListingRepo) ListCategories(ctx context.Context, houseID int32) ([]domain.Ref, error) {
	rows, err := r.q.ListHouseCategories(ctx, houseID)
	if err != nil {
		return nil, err
	}
	refs := make([]domain.Ref, 0, len(rows))
	for _, row := range rows {
		refs = append(refs, domain.Ref{ID: row.ID, Name: row.Name})
	}
	return refs, nil
}
