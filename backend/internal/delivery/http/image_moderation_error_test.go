package http

import (
	"errors"
	"testing"

	"github.com/TrollLOLik/sutki/backend/internal/domain"
)

func TestUnsafeImagePublicMessage(t *testing.T) {
	t.Run("uses deterministic category explanation", func(t *testing.T) {
		err := &domain.UnsafeImageError{
			Decision: domain.ImageModerationReject,
			Category: "personal_data",
			Reason:   "raw model explanation",
		}
		got := unsafeImagePublicMessage(err)
		want := "На фото видны чувствительные персональные данные."
		if got != want {
			t.Fatalf("message = %q, want %q", got, want)
		}
	})

	t.Run("explains inconclusive review", func(t *testing.T) {
		err := &domain.UnsafeImageError{
			Decision: domain.ImageModerationReview,
			Category: "other",
			Reason:   "uncertain",
		}
		got := unsafeImagePublicMessage(err)
		want := "Фото не удалось однозначно проверить. Выберите другое изображение."
		if got != want {
			t.Fatalf("message = %q, want %q", got, want)
		}
	})

	t.Run("keeps fallback for legacy errors", func(t *testing.T) {
		got := unsafeImagePublicMessage(errors.New("wrapped: " + domain.ErrUnsafeImage.Error()))
		want := "Изображение не прошло модерацию. Выберите другое фото."
		if got != want {
			t.Fatalf("message = %q, want %q", got, want)
		}
	})
}
