package moderation

import (
	"bytes"
	"context"
	"fmt"
	"image"
	_ "image/gif"
	_ "image/jpeg"
	_ "image/png"
	"io"
	"log"
	"net/http"
	"time"

	"github.com/corona10/goimagehash"

	"github.com/TrollLOLik/sutki/backend/internal/domain"
)

// PhotoLister exposes the photo keys of a listing (implemented by the
// existing listing repository).
type PhotoLister interface {
	ListPhotos(ctx context.Context, houseID int32) ([]domain.Photo, error)
}

// photoDeps are wired via SetPhotoPipeline; nil means photo checking is off.
type photoDeps struct {
	photos    PhotoLister
	storage   domain.FileStorage
	moderator domain.ImageModerator
}

// SetPhotoPipeline enables perceptual-hash duplicate detection for listing
// photos. Optional: without it, moderation covers text only.
func (s *Service) SetPhotoPipeline(photos PhotoLister, storage domain.FileStorage, moderator domain.ImageModerator) {
	s.photo = &photoDeps{photos: photos, storage: storage, moderator: moderator}
}

func (s *Service) moderateListingImages(ctx context.Context, h domain.ModerationHouse) (domain.ImageModerationResult, error) {
	urls := make([]string, 0, len(h.PhotoKeys))
	for _, key := range h.PhotoKeys {
		url, err := s.photo.storage.PresignGet(ctx, key, 10*time.Minute)
		if err != nil {
			return domain.ImageModerationResult{}, fmt.Errorf("presign %q: %w", key, err)
		}
		urls = append(urls, url)
	}
	return s.photo.moderator.ModerateImages(ctx, urls, "listing")
}

// CheckPhotos hashes every photo of the house and flags the listing for
// human review when a photo matches (Hamming distance <= phashMaxDistance)
// a photo on another owner's active listing. Runs in the background after
// Submit: photo download latency must never block the create request.
// Detects only intra-platform duplicates; photos stolen from external sites
// are explicitly out of scope for this phase.
func (s *Service) CheckPhotos(ctx context.Context, houseID int32) {
	if s.photo == nil {
		return
	}
	h, err := s.repo.GetHouseForModeration(ctx, houseID)
	if err != nil {
		log.Printf("moderation photos: load house %d: %v", houseID, err)
		return
	}

	photos, err := s.photo.photos.ListPhotos(ctx, houseID)
	if err != nil {
		log.Printf("moderation photos: list photos for house %d: %v", houseID, err)
		return
	}

	client := &http.Client{Timeout: 20 * time.Second}
	flagged := false

	for _, p := range photos {
		hash, err := s.hashPhoto(ctx, client, p.Path)
		if err != nil {
			log.Printf("moderation photos: hash %q (house %d): %v", p.Path, houseID, err)
			continue // one broken image must not abort the rest
		}
		if err := s.repo.SavePhotoHash(ctx, houseID, p.Path, hash); err != nil {
			log.Printf("moderation photos: save hash for %q: %v", p.Path, err)
		}
		if flagged {
			continue // keep hashing (for future comparisons) but flag once
		}
		match, err := s.repo.FindSimilarPhoto(ctx, houseID, h.OwnerID, hash, phashMaxDistance)
		if err != nil {
			log.Printf("moderation photos: similarity check for house %d: %v", houseID, err)
			continue
		}
		if match {
			flagged = true
		}
	}

	if !flagged {
		return
	}

	if err := s.repo.RecordVerdict(ctx, domain.ModerationVerdict{
		HouseID: houseID, ContentHash: ContentHash(h),
		Source: domain.ModerationSourcePrefilter, Decision: domain.ModerationReview,
		Category: "stolen_photos",
		Reason:   "Фотографии совпадают с активным объявлением другого владельца",
	}, nil); err != nil {
		log.Printf("moderation photos: record verdict for house %d: %v", houseID, err)
	}
	// Pull the listing out of circulation regardless of its current state —
	// including provisional actives published in degraded mode.
	if err := s.repo.SetHouseModeration(ctx, houseID, domain.HouseStatusModerationReview, ""); err != nil {
		log.Printf("moderation photos: flag house %d: %v", houseID, err)
		return
	}
	log.Printf("moderation photos: house %d sent to review (duplicate photos)", houseID)
	s.publishStatus(h.OwnerID, houseID, domain.HouseStatusModerationReview, "", fmt.Sprintf("listing:%d:%s:photo-review", houseID, ContentHash(h)), true)
	s.checkReviewQueueAlert(ctx)
}

// hashPhoto downloads one image and computes its 64-bit perceptual hash.
func (s *Service) hashPhoto(ctx context.Context, client *http.Client, key string) (uint64, error) {
	url := key
	if !bytes.HasPrefix([]byte(key), []byte("http://")) && !bytes.HasPrefix([]byte(key), []byte("https://")) {
		url = s.photo.storage.PublicURL(key)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return 0, err
	}
	resp, err := client.Do(req)
	if err != nil {
		return 0, err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return 0, fmt.Errorf("fetch photo: status %d", resp.StatusCode)
	}

	// Cap the read: listing photos are size-limited at upload, anything
	// bigger than 25 MB is not worth hashing.
	img, _, err := image.Decode(io.LimitReader(resp.Body, 25<<20))
	if err != nil {
		return 0, fmt.Errorf("decode photo: %w", err)
	}

	ph, err := goimagehash.PerceptionHash(img)
	if err != nil {
		return 0, fmt.Errorf("phash: %w", err)
	}
	return ph.GetHash(), nil
}
