package listing

import (
	"context"

	"github.com/TrollLOLik/sutki/backend/internal/domain"
)

const (
	defaultLimit int32 = 20
	maxLimit     int32 = 100
)

// Service implements listing read use cases over a ListingRepository.
type Service struct {
	repo domain.ListingRepository
}

func New(repo domain.ListingRepository) *Service {
	return &Service{repo: repo}
}

// ListResult is a page of active listings plus pagination metadata.
type ListResult struct {
	Items  []domain.House
	Total  int64
	Limit  int32
	Offset int32
}

// List returns a filtered page of active listings. Limit is clamped to
// [1, maxLimit] and offset to [0, ∞). The filter is applied server-side.
func (s *Service) List(ctx context.Context, filter domain.ListFilter) (ListResult, error) {
	if filter.Limit <= 0 {
		filter.Limit = defaultLimit
	}
	if filter.Limit > maxLimit {
		filter.Limit = maxLimit
	}
	if filter.Offset < 0 {
		filter.Offset = 0
	}
	items, err := s.repo.List(ctx, filter)
	if err != nil {
		return ListResult{}, err
	}
	total, err := s.repo.Count(ctx, filter)
	if err != nil {
		return ListResult{}, err
	}
	return ListResult{Items: items, Total: total, Limit: filter.Limit, Offset: filter.Offset}, nil
}

// Services returns the catalog of amenities usable as listing filters.
func (s *Service) Services(ctx context.Context) ([]domain.Ref, error) {
	return s.repo.AllServices(ctx)
}

// Categories returns the catalog of listing categories usable as filters.
func (s *Service) Categories(ctx context.Context) ([]domain.Ref, error) {
	return s.repo.AllCategories(ctx)
}

// Get returns a single listing with its photos, services and categories.
func (s *Service) Get(ctx context.Context, id int32) (domain.House, error) {
	house, err := s.repo.GetByID(ctx, id)
	if err != nil {
		return domain.House{}, err
	}
	if house.Photos, err = s.repo.ListPhotos(ctx, id); err != nil {
		return domain.House{}, err
	}
	if house.Services, err = s.repo.ListServices(ctx, id); err != nil {
		return domain.House{}, err
	}
	if house.Categories, err = s.repo.ListCategories(ctx, id); err != nil {
		return domain.House{}, err
	}
	return house, nil
}
