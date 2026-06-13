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

// List returns a page of active listings. Limit is clamped to [1, maxLimit].
func (s *Service) List(ctx context.Context, limit, offset int32) (ListResult, error) {
	if limit <= 0 {
		limit = defaultLimit
	}
	if limit > maxLimit {
		limit = maxLimit
	}
	if offset < 0 {
		offset = 0
	}
	items, err := s.repo.ListActive(ctx, limit, offset)
	if err != nil {
		return ListResult{}, err
	}
	total, err := s.repo.CountActive(ctx)
	if err != nil {
		return ListResult{}, err
	}
	return ListResult{Items: items, Total: total, Limit: limit, Offset: offset}, nil
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
