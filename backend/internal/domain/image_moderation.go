package domain

import (
	"context"
	"errors"
)

const (
	ImageModerationApprove = "approve"
	ImageModerationReject  = "reject"
	ImageModerationReview  = "review"
)

var (
	ErrUnsafeImage                = errors.New("image violates content rules")
	ErrImageModerationUnavailable = errors.New("image moderation is temporarily unavailable")
)

// ImageModerationResult is the validated, machine-readable model verdict.
// Callers must treat review as unsafe until a final decision exists.
type ImageModerationResult struct {
	Decision   string
	Category   string
	Reason     string
	Confidence float32
	Raw        []byte
}

// ImageModerator checks short-lived, server-issued image URLs. Implementations
// must fail closed: malformed model output is returned as an error, not approve.
type ImageModerator interface {
	ModerateImages(ctx context.Context, imageURLs []string, usage string) (ImageModerationResult, error)
}
