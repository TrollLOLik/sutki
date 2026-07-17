package listing

import (
	"context"
	"crypto/sha256"
	"errors"
	"fmt"
	"log"
	"net/http"
	"strings"
	"time"

	"github.com/TrollLOLik/sutki/backend/internal/domain"
	"github.com/TrollLOLik/sutki/backend/internal/media"
	"github.com/TrollLOLik/sutki/backend/internal/observability"
)

const (
	defaultLimit int32 = 20
	maxLimit     int32 = 100
	maxPhotos          = 10
	maxPhotoSize int64 = 10 * 1024 * 1024
)

// ErrInvalidListing is returned when create input fails validation.
var ErrInvalidListing = errors.New("invalid listing")

// ErrTooManySubmissions is returned when the owner exceeds the daily
// create/update moderation rate limit.
var ErrTooManySubmissions = errors.New("too many listing submissions today")

var ErrMissingViewIdentity = errors.New("missing listing view identity")

var ErrInvalidListingMedia = errors.New("invalid listing media")
var ErrListingMediaUnavailable = errors.New("listing media is unavailable")

// Moderator runs the moderation pipeline for created/updated listings.
// Implemented by the moderation service; nil disables moderation (tests).
type Moderator interface {
	// AllowSubmission enforces the per-owner daily submission limit.
	AllowSubmission(ctx context.Context, ownerID int32) (bool, error)
	// Submit runs the synchronous prefilter and enqueues the async LLM
	// verdict. Returns the resulting house status.
	Submit(ctx context.Context, houseID int32) (string, error)
}

// Service implements listing read use cases over a ListingRepository.
type Service struct {
	repo                domain.ListingRepository
	viewRepo            domain.ListingViewRepository
	storage             domain.FileStorage
	aiSummarizer        domain.AISummarizer
	moderator           Moderator
	locationSummaryRepo domain.LocationSummaryRepository
	nearbyPOIs          domain.NearbyPOIProvider
	wake                chan struct{}
}

func New(repo domain.ListingRepository, viewRepo domain.ListingViewRepository, storage domain.FileStorage, aiSummarizer domain.AISummarizer, moderator Moderator, locationSummaryRepo domain.LocationSummaryRepository, nearbyPOIs domain.NearbyPOIProvider) *Service {
	return &Service{
		repo:                repo,
		viewRepo:            viewRepo,
		storage:             storage,
		aiSummarizer:        aiSummarizer,
		moderator:           moderator,
		locationSummaryRepo: locationSummaryRepo,
		nearbyPOIs:          nearbyPOIs,
		wake:                make(chan struct{}, 1),
	}
}

func (s *Service) RecordView(ctx context.Context, eventID string, houseID int32, guestID string, userID *int32) (domain.ListingViewResult, error) {
	if s.viewRepo == nil {
		return domain.ListingViewResult{}, errors.New("listing views are not supported")
	}
	viewerKind := "guest"
	identity := strings.TrimSpace(guestID)
	if userID != nil {
		viewerKind = "authenticated"
		identity = fmt.Sprintf("user:%d", *userID)
	}
	if identity == "" {
		return domain.ListingViewResult{}, ErrMissingViewIdentity
	}
	hash := sha256.Sum256([]byte(viewerKind + ":" + identity))
	now := time.Now().UTC()
	viewedOn := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, time.UTC)
	return s.viewRepo.Record(ctx, eventID, houseID, hash[:], viewerKind, viewedOn, userID)
}

// ListResult is a page of active listings plus pagination metadata.
type ListResult struct {
	Items  []domain.House
	Total  int64
	Limit  int32
	Offset int32
}

type mapClusterRepository interface {
	ListMapClusters(context.Context) ([]domain.MapCluster, error)
}

func (s *Service) MapClusters(ctx context.Context) ([]domain.MapCluster, error) {
	repo, ok := s.repo.(mapClusterRepository)
	if !ok {
		return nil, errors.New("map clusters are not supported")
	}
	return repo.ListMapClusters(ctx)
}

type mediaIntegrityRepository interface {
	ListPublicMediaKeys(context.Context, int32) ([]string, error)
}

