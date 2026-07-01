package listing

import (
	"context"
	"errors"
	"strings"

	"github.com/TrollLOLik/sutki/backend/internal/domain"
)

const (
	defaultLimit int32 = 20
	maxLimit     int32 = 100
)

// ErrInvalidListing is returned when create input fails validation.
var ErrInvalidListing = errors.New("invalid listing")

// Service implements listing read use cases over a ListingRepository.
type Service struct {
	repo    domain.ListingRepository
	storage domain.FileStorage
}

func New(repo domain.ListingRepository, storage domain.FileStorage) *Service {
	return &Service{repo: repo, storage: storage}
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
	for i := range items {
		items[i] = s.formatHouseMedia(ctx, items[i])
	}
	total, err := s.repo.Count(ctx, filter)
	if err != nil {
		return ListResult{}, err
	}
	return ListResult{Items: items, Total: total, Limit: filter.Limit, Offset: filter.Offset}, nil
}

// Create validates and persists a new listing owned by ownerID, then returns
// the full created listing (with services/categories). Photos are out of scope
// until the media phase. Returns ErrInvalidListing on bad input.
func (s *Service) Create(ctx context.Context, in domain.NewHouse) (domain.House, error) {
	in.Street = strings.TrimSpace(in.Street)
	in.HouseNumber = strings.TrimSpace(in.HouseNumber)
	in.Description = strings.TrimSpace(in.Description)
	in.City = strings.TrimSpace(in.City)
	in.CountRoom = strings.TrimSpace(in.CountRoom)
	if in.NumberRoom != nil {
		trimmed := strings.TrimSpace(*in.NumberRoom)
		in.NumberRoom = &trimmed
	}

	if err := validateAndCleanRules(&in); err != nil {
		return domain.House{}, err
	}

	if in.OwnerID <= 0 {
		return domain.House{}, ErrInvalidListing
	}
	if in.Street == "" || in.HouseNumber == "" || in.City == "" || in.CountRoom == "" {
		return domain.House{}, ErrInvalidListing
	}
	if in.Description == "" {
		return domain.House{}, ErrInvalidListing
	}
	if in.Price <= 0 || in.Area <= 0 {
		return domain.House{}, ErrInvalidListing
	}

	id, err := s.repo.Create(ctx, in)
	if err != nil {
		return domain.House{}, err
	}
	return s.Get(ctx, id)
}

// ListMine returns a page of listings owned by ownerID (any status), newest
// first, for the "Мои объявления" profile screen.
func (s *Service) ListMine(ctx context.Context, ownerID, limit, offset int32) (ListResult, error) {
	if limit <= 0 {
		limit = defaultLimit
	}
	if limit > maxLimit {
		limit = maxLimit
	}
	if offset < 0 {
		offset = 0
	}
	items, err := s.repo.ListByOwner(ctx, ownerID, limit, offset)
	if err != nil {
		return ListResult{}, err
	}
	for i := range items {
		items[i] = s.formatHouseMedia(ctx, items[i])
	}
	total, err := s.repo.CountByOwner(ctx, ownerID)
	if err != nil {
		return ListResult{}, err
	}
	return ListResult{Items: items, Total: total, Limit: limit, Offset: offset}, nil
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
	return s.formatHouseMedia(ctx, house), nil
}

func (s *Service) Update(ctx context.Context, id int32, in domain.NewHouse) (domain.House, error) {
	in.Street = strings.TrimSpace(in.Street)
	in.HouseNumber = strings.TrimSpace(in.HouseNumber)
	in.Description = strings.TrimSpace(in.Description)
	in.City = strings.TrimSpace(in.City)
	in.CountRoom = strings.TrimSpace(in.CountRoom)
	if in.NumberRoom != nil {
		trimmed := strings.TrimSpace(*in.NumberRoom)
		in.NumberRoom = &trimmed
	}

	if err := validateAndCleanRules(&in); err != nil {
		return domain.House{}, err
	}

	if in.OwnerID <= 0 {
		return domain.House{}, ErrInvalidListing
	}
	if in.Street == "" || in.HouseNumber == "" || in.City == "" || in.CountRoom == "" {
		return domain.House{}, ErrInvalidListing
	}
	if in.Description == "" {
		return domain.House{}, ErrInvalidListing
	}
	if in.Price <= 0 || in.Area <= 0 {
		return domain.House{}, ErrInvalidListing
	}

	err := s.repo.Update(ctx, id, in)
	if err != nil {
		return domain.House{}, err
	}
	return s.Get(ctx, id)
}

