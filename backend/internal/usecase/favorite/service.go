package favorite

import (
	"context"

	"github.com/TrollLOLik/sutki/backend/internal/domain"
)

const (
	defaultLimit int32 = 20
	maxLimit     int32 = 100
)

// Service implements the favorites (saved listings) use cases.
type Service struct {
	repo domain.FavoriteRepository
}

func New(repo domain.FavoriteRepository) *Service {
	return &Service{repo: repo}
}

// ListResult is a page of favorited listings plus pagination metadata.
type ListResult struct {
	Items  []domain.House
	Total  int64
	Limit  int32
	Offset int32
}

func clamp(limit, offset int32) (int32, int32) {
	if limit <= 0 {
		limit = defaultLimit
	}
	if limit > maxLimit {
		limit = maxLimit
	}
	if offset < 0 {
		offset = 0
	}
	return limit, offset
}

// Add saves houseID to userID's favorites. The listing must exist; the
// operation is idempotent (adding an existing favorite is a no-op).
func (s *Service) Add(ctx context.Context, userID, houseID int32) error {
	exists, err := s.repo.HouseExists(ctx, houseID)
	if err != nil {
		return err
	}
	if !exists {
		return domain.ErrNotFound
	}
	return s.repo.Add(ctx, userID, houseID)
}

// Remove drops houseID from userID's favorites. It is idempotent.
func (s *Service) Remove(ctx context.Context, userID, houseID int32) error {
	return s.repo.Remove(ctx, userID, houseID)
}

// List returns a page of userID's favorited listings (active only), newest first.
func (s *Service) List(ctx context.Context, userID, limit, offset int32) (ListResult, error) {
	limit, offset = clamp(limit, offset)
	items, err := s.repo.ListHouses(ctx, userID, limit, offset)
	if err != nil {
		return ListResult{}, err
	}
	total, err := s.repo.CountHouses(ctx, userID)
	if err != nil {
		return ListResult{}, err
	}
	return ListResult{Items: items, Total: total, Limit: limit, Offset: offset}, nil
}

// IDs returns all house IDs favorited by userID, newest first. It is used by
// clients to render favorite (heart) state across listing screens.
func (s *Service) IDs(ctx context.Context, userID int32) ([]int32, error) {
	return s.repo.ListIDs(ctx, userID)
}
