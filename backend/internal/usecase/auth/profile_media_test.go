package auth

import (
	"context"
	"strings"
	"testing"
	"time"

	"github.com/TrollLOLik/sutki/backend/internal/domain"
)

type profileUserRepoStub struct {
	domain.UserRepository
	old domain.User
}

func (r *profileUserRepoStub) GetByID(context.Context, int32) (domain.User, error) {
	return r.old, nil
}

func (r *profileUserRepoStub) UpdateProfile(_ context.Context, id int32, _, _, _, _, _ *string, avatarURL *string, _ *time.Time, _ *string, _ *bool) (domain.User, error) {
	updated := r.old
	updated.ID = id
	if avatarURL != nil {
		updated.AvatarURL = *avatarURL
	}
	return updated, nil
}

type profileStorageStub struct {
	domain.FileStorage
	deleted []string
}

func (s *profileStorageStub) StatObject(context.Context, string) (domain.ObjectInfo, error) {
	return domain.ObjectInfo{SizeBytes: 100, ContentType: "image/webp", ETag: `"source"`}, nil
}

func (s *profileStorageStub) CopyObjectIfMatch(context.Context, string, string, string) (domain.ObjectInfo, error) {
	return domain.ObjectInfo{SizeBytes: 100, ContentType: "image/webp", ETag: `"sealed"`}, nil
}

func (s *profileStorageStub) Delete(_ context.Context, key string) error {
	s.deleted = append(s.deleted, key)
	return nil
}

func (s *profileStorageStub) PublicURL(key string) string {
	return "https://storage.example/" + key
}

func TestUpdateProfileDeletesReplacedOwnedAvatar(t *testing.T) {
	repo := &profileUserRepoStub{old: domain.User{ID: 42, AvatarURL: "avatars/42/old.webp"}}
	storage := &profileStorageStub{}
	service := New(repo, nil, nil, Config{Secret: "test", AccessTTL: time.Minute, Storage: storage})
	newAvatar := "avatars/42/new.webp"

	updated, err := service.UpdateProfile(context.Background(), 42, nil, nil, nil, nil, nil, &newAvatar, nil, nil, nil)
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(updated.AvatarURL, "/avatars/42/sealed-") {
		t.Fatalf("avatar still points at replayable upload: %q", updated.AvatarURL)
	}
	if !containsString(storage.deleted, "avatars/42/old.webp") {
		t.Fatalf("deleted = %#v", storage.deleted)
	}
}

func TestUpdateProfileDoesNotDeleteUnownedAvatar(t *testing.T) {
	for _, oldKey := range []string{"avatars/7/foreign.webp", "avatars/legacy.webp"} {
		t.Run(oldKey, func(t *testing.T) {
			repo := &profileUserRepoStub{old: domain.User{ID: 42, AvatarURL: oldKey}}
			storage := &profileStorageStub{}
			service := New(repo, nil, nil, Config{Secret: "test", AccessTTL: time.Minute, Storage: storage})
			newAvatar := "avatars/42/new.webp"

			if _, err := service.UpdateProfile(context.Background(), 42, nil, nil, nil, nil, nil, &newAvatar, nil, nil, nil); err != nil {
				t.Fatal(err)
			}
			if containsString(storage.deleted, oldKey) {
				t.Fatalf("deleted unowned key: %#v", storage.deleted)
			}
		})
	}
}

func containsString(values []string, want string) bool {
	for _, value := range values {
		if value == want {
			return true
		}
	}
	return false
}
