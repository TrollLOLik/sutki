package http

import (
	"bytes"
	"context"
	"encoding/json"
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

func (s *presignStorageStub) PresignUpload(_ context.Context, key string, _ int64, _ string) (domain.UploadTarget, error) {
	s.key = key
	return domain.UploadTarget{URL: "https://storage.example", Key: key}, nil
}

func (s *presignStorageStub) PresignGet(context.Context, string, time.Duration) (string, error) {
	return "", nil
}

func TestMediaPresignScopesPublicKeyToUser(t *testing.T) {
	storage := &presignStorageStub{}
	handler := NewMediaHandler(nil, storage)
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
