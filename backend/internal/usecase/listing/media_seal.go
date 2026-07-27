package listing

import (
	"context"
	"fmt"
	"log"
	"strings"
	"time"

	"github.com/TrollLOLik/sutki/backend/internal/media"
)

var listingImageContentTypes = map[string]bool{
	"image/jpeg": true,
	"image/png":  true,
	"image/webp": true,
}

type listingPhotoSeals struct {
	keys    []string
	objects []media.SealedObject
}

func (s *Service) sealListingPhotos(ctx context.Context, ownerID int32, photos []string) (listingPhotoSeals, error) {
	result := listingPhotoSeals{keys: make([]string, 0, len(photos))}
	if len(photos) == 0 {
		return result, nil
	}
	if s.storage == nil {
		return listingPhotoSeals{}, ErrListingMediaUnavailable
	}

	seen := make(map[string]struct{}, len(photos))
	for _, raw := range photos {
		key := strings.TrimSpace(raw)
		if _, exists := seen[key]; exists {
			s.cleanupNewListingSeals(context.Background(), result)
			return listingPhotoSeals{}, fmt.Errorf("%w: duplicate photo key", ErrInvalidListingMedia)
		}
		seen[key] = struct{}{}

		sealed, err := media.SealOwnedObject(
			ctx,
			s.storage,
			key,
			"listings",
			"listings",
			ownerID,
			maxPhotoSize,
			listingImageContentTypes,
		)
		if err != nil {
			s.cleanupNewListingSeals(context.Background(), result)
			return listingPhotoSeals{}, fmt.Errorf("%w: seal listing photo: %v", ErrInvalidListingMedia, err)
		}
		result.keys = append(result.keys, sealed.Key)
		result.objects = append(result.objects, sealed)
	}
	return result, nil
}

func (s *Service) cleanupNewListingSeals(ctx context.Context, seals listingPhotoSeals) {
	if s.storage == nil {
		return
	}
	for _, item := range seals.objects {
		if !item.Created {
			continue
		}
		cleanupCtx, cancel := context.WithTimeout(ctx, 30*time.Second)
		if err := s.storage.Delete(cleanupCtx, item.Key); err != nil {
			log.Printf("listing media: delete uncommitted sealed object %q: %v", item.Key, err)
		}
		cancel()
	}
}

func (s *Service) cleanupListingUploadSources(ctx context.Context, seals listingPhotoSeals) {
	if s.storage == nil {
		return
	}
	for _, item := range seals.objects {
		if !item.Created || item.SourceKey == item.Key {
			continue
		}
		cleanupCtx, cancel := context.WithTimeout(ctx, 30*time.Second)
		if err := s.storage.Delete(cleanupCtx, item.SourceKey); err != nil {
			log.Printf("listing media: delete sealed upload source %q: %v", item.SourceKey, err)
		}
		cancel()
	}
}
