package auth

import (
	"context"
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

	if _, err := service.UpdateProfile(context.Background(), 42, nil, nil, nil, nil, nil, &newAvatar, nil, nil, nil); err != nil {
		t.Fatal(err)
	}
	if len(storage.deleted) != 1 || storage.deleted[0] != "avatars/42/old.webp" {
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
			if len(storage.deleted) != 0 {
				t.Fatalf("deleted unowned key: %#v", storage.deleted)
			}
		})
	}
}
