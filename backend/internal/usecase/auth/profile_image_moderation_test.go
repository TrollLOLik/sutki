package auth

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/TrollLOLik/sutki/backend/internal/domain"
)

type profileModerationRepo struct {
	domain.UserRepository
	updated bool
}

func (r *profileModerationRepo) GetByID(_ context.Context, id int32) (domain.User, error) {
	return domain.User{ID: id, AvatarURL: "avatars/42/old.webp"}, nil
}

func (r *profileModerationRepo) UpdateProfile(_ context.Context, id int32, _, _, _, _, _ *string, avatarURL *string, _ *time.Time, _ *string, _ *bool) (domain.User, error) {
	r.updated = true
	return domain.User{ID: id, AvatarURL: *avatarURL}, nil
}

type profileModerationStorage struct {
	domain.FileStorage
	deleted []string
}

func (s *profileModerationStorage) StatObject(context.Context, string) (domain.ObjectInfo, error) {
	return domain.ObjectInfo{SizeBytes: 100, ContentType: "image/png", ETag: `"source"`}, nil
}

func (s *profileModerationStorage) CopyObjectIfMatch(context.Context, string, string, string) (domain.ObjectInfo, error) {
	return domain.ObjectInfo{SizeBytes: 100, ContentType: "image/png", ETag: `"sealed"`}, nil
}

func (s *profileModerationStorage) ReadObject(context.Context, string, int64) (domain.ObjectData, error) {
	return domain.ObjectData{Bytes: []byte("\x89PNG\r\n\x1a\n"), ContentType: "image/png"}, nil
}

func (s *profileModerationStorage) Delete(_ context.Context, key string) error {
	s.deleted = append(s.deleted, key)
	return nil
}

type rejectingImageModerator struct{}

func (rejectingImageModerator) ModerateImages(context.Context, []string, string) (domain.ImageModerationResult, error) {
	return domain.ImageModerationResult{Decision: domain.ImageModerationReject, Category: "sexual", Reason: "unsafe"}, nil
}

func TestUpdateProfileRejectsUnsafeAvatarBeforeSaving(t *testing.T) {
	repo := &profileModerationRepo{}
	storage := &profileModerationStorage{}
	service := New(repo, nil, nil, Config{
		Secret: "test", AccessTTL: time.Minute, Storage: storage, ImageModerator: rejectingImageModerator{},
	})
	avatar := "avatars/42/new.webp"

	_, err := service.UpdateProfile(context.Background(), 42, nil, nil, nil, nil, nil, &avatar, nil, nil, nil)
	if !errors.Is(err, domain.ErrUnsafeImage) {
		t.Fatalf("expected unsafe image, got %v", err)
	}
	var violation *domain.UnsafeImageError
	if !errors.As(err, &violation) || violation.Category != "sexual" || violation.Decision != domain.ImageModerationReject {
		t.Fatalf("moderation details were not preserved: %#v", violation)
	}
	if repo.updated {
		t.Fatal("unsafe avatar was saved")
	}
	if !containsString(storage.deleted, avatar) {
		t.Fatalf("source avatar was not deleted: %v", storage.deleted)
	}
}
