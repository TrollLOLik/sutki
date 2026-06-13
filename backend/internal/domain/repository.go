package domain

import "context"

// ListingRepository abstracts persistence for rental listings.
type ListingRepository interface {
	ListActive(ctx context.Context, limit, offset int32) ([]House, error)
	CountActive(ctx context.Context) (int64, error)
	GetByID(ctx context.Context, id int32) (House, error)
	ListPhotos(ctx context.Context, houseID int32) ([]Photo, error)
	ListServices(ctx context.Context, houseID int32) ([]Ref, error)
	ListCategories(ctx context.Context, houseID int32) ([]Ref, error)
}
