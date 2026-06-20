package review

import (
	"context"
	"strings"
	"unicode/utf8"

	"github.com/TrollLOLik/sutki/backend/internal/domain"
)

const (
	defaultLimit int32 = 20
	maxLimit     int32 = 100
	// maxBodyLen mirrors the legacy `review.body` varchar(1500) limit.
	maxBodyLen = 1500
)

// Service implements the listing reviews use cases.
type Service struct {
	repo domain.ReviewRepository
}

func New(repo domain.ReviewRepository) *Service {
	return &Service{repo: repo}
}

// ListResult is a page of a listing's reviews plus the rating summary.
type ListResult struct {
	Items   []domain.Review
	Summary domain.RatingSummary
	Total   int64
	Limit   int32
	Offset  int32
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

// List returns a page of houseID's published reviews plus the rating summary
// (average, count, star distribution). The listing must exist.
func (s *Service) List(ctx context.Context, houseID, limit, offset int32) (ListResult, error) {
	exists, err := s.repo.HouseExists(ctx, houseID)
	if err != nil {
		return ListResult{}, err
	}
	if !exists {
		return ListResult{}, domain.ErrNotFound
	}
	limit, offset = clamp(limit, offset)
	items, err := s.repo.ListByHouse(ctx, houseID, limit, offset)
	if err != nil {
		return ListResult{}, err
	}
	total, err := s.repo.CountByHouse(ctx, houseID)
	if err != nil {
		return ListResult{}, err
	}
	summary, err := s.repo.Summary(ctx, houseID)
	if err != nil {
		return ListResult{}, err
	}
	return ListResult{Items: items, Summary: summary, Total: total, Limit: limit, Offset: offset}, nil
}

// Create validates and stores a review authored by r.AuthorID for r.HouseID.
// Rating must be 1..5 and the body non-empty; the listing must exist.
func (s *Service) Create(ctx context.Context, r domain.NewReview) (domain.Review, error) {
	r.Body = strings.TrimSpace(r.Body)
	if r.Rating < 1 || r.Rating > 5 || r.Body == "" || utf8.RuneCountInString(r.Body) > maxBodyLen {
		return domain.Review{}, domain.ErrInvalidReview
	}
	exists, err := s.repo.HouseExists(ctx, r.HouseID)
	if err != nil {
		return domain.Review{}, err
	}
	if !exists {
		return domain.Review{}, domain.ErrNotFound
	}
	return s.repo.Create(ctx, r)
}

// UserReviewsResult is a page of reviews left by a user or received by a host.
type UserReviewsResult struct {
	Items  []domain.Review `json:"items"`
	Total  int64           `json:"total"`
	Limit  int32           `json:"limit"`
	Offset int32           `json:"offset"`
}

func (s *Service) ListByAuthor(ctx context.Context, userID, limit, offset int32) (UserReviewsResult, error) {
	limit, offset = clamp(limit, offset)
	items, err := s.repo.ListByAuthor(ctx, userID, limit, offset)
	if err != nil {
		return UserReviewsResult{}, err
	}
	total, err := s.repo.CountByAuthor(ctx, userID)
	if err != nil {
		return UserReviewsResult{}, err
	}
	return UserReviewsResult{Items: items, Total: total, Limit: limit, Offset: offset}, nil
}

func (s *Service) ListForHost(ctx context.Context, userID, limit, offset int32) (UserReviewsResult, error) {
	limit, offset = clamp(limit, offset)
	items, err := s.repo.ListForHost(ctx, userID, limit, offset)
	if err != nil {
		return UserReviewsResult{}, err
	}
	total, err := s.repo.CountForHost(ctx, userID)
	if err != nil {
		return UserReviewsResult{}, err
	}
	return UserReviewsResult{Items: items, Total: total, Limit: limit, Offset: offset}, nil
}

