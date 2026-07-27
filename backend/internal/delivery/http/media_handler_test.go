package http

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/TrollLOLik/sutki/backend/internal/domain"
)

type presignStorageStub struct {
	domain.FileStorage
	key string
}

type mediaModerationStorageStub struct {
	domain.FileStorage
}

func (mediaModerationStorageStub) ReadObject(context.Context, string, int64) (domain.ObjectData, error) {
	return domain.ObjectData{Bytes: []byte("\x89PNG\r\n\x1a\n"), ContentType: "image/png"}, nil
}

type mediaImageModeratorStub struct {
	calls int
}

func (s *mediaImageModeratorStub) ModerateImages(_ context.Context, urls []string, _ string) (domain.ImageModerationResult, error) {
	s.calls++
	if len(urls) != 1 {
		return domain.ImageModerationResult{}, errors.New("expected exactly one image per moderation call")
	}
	return domain.ImageModerationResult{Decision: domain.ImageModerationApprove, Category: "safe", Confidence: 1}, nil
}

func (s *presignStorageStub) PresignUpload(_ context.Context, key string, _ int64, _ string) (domain.UploadTarget, error) {
	s.key = key
	return domain.UploadTarget{URL: "https://storage.example", Key: key}, nil
}

func (s *presignStorageStub) PresignGet(context.Context, string, time.Duration) (string, error) {
	return "", nil
}

func TestMediaPresignScopesPublicKeyToUser(t *testing.T) {
	storage := &presignStorageStub{}
	handler := NewMediaHandler(storage, nil)
	body, err := json.Marshal(presignMediaRequest{
		FileName:    "flat.webp",
		Size:        1024,
		ContentType: "image/webp",
		Type:        "listing",
	})
	if err != nil {
		t.Fatal(err)
	}

	req := httptest.NewRequest(http.MethodPost, "/media/presign", bytes.NewReader(body))
	req = req.WithContext(context.WithValue(req.Context(), userIDKey, int32(42)))
	recorder := httptest.NewRecorder()

	handler.PresignUpload(recorder, req)

	if recorder.Code != http.StatusOK {
		t.Fatalf("status = %d, body = %s", recorder.Code, recorder.Body.String())
	}
	if !strings.HasPrefix(storage.key, "listings/42/") {
		t.Fatalf("presigned key %q is not scoped to user", storage.key)
	}
}

// MEDIA-02. This route used to accept type "chat" and mint a key
// interchangeable with the one the chat service issues — without running any of
// the checks that service does, canSendMotionMedia above all, which is what
// stops a fresh unverified account from uploading video. Two routes minting the
// same kind of key means the weaker one decides the security of both.
func TestMediaPresignRefusesChatUploads(t *testing.T) {
	for _, uploadType := range []string{"chat", "Chat", " chat ", "chat/uploads", "attachment"} {
		storage := &presignStorageStub{}
		handler := NewMediaHandler(storage, nil)

		body, err := json.Marshal(presignMediaRequest{
			FileName: "clip.mp4", Size: 1024, ContentType: "video/mp4", Type: uploadType,
		})
		if err != nil {
			t.Fatal(err)
		}
		req := httptest.NewRequest(http.MethodPost, "/media/presign", bytes.NewReader(body))
		req = req.WithContext(context.WithValue(req.Context(), userIDKey, int32(42)))
		recorder := httptest.NewRecorder()

		handler.PresignUpload(recorder, req)

		if recorder.Code != http.StatusBadRequest {
			t.Errorf("type=%q: status = %d, want 400", uploadType, recorder.Code)
		}
		if storage.key != "" {
			t.Errorf("type=%q minted key %q; chat attachments go through POST /chat/attachments/presign", uploadType, storage.key)
		}
	}
}

// The client's file name reaches the object key and, through it, the presigned
// POST policy. An unbounded or exotic extension has no business in either.
func TestMediaPresignClampsTheClientExtension(t *testing.T) {
	storage := &presignStorageStub{}
	handler := NewMediaHandler(storage, nil)

	body, err := json.Marshal(presignMediaRequest{
		FileName:    "flat." + strings.Repeat("a", 300),
		Size:        1024,
		ContentType: "image/webp",
		Type:        "listing",
	})
	if err != nil {
		t.Fatal(err)
	}
	req := httptest.NewRequest(http.MethodPost, "/media/presign", bytes.NewReader(body))
	req = req.WithContext(context.WithValue(req.Context(), userIDKey, int32(42)))
	recorder := httptest.NewRecorder()

	handler.PresignUpload(recorder, req)

	if recorder.Code != http.StatusOK {
		t.Fatalf("status = %d, body = %s", recorder.Code, recorder.Body.String())
	}
	if !strings.HasPrefix(storage.key, "listings/42/") {
		t.Fatalf("presigned key %q is not scoped to user", storage.key)
	}
	if len(storage.key) > 64 {
		t.Fatalf("key %q is %d chars; the file name is leaking into it unbounded", storage.key, len(storage.key))
	}
}

func TestModerateListingImagesChecksEveryOwnedKey(t *testing.T) {
	moderator := &mediaImageModeratorStub{}
	handler := NewMediaHandler(mediaModerationStorageStub{}, moderator)
	body, err := json.Marshal(moderateListingMediaRequest{Keys: []string{
		"listings/42/cover.png",
		"listings/42/second.png",
	}})
	if err != nil {
		t.Fatal(err)
	}

	req := httptest.NewRequest(http.MethodPost, "/media/listings/moderate", bytes.NewReader(body))
	req = req.WithContext(context.WithValue(req.Context(), userIDKey, int32(42)))
	recorder := httptest.NewRecorder()
	handler.ModerateListingImages(recorder, req)

	if recorder.Code != http.StatusOK {
		t.Fatalf("status = %d, body = %s", recorder.Code, recorder.Body.String())
	}
	if moderator.calls != 2 {
		t.Fatalf("moderation calls = %d, want 2", moderator.calls)
	}
}
