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

// nonNil returns an empty (non-nil) slice so it encodes as a PostgreSQL
// empty array `{}` rather than NULL, keeping `cardinality(...) = 0` valid.
func nonNil(ids []int32) []int32 {
	if ids == nil {
		return []int32{}
	}
	return ids
}

func (r *ListingRepo) List(ctx context.Context, filter domain.ListFilter) ([]domain.House, error) {
	rows, err := r.q.ListHousesFiltered(ctx, sqlc.ListHousesFilteredParams{
		Query:        filter.Query,
		City:         filter.City,
		PriceMin:     filter.PriceMin,
		PriceMax:     filter.PriceMax,
		Rooms:        nonNil(filter.Rooms),
		RoomsMin:     filter.RoomsMin,
		Services:     nonNil(filter.Services),
		Category:     filter.Category,
		Sort:         string(filter.Sort),
		ResultLimit:  filter.Limit,
		ResultOffset: filter.Offset,
	})
	if err != nil {
		return nil, err
	}
	houses := make([]domain.House, 0, len(rows))
	for _, row := range rows {
		houses = append(houses, domain.House{
			ID:           row.ID,
			Street:       row.Street,
			HouseNumber:  row.HouseNumber,
			Description:  row.Description,
			Price:        row.Price,
			CountRoom:    row.CountRoom,
			Area:         row.Area,
			City:         row.Country,
			Status:       row.Status,
			Lat:          row.Lat,
			Lng:          row.Lng,
			Views:        row.Views,
			CoverPath:    row.CoverPath,
			CreatedAt:    row.CreatedAt.Time,
			Rating:       row.Rating,
			ReviewsCount: row.ReviewsCount,
		})
	}
	return houses, nil
}

// Create inserts a new listing (status='active') and links its services and
// categories. Photos are not persisted yet (S3 media phase). Returns the new id.
func (r *ListingRepo) Create(ctx context.Context, h domain.NewHouse) (int32, error) {
	id, err := r.q.CreateHouse(ctx, sqlc.CreateHouseParams{
		OwnerID:     h.OwnerID,
		Street:      h.Street,
		HouseNumber: h.HouseNumber,
		Description: h.Description,
		Price:       h.Price,
		CountRoom:   h.CountRoom,
		NumberRoom:  h.NumberRoom,
		Area:        h.Area,
		Country:     h.City,
		Lat:         h.Lat,
		Lng:         h.Lng,
	})
	if err != nil {
		return 0, err
	}
	for _, sid := range h.ServiceIDs {
		if err := r.q.AddHouseService(ctx, sqlc.AddHouseServiceParams{HouseID: id, ServiceID: sid}); err != nil {
			return 0, err
		}
	}
	for _, cid := range h.CategoryIDs {
		if err := r.q.AddHouseCategory(ctx, sqlc.AddHouseCategoryParams{HouseID: id, HouseCategoryID: cid}); err != nil {
			return 0, err
		}
	}
	return id, nil
}

func (r *ListingRepo) ListByOwner(ctx context.Context, ownerID, limit, offset int32) ([]domain.House, error) {
	rows, err := r.q.ListHousesByOwner(ctx, sqlc.ListHousesByOwnerParams{
		OwnerID:      ownerID,
		ResultLimit:  limit,
		ResultOffset: offset,
	})
	if err != nil {
		return nil, err
	}
	houses := make([]domain.House, 0, len(rows))
	for _, row := range rows {
		houses = append(houses, domain.House{
			ID:           row.ID,
			OwnerID:      ownerID,
			Street:       row.Street,
			HouseNumber:  row.HouseNumber,
			Description:  row.Description,
			Price:        row.Price,
			CountRoom:    row.CountRoom,
			Area:         row.Area,
			City:         row.Country,
			Status:       row.Status,
			Lat:          row.Lat,
			Lng:          row.Lng,
			Views:        row.Views,
			CoverPath:    row.CoverPath,
			CreatedAt:    row.CreatedAt.Time,
			Rating:       row.Rating,
			ReviewsCount: row.ReviewsCount,
		})
	}
	return houses, nil
}

func (r *ListingRepo) CountByOwner(ctx context.Context, ownerID int32) (int64, error) {
	return r.q.CountHousesByOwner(ctx, ownerID)
}

func (r *ListingRepo) Count(ctx context.Context, filter domain.ListFilter) (int64, error) {
	return r.q.CountHousesFiltered(ctx, sqlc.CountHousesFilteredParams{
		Query:    filter.Query,
		City:     filter.City,
		PriceMin: filter.PriceMin,
		PriceMax: filter.PriceMax,
		Rooms:    nonNil(filter.Rooms),
		RoomsMin: filter.RoomsMin,
		Services: nonNil(filter.Services),
		Category: filter.Category,
	})
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
		ID:           row.ID,
		OwnerID:      row.OwnerID,
		Street:       row.Street,
		HouseNumber:  row.HouseNumber,
		Description:  row.Description,
		Price:        row.Price,
		CountRoom:    row.CountRoom,
		Area:         row.Area,
		City:         row.Country,
		Status:       row.Status,
		Lat:          row.Lat,
		Lng:          row.Lng,
		Views:        row.Views,
		CreatedAt:    row.CreatedAt.Time,
		UpdatedAt:    row.UpdatedAt.Time,
		Rating:       row.Rating,
		ReviewsCount: row.ReviewsCount,
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

func (r *ListingRepo) AllServices(ctx context.Context) ([]domain.Ref, error) {
	rows, err := r.q.ListAllServices(ctx)
	if err != nil {
		return nil, err
	}
	refs := make([]domain.Ref, 0, len(rows))
	for _, row := range rows {
		refs = append(refs, domain.Ref{ID: row.ID, Name: row.Name})
	}
	return refs, nil
}

func (r *ListingRepo) AllCategories(ctx context.Context) ([]domain.Ref, error) {
	rows, err := r.q.ListAllCategories(ctx)
	if err != nil {
		return nil, err
	}
	refs := make([]domain.Ref, 0, len(rows))
	for _, row := range rows {
		refs = append(refs, domain.Ref{ID: row.ID, Name: row.Name})
	}
	return refs, nil
}
