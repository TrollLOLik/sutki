package postgres

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"path/filepath"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"

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

func (r *ListingRepo) ListMapClusters(ctx context.Context) ([]domain.MapCluster, error) {
	rows, err := r.q.ListMapClusters(ctx)
	if err != nil {
		return nil, err
	}
	clusters := make([]domain.MapCluster, 0, len(rows))
	for _, row := range rows {
		clusters = append(clusters, domain.MapCluster{
			City:  row.City,
			Lat:   row.Lat,
			Lng:   row.Lng,
			Count: row.ListingCount,
		})
	}
	return clusters, nil
}

// nonNil returns an empty (non-nil) slice so it encodes as a PostgreSQL
// empty array `{}` rather than NULL, keeping `cardinality(...) = 0` valid.
func nonNil(ids []int32) []int32 {
	if ids == nil {
		return []int32{}
	}
	return ids
}

func pgTimePtr(s *string) pgtype.Time {
	if s == nil || *s == "" {
		return pgtype.Time{Valid: false}
	}
	parts := strings.Split(*s, ":")
	if len(parts) < 2 {
		return pgtype.Time{Valid: false}
	}
	var hours, minutes int64
	fmt.Sscanf(parts[0], "%d", &hours)
	fmt.Sscanf(parts[1], "%d", &minutes)
	usec := (hours*3600 + minutes*60) * 1000000
	return pgtype.Time{
		Microseconds: usec,
		Valid:        true,
	}
}

func pgTimeToStringPtr(pgTime pgtype.Time) *string {
	if !pgTime.Valid {
		return nil
	}
	totalSeconds := pgTime.Microseconds / 1000000
	hours := totalSeconds / 3600
	minutes := (totalSeconds % 3600) / 60
	str := fmt.Sprintf("%02d:%02d", hours, minutes)
	return &str
}

func (r *ListingRepo) List(ctx context.Context, filter domain.ListFilter) ([]domain.House, error) {
	rows, err := r.q.ListHousesFiltered(ctx, sqlc.ListHousesFilteredParams{
		HouseIds:        nonNil(filter.HouseIDs),
		Query:           filter.Query,
		City:            filter.City,
		PriceMin:        filter.PriceMin,
		PriceMax:        filter.PriceMax,
		Rooms:           nonNil(filter.Rooms),
		RoomsMin:        filter.RoomsMin,
		Services:        nonNil(filter.Services),
		Category:        filter.Category,
		CheckIn:         dateParamPtr(filter.CheckIn),
		CheckOut:        dateParamPtr(filter.CheckOut),
		Guests:          filter.Guests,
		PetsAllowed:     filter.PetsAllowed,
		ChildrenAllowed: filter.ChildrenAllowed,
		EventsAllowed:   filter.EventsAllowed,
		MinLat:          filter.MinLat,
		MaxLat:          filter.MaxLat,
		MinLng:          filter.MinLng,
		MaxLng:          filter.MaxLng,
		Sort:            string(filter.Sort),
		ResultLimit:     filter.Limit,
		ResultOffset:    filter.Offset,
	})
	if err != nil {
		return nil, err
	}
	houses := make([]domain.House, 0, len(rows))
	for _, row := range rows {
		promotionExpiresAt := parseDBTimestamp(row.PromotionExpiresAt)
		houses = append(houses, domain.House{
			ID:                 row.ID,
			OwnerID:            row.OwnerID,
			Street:             row.Street,
			HouseNumber:        row.HouseNumber,
			Description:        row.Description,
			Price:              row.Price,
			CountRoom:          row.CountRoom,
			Area:               row.Area,
			City:               row.Country,
			Status:             row.Status,
			MaxGuests:          row.MaxGuests,
			Lat:                row.Lat,
			Lng:                row.Lng,
			QcGeo:              row.QcGeo,
			Views:              row.Views,
			CoverPath:          row.CoverPath,
			CheckInAfter:       pgTimeToStringPtr(row.CheckInAfter),
			CheckOutBefore:     pgTimeToStringPtr(row.CheckOutBefore),
			SmokingAllowed:     row.SmokingAllowed,
			PetsAllowed:        row.PetsAllowed,
			ChildrenAllowed:    row.ChildrenAllowed,
			EventsAllowed:      row.EventsAllowed,
			CreatedAt:          row.CreatedAt.Time,
			Rating:             row.Rating,
			ReviewsCount:       row.ReviewsCount,
			PromotionTypes:     row.PromotionTypes,
			PromotionExpiresAt: promotionExpiresAt,
		})
	}
	return houses, nil
}