func validateTimeFormat(t string) bool {
	if len(t) != 5 {
		return false
	}
	if t[2] != ':' {
		return false
	}
	h := t[0:2]
	m := t[3:5]
	if h[0] < '0' || h[0] > '2' || h[1] < '0' || h[1] > '9' {
		return false
	}
	if h == "24" {
		return false
	}
	if m[0] < '0' || m[0] > '5' || m[1] < '0' || m[1] > '9' {
		return false
	}
	return true
}

func isValidEnum(val string, allowed []string) bool {
	for _, a := range allowed {
		if val == a {
			return true
		}
	}
	return false
}

func validateAndCleanRules(in *domain.NewHouse) error {
	if in.CheckInAfter != nil {
		trimmed := strings.TrimSpace(*in.CheckInAfter)
		if trimmed == "" {
			in.CheckInAfter = nil
		} else {
			in.CheckInAfter = &trimmed
			if !validateTimeFormat(trimmed) {
				return ErrInvalidListing
			}
		}
	}
	if in.CheckOutBefore != nil {
		trimmed := strings.TrimSpace(*in.CheckOutBefore)
		if trimmed == "" {
			in.CheckOutBefore = nil
		} else {
			in.CheckOutBefore = &trimmed
			if !validateTimeFormat(trimmed) {
				return ErrInvalidListing
			}
		}
	}
	if in.SmokingAllowed != nil {
		trimmed := strings.TrimSpace(*in.SmokingAllowed)
		if trimmed == "" {
			in.SmokingAllowed = nil
		} else {
			in.SmokingAllowed = &trimmed
			if !isValidEnum(trimmed, []string{"allowed", "forbidden", "on_balcony"}) {
				return ErrInvalidListing
			}
		}
	}
	if in.PetsAllowed != nil {
		trimmed := strings.TrimSpace(*in.PetsAllowed)
		if trimmed == "" {
			in.PetsAllowed = nil
		} else {
			in.PetsAllowed = &trimmed
			if !isValidEnum(trimmed, []string{"allowed", "forbidden", "on_request"}) {
				return ErrInvalidListing
			}
		}
	}
	if in.ChildrenAllowed != nil {
		trimmed := strings.TrimSpace(*in.ChildrenAllowed)
		if trimmed == "" {
			in.ChildrenAllowed = nil
		} else {
			in.ChildrenAllowed = &trimmed
			if !isValidEnum(trimmed, []string{"allowed", "forbidden", "on_request"}) {
				return ErrInvalidListing
			}
		}
	}
	if in.EventsAllowed != nil {
		trimmed := strings.TrimSpace(*in.EventsAllowed)
		if trimmed == "" {
			in.EventsAllowed = nil
		} else {
			in.EventsAllowed = &trimmed
			if !isValidEnum(trimmed, []string{"allowed", "forbidden", "on_request"}) {
				return ErrInvalidListing
			}
		}
	}
	return nil
}

func (s *Service) formatHouseMedia(ctx context.Context, h domain.House) domain.House {
	if h.CoverPath != "" && !strings.Contains(h.CoverPath, "upload_files/") && !strings.HasPrefix(h.CoverPath, "http://") && !strings.HasPrefix(h.CoverPath, "https://") {
		h.CoverPath = s.storage.PublicURL(h.CoverPath)
	}
	if h.OwnerAvatarURL != "" && !strings.Contains(h.OwnerAvatarURL, "upload_files/") && !strings.HasPrefix(h.OwnerAvatarURL, "http://") && !strings.HasPrefix(h.OwnerAvatarURL, "https://") {
		h.OwnerAvatarURL = s.storage.PublicURL(h.OwnerAvatarURL)
	}
	for i := range h.Photos {
		if h.Photos[i].Path != "" && !strings.Contains(h.Photos[i].Path, "upload_files/") && !strings.HasPrefix(h.Photos[i].Path, "http://") && !strings.HasPrefix(h.Photos[i].Path, "https://") {
			h.Photos[i].Path = s.storage.PublicURL(h.Photos[i].Path)
		}
	}
	return h
}
