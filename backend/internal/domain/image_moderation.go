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

// UnsafeImageError preserves a validated moderation verdict without exposing
// raw model output through the public API.
type UnsafeImageError struct {
	Decision string
	Category string
	Reason   string
}

func (e *UnsafeImageError) Error() string {
	if e == nil || e.Reason == "" {
		return ErrUnsafeImage.Error()
	}
	return ErrUnsafeImage.Error() + ": " + e.Reason
}

func (e *UnsafeImageError) Unwrap() error {
	return ErrUnsafeImage
}

// ImageModerationResult is the validated, machine-readable model verdict.
// Callers must treat review as unsafe until a final decision exists.
type ImageModerationResult struct {
	Decision   string
	Category   string
	Reason     string
	Confidence float32
	Raw        []byte
}

// ImageModerator checks server-prepared image references (normally data URLs).
// Implementations must fail closed: malformed model output is returned as an
// error, not approve.
type ImageModerator interface {
	ModerateImages(ctx context.Context, imageURLs []string, usage string) (ImageModerationResult, error)
}