// Create inserts a new listing (status='active') and links its services and
// categories. Photos are not persisted yet (S3 media phase). Returns the new id.
func (r *ListingRepo) Create(ctx context.Context, h domain.NewHouse) (int32, error) {
	poisBytes, _ := json.Marshal(h.POIs)
	if poisBytes == nil {
		poisBytes = []byte("[]")
	}

	id, err := r.q.CreateHouse(ctx, sqlc.CreateHouseParams{
		OwnerID:         h.OwnerID,
		Street:          h.Street,
		HouseNumber:     h.HouseNumber,
		Description:     h.Description,
		Price:           h.Price,
		CountRoom:       h.CountRoom,
		NumberRoom:      h.NumberRoom,
		Area:            h.Area,
		Country:         h.City,
		Lat:             h.Lat,
		Lng:             h.Lng,
		QcGeo:           h.QcGeo,
		MaxGuests:       h.MaxGuests,
		CheckInAfter:    pgTimePtr(h.CheckInAfter),
		CheckOutBefore:  pgTimePtr(h.CheckOutBefore),
		SmokingAllowed:  h.SmokingAllowed,
		PetsAllowed:     h.PetsAllowed,
		ChildrenAllowed: h.ChildrenAllowed,
		EventsAllowed:   h.EventsAllowed,
		Pois:            poisBytes,
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
	for i, path := range h.Photos {
		name := filepath.Base(path)
		format := strings.TrimPrefix(filepath.Ext(path), ".")
		err := r.q.AddHousePhoto(ctx, sqlc.AddHousePhotoParams{
			HouseID:  &id,
			Name:     name,
			Size:     nil,
			Format:   format,
			Path:     path,
			Position: int32(i),
		})
		if err != nil {
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
		promotionExpiresAt := parseDBTimestamp(row.PromotionExpiresAt)
		houses = append(houses, domain.House{
			ID:                 row.ID,
			OwnerID:            ownerID,
			Street:             row.Street,
			HouseNumber:        row.HouseNumber,
			Description:        row.Description,
			Price:              row.Price,
			CountRoom:          row.CountRoom,
			Area:               row.Area,
			City:               row.Country,
			Status:             row.Status,
			RejectionReason:    row.RejectionReason,
			MaxGuests:          row.MaxGuests,
			Lat:                row.Lat,
			Lng:                row.Lng,
			QcGeo:              row.QcGeo,
			Views:              row.Views,
			CoverPath:          row.CoverPath,
			CheckInAfter:       pgTimeToStringPtr(row.CheckInAfter),
			CheckOutBefore:     pgTimeToStringPtr(row.CheckOutBefore),
			SmokingAllowed:     row.SmokingAllowed,
			PetsAllowed:        row.PetsAllowed,
			ChildrenAllowed:    row.ChildrenAllowed,
			EventsAllowed:      row.EventsAllowed,
			CreatedAt:          row.CreatedAt.Time,
			Rating:             row.Rating,
			ReviewsCount:       row.ReviewsCount,
			PromotionTypes:     row.PromotionTypes,
			PromotionExpiresAt: promotionExpiresAt,
		})
	}
	return houses, nil
}

func (r *ListingRepo) CountByOwner(ctx context.Context, ownerID int32) (int64, error) {
	return r.q.CountHousesByOwner(ctx, ownerID)
}

func (r *ListingRepo) Count(ctx context.Context, filter domain.ListFilter) (int64, error) {
	return r.q.CountHousesFiltered(ctx, sqlc.CountHousesFilteredParams{
		HouseIds:        nonNil(filter.HouseIDs),
		Query:           filter.Query,
		City:            filter.City,
		PriceMin:        filter.PriceMin,
		PriceMax:        filter.PriceMax,
		Rooms:           nonNil(filter.Rooms),
		RoomsMin:        filter.RoomsMin,
		Services:        nonNil(filter.Services),
		Category:        filter.Category,
		CheckIn:         dateParamPtr(filter.CheckIn),
		CheckOut:        dateParamPtr(filter.CheckOut),
		Guests:          filter.Guests,
		PetsAllowed:     filter.PetsAllowed,
		ChildrenAllowed: filter.ChildrenAllowed,
		EventsAllowed:   filter.EventsAllowed,
		MinLat:          filter.MinLat,
		MaxLat:          filter.MaxLat,
		MinLng:          filter.MinLng,
		MaxLng:          filter.MaxLng,
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
		ID:                 row.ID,
		OwnerID:            row.OwnerID,
		OwnerName:          stringFromPtr(row.OwnerName),
		OwnerSurname:       stringFromPtr(row.OwnerSurname),
		OwnerPatronymic:    stringFromPtr(row.OwnerPatronymic),
		OwnerPhone:         stringFromPtr(row.OwnerPhone),
		OwnerAvatarURL:     stringFromPtr(row.OwnerAvatarUrl),
		OwnerRating:        row.OwnerRating,
		OwnerReviewsCount:  row.OwnerReviewsCount,
		OwnerListingsCount: row.OwnerListingsCount,
		OwnerIsVerified:    row.OwnerIsVerified,
		Street:             row.Street,
		HouseNumber:        row.HouseNumber,
		Description:        row.Description,
		Price:              row.Price,
		CountRoom:          row.CountRoom,
		Area:               row.Area,
		City:               row.Country,
		Status:             row.Status,
		RejectionReason:    row.RejectionReason,
		MaxGuests:          row.MaxGuests,
		Lat:                row.Lat,
		Lng:                row.Lng,
		QcGeo:              row.QcGeo,
		Views:              row.Views,
		CheckInAfter:       pgTimeToStringPtr(row.CheckInAfter),
		CheckOutBefore:     pgTimeToStringPtr(row.CheckOutBefore),
		SmokingAllowed:     row.SmokingAllowed,
		PetsAllowed:        row.PetsAllowed,
		ChildrenAllowed:    row.ChildrenAllowed,
		EventsAllowed:      row.EventsAllowed,
		CreatedAt:          row.CreatedAt.Time,
		UpdatedAt:          row.UpdatedAt.Time,
		ReviewsSummary:     row.ReviewsSummary,
		LocationSummary:    row.LocationSummary,
		Rating:             row.Rating,
		ReviewsCount:       row.ReviewsCount,
		PromotionTypes:     row.PromotionTypes,
		PromotionExpiresAt: parseDBTimestamp(row.PromotionExpiresAt),
	}
	if len(row.Pois) > 0 {
		if err := json.Unmarshal(row.Pois, &h.POIs); err != nil {
			return domain.House{}, fmt.Errorf("decode house POIs: %w", err)
		}
	}
	if row.NumberRoom != nil {
		h.NumberRoom = *row.NumberRoom
	}
	return h, nil
}

func parseDBTimestamp(value string) *time.Time {
	if value == "" {
		return nil
	}
	for _, layout := range []string{time.RFC3339Nano, "2006-01-02 15:04:05.999999999Z07:00", "2006-01-02 15:04:05.999999999Z07"} {
		if parsed, err := time.Parse(layout, value); err == nil {
			return &parsed
		}
	}
	return nil
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

// Update edits an existing listing owned by h.OwnerID. It returns
// domain.ErrNotFound when no listing matches (missing or not owned), so the
// caller can answer 404 instead of silently reporting success.
func (r *ListingRepo) Update(ctx context.Context, id int32, h domain.NewHouse) error {
	poisBytes, _ := json.Marshal(h.POIs)
	if poisBytes == nil {
		poisBytes = []byte("[]")
	}

	affected, err := r.q.UpdateHouse(ctx, sqlc.UpdateHouseParams{
		Street:          h.Street,
		HouseNumber:     h.HouseNumber,
		Description:     h.Description,
		Price:           h.Price,
		CountRoom:       h.CountRoom,
		NumberRoom:      h.NumberRoom,
		Area:            h.Area,
		Country:         h.City,
		Lat:             h.Lat,
		Lng:             h.Lng,
		QcGeo:           h.QcGeo,
		MaxGuests:       h.MaxGuests,
		CheckInAfter:    pgTimePtr(h.CheckInAfter),
		CheckOutBefore:  pgTimePtr(h.CheckOutBefore),
		SmokingAllowed:  h.SmokingAllowed,
		PetsAllowed:     h.PetsAllowed,
		ChildrenAllowed: h.ChildrenAllowed,
		EventsAllowed:   h.EventsAllowed,
		ID:              id,
		OwnerID:         h.OwnerID,
		Pois:            poisBytes,
	})
	if err != nil {
		return err
	}
	if affected == 0 {
		return domain.ErrNotFound
	}

	if err := r.q.DeleteHouseServices(ctx, id); err != nil {
		return err
	}
	for _, serviceID := range h.ServiceIDs {
		if err := r.q.AddHouseService(ctx, sqlc.AddHouseServiceParams{HouseID: id, ServiceID: serviceID}); err != nil {
			return err
		}
	}

	if err := r.q.DeleteHouseCategories(ctx, id); err != nil {
		return err
	}
	for _, categoryID := range h.CategoryIDs {
		if err := r.q.AddHouseCategory(ctx, sqlc.AddHouseCategoryParams{HouseID: id, HouseCategoryID: categoryID}); err != nil {
			return err
		}
	}

	if err := r.q.SoftDeleteHousePhotos(ctx, &id); err != nil {
		return err
	}
	for i, path := range h.Photos {
		name := filepath.Base(path)
		format := strings.TrimPrefix(filepath.Ext(path), ".")
		err := r.q.AddHousePhoto(ctx, sqlc.AddHousePhotoParams{
			HouseID:  &id,
			Name:     name,
			Size:     nil,
			Format:   format,
			Path:     path,
			Position: int32(i),
		})
		if err != nil {
			return err
		}
	}

	return nil
}

// UserHasConfirmedBooking implements domain.ListingRepository.
func (r *ListingRepo) UserHasConfirmedBooking(ctx context.Context, userID, houseID int32) (bool, error) {
	return r.q.UserHasConfirmedBookingForHouse(ctx, sqlc.UserHasConfirmedBookingForHouseParams{
		UserID:  &userID,
		HouseID: &houseID,
	})
}

// UpdateReviewsSummary implements domain.ListingRepository.
func (r *ListingRepo) UpdateReviewsSummary(ctx context.Context, id int32, summary *string) error {
	return r.q.UpdateHouseReviewsSummary(ctx, sqlc.UpdateHouseReviewsSummaryParams{
		ID:             id,
		ReviewsSummary: summary,
	})
}

// UpdateLocationSummary implements domain.ListingRepository.
func (r *ListingRepo) UpdateLocationSummary(ctx context.Context, id int32, summary *string) error {
	return r.q.UpdateHouseLocationSummary(ctx, sqlc.UpdateHouseLocationSummaryParams{
		ID:              id,
		LocationSummary: summary,
	})
}

func stringFromPtr(s *string) string {
	if s == nil {
		return ""
	}
	return *s
}
