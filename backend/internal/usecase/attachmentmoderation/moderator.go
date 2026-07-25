package attachmentmoderation

import (
	"context"

	"github.com/TrollLOLik/sutki/backend/internal/domain"
	"github.com/TrollLOLik/sutki/backend/internal/usecase/imagemoderation"
)

// storedKeyModerator adapts imagemoderation.ModerateStoredImages to the narrow
// ImageModerator port this package declares.
//
// The adapter exists so the worker depends on an interface it owns rather than a
// package-level function: that keeps the worker testable with a fake, and video
// frames reuse exactly the same vision path (and therefore the same
// reject-wins-over-review semantics) as ordinary photos.
type storedKeyModerator struct {
	moderator      domain.ImageModerator
	storage        domain.FileStorage
	maxObjectBytes int64
}

// NewStoredKeyModerator wires the existing image moderation pipeline. A
// non-positive limit falls back to the package default.
func NewStoredKeyModerator(moderator domain.ImageModerator, storage domain.FileStorage, limit int64) ImageModerator {
	if limit <= 0 {
		limit = maxObjectBytes
	}
	return &storedKeyModerator{
		moderator:      moderator,
		storage:        storage,
		maxObjectBytes: limit,
	}
}

func (m *storedKeyModerator) ModerateStoredKeys(ctx context.Context, keys []string, usage string) (domain.ImageModerationResult, error) {
	return imagemoderation.ModerateStoredImages(ctx, m.moderator, m.storage, keys, usage, m.maxObjectBytes)
}