// StartMediaIntegrityWorker periodically verifies that listing photo keys
// still exist in object storage. It reports a single summarized error to
// GlitchTip and logs a bounded sample, avoiding one alert per broken object.
func (s *Service) StartMediaIntegrityWorker(ctx context.Context, interval time.Duration) {
	if s.storage == nil || interval <= 0 {
		return
	}
	repo, ok := s.repo.(mediaIntegrityRepository)
	if !ok {
		return
	}
	go func() {
		defer observability.RecoverAndRepanic(ctx)
		timer := time.NewTimer(time.Minute)
		defer timer.Stop()
		for {
			select {
			case <-ctx.Done():
				return
			case <-timer.C:
				s.auditPublicMedia(ctx, repo)
				timer.Reset(interval)
			}
		}
	}()
	log.Printf("listing media integrity worker: started (interval %s)", interval)
}

func (s *Service) auditPublicMedia(ctx context.Context, repo mediaIntegrityRepository) {
	const auditLimit int32 = 500
	keys, err := repo.ListPublicMediaKeys(ctx, auditLimit)
	if err != nil {
		wrapped := fmt.Errorf("listing media integrity: list keys: %w", err)
		log.Print(wrapped)
		observability.CaptureException(ctx, wrapped)
		return
	}
	broken := make([]string, 0, 10)
	brokenCount := 0
	for _, key := range keys {
		checkCtx, cancel := context.WithTimeout(ctx, 10*time.Second)
		_, statErr := s.storage.StatObject(checkCtx, key)
		if statErr == nil {
			statErr = checkPublicMediaURL(checkCtx, s.storage.PublicURL(key))
		}
		cancel()
		if statErr != nil {
			brokenCount++
			if len(broken) < cap(broken) {
				broken = append(broken, key)
			}
		}
	}
	if brokenCount == 0 {
		log.Printf("listing media integrity: checked %d public objects", len(keys))
		return
	}
	err = fmt.Errorf("listing media integrity: %d of %d checked objects are unavailable (sample: %s)", brokenCount, len(keys), strings.Join(broken, ", "))
	log.Print(err)
	observability.CaptureException(ctx, err)
}

func checkPublicMediaURL(ctx context.Context, publicURL string) error {
	req, err := http.NewRequestWithContext(ctx, http.MethodHead, publicURL, nil)
	if err != nil {
		return err
	}
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode < http.StatusOK || resp.StatusCode >= http.StatusMultipleChoices {
		return fmt.Errorf("public URL returned HTTP %d", resp.StatusCode)
	}
	return nil
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
	if err := s.validateListingPhotos(ctx, in.OwnerID, in.Photos); err != nil {
		return domain.House{}, err
	}

	// Daily moderation rate limit: blocks flooding and iterative prompt
	// probing before anything is persisted.
	if s.moderator != nil {
		ok, err := s.moderator.AllowSubmission(ctx, in.OwnerID)
		if err == nil && !ok {
			return domain.House{}, ErrTooManySubmissions
		}
	}

	id, err := s.repo.Create(ctx, in)
	if err != nil {
		return domain.House{}, err
	}

	// Moderation: synchronous prefilter + async LLM verdict. The listing was
	// inserted as pending_moderation; Submit may flip it (e.g. provisional
	// active in degraded mode). Failures keep it pending — fail-closed.
	if s.moderator != nil {
		if _, err := s.moderator.Submit(ctx, id); err != nil {
			// Log-only: the listing exists; the worker will pick it up.
			_ = err
		}
	}

	// Enqueue durable location summary job
	if s.locationSummaryRepo != nil {
		if err := s.locationSummaryRepo.Enqueue(ctx, id, in.City, in.Street, in.Lat, in.Lng, nil); err != nil {
			log.Printf("listing create: enqueue location enrichment for house %d: %v", id, err)
		}
		s.Wake()
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

// UserHasConfirmedBooking reports whether userID has a confirmed or active
// booking for houseID.  Used by the detail endpoint to decide whether to
// reveal exact coordinates.
func (s *Service) UserHasConfirmedBooking(ctx context.Context, userID, houseID int32) (bool, error) {
	return s.repo.UserHasConfirmedBooking(ctx, userID, houseID)
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
	if err := s.validateListingPhotos(ctx, in.OwnerID, in.Photos); err != nil {
		return domain.House{}, err
	}

	// Fetch old listing to see if coordinates or address changed
	oldHouse, err := s.repo.GetByID(ctx, id)
	if err != nil {
		return domain.House{}, err
	}
	oldPhotos, err := s.repo.ListPhotos(ctx, id)
	if err != nil {
		return domain.House{}, err
	}

	// Note: AllowSubmission (daily rate-limit) is intentionally NOT checked
	// here. The rate-limit exists to prevent bulk-spam creation of new
	// listings, not to block owners from fixing a rejected listing. Applying
	// it to edits means a rejected owner may hit the cap and be unable to
	// resubmit — a broken UX loop where the app says "edit to resubmit" but
	// the edit itself is rejected by the rate limiter.

	addressChanged := oldHouse.Street != in.Street ||
		oldHouse.HouseNumber != in.HouseNumber ||
		oldHouse.City != in.City ||
		(oldHouse.Lat == nil && in.Lat != nil) ||
		(oldHouse.Lat != nil && in.Lat == nil) ||
		(oldHouse.Lat != nil && in.Lat != nil && *oldHouse.Lat != *in.Lat) ||
		(oldHouse.Lng == nil && in.Lng != nil) ||
		(oldHouse.Lng != nil && in.Lng == nil) ||
		(oldHouse.Lng != nil && in.Lng != nil && *oldHouse.Lng != *in.Lng)

	// POIs are backend enrichment data. Preserve them on ordinary edits; an
	// address change intentionally clears them and schedules a fresh lookup.
	if !addressChanged {
		in.POIs = oldHouse.POIs
	} else {
		in.POIs = nil
	}

	err = s.repo.Update(ctx, id, in)
	if err != nil {
		return domain.House{}, err
	}
	if s.storage != nil {
		oldPhotoKeys := make([]string, 0, len(oldPhotos))
		for _, photo := range oldPhotos {
			oldPhotoKeys = append(oldPhotoKeys, photo.Path)
		}
		for _, key := range media.RemovedOwnedKeys(oldPhotoKeys, in.Photos, "listings", in.OwnerID) {
			if err := s.storage.Delete(ctx, key); err != nil {
				log.Printf("listing update: delete removed photo for house %d: %v", id, err)
			}
		}
	}

	// Re-moderate the edited content. Unchanged text keeps the current
	// status (idempotent by content hash); changed text goes back through
	// the pipeline, which also handles the rejected -> resubmit appeal flow.
	if s.moderator != nil {
		if _, mErr := s.moderator.Submit(ctx, id); mErr != nil {
			log.Printf("listing update: submit house %d for moderation: %v", id, mErr)
		}
	}

	if addressChanged {
		if err := s.repo.UpdateLocationSummary(ctx, id, nil); err != nil {
			log.Printf("listing update: clear stale location summary for house %d: %v", id, err)
		}
	}
	needsLocationRefresh := addressChanged || len(oldHouse.POIs) == 0 || oldHouse.LocationSummary == nil || strings.TrimSpace(*oldHouse.LocationSummary) == ""
	if needsLocationRefresh && s.locationSummaryRepo != nil {
		if err := s.locationSummaryRepo.Enqueue(ctx, id, in.City, in.Street, in.Lat, in.Lng, nil); err != nil {
			log.Printf("listing update: enqueue location enrichment for house %d: %v", id, err)
		}
		s.Wake()
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

func (s *Service) validateListingPhotos(ctx context.Context, ownerID int32, photos []string) error {
	if len(photos) > maxPhotos {
		return fmt.Errorf("%w: at most %d photos are allowed", ErrInvalidListingMedia, maxPhotos)
	}
	if len(photos) == 0 {
		return nil
	}
	if s.storage == nil {
		return ErrListingMediaUnavailable
	}

	seen := make(map[string]struct{}, len(photos))
	for _, raw := range photos {
		key := strings.TrimSpace(raw)
		if !media.IsOwnedKey(key, "listings", ownerID) {
			return fmt.Errorf("%w: photo key is outside the owner's listing prefix", ErrInvalidListingMedia)
		}
		if _, exists := seen[key]; exists {
			return fmt.Errorf("%w: duplicate photo key", ErrInvalidListingMedia)
		}
		seen[key] = struct{}{}

		info, err := s.storage.StatObject(ctx, key)
		if err != nil {
			return fmt.Errorf("%w: verify %q: %v", ErrListingMediaUnavailable, key, err)
		}
		if info.SizeBytes <= 0 || info.SizeBytes > maxPhotoSize {
			return fmt.Errorf("%w: invalid photo size", ErrInvalidListingMedia)
		}
		switch strings.ToLower(strings.TrimSpace(info.ContentType)) {
		case "image/jpeg", "image/png", "image/webp":
		default:
			return fmt.Errorf("%w: invalid photo content type", ErrInvalidListingMedia)
		}
	}
	return nil
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
