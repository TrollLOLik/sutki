package listing

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/TrollLOLik/sutki/backend/internal/domain"
)

type listingMediaStorageStub struct {
	objects map[string]domain.ObjectInfo
}

func (s *listingMediaStorageStub) PresignUpload(context.Context, string, int64, string) (domain.UploadTarget, error) {
	return domain.UploadTarget{}, nil
}
func (s *listingMediaStorageStub) PresignGet(context.Context, string, time.Duration) (string, error) {
	return "", nil
}
func (s *listingMediaStorageStub) StatObject(_ context.Context, key string) (domain.ObjectInfo, error) {
	info, ok := s.objects[key]
	if !ok {
		return domain.ObjectInfo{}, errors.New("not found")
	}
	return info, nil
}
func (s *listingMediaStorageStub) PublicURL(key string) string          { return "https://media.test/" + key }
func (s *listingMediaStorageStub) Delete(context.Context, string) error { return nil }

func TestValidateListingPhotosAcceptsOwnedUploadedImages(t *testing.T) {
	const key = "listings/42/photo.jpg"
	svc := &Service{storage: &listingMediaStorageStub{objects: map[string]domain.ObjectInfo{
		key: {SizeBytes: 1024, ContentType: "image/jpeg"},
	}}}

	if err := svc.validateListingPhotos(context.Background(), 42, []string{key}); err != nil {
		t.Fatalf("validateListingPhotos() error = %v", err)
	}
}

func TestValidateListingPhotosRejectsForeignKey(t *testing.T) {
	svc := &Service{storage: &listingMediaStorageStub{objects: map[string]domain.ObjectInfo{}}}

	err := svc.validateListingPhotos(context.Background(), 42, []string{"listings/7/photo.jpg"})
	if !errors.Is(err, ErrInvalidListingMedia) {
		t.Fatalf("error = %v, want ErrInvalidListingMedia", err)
	}
}

func TestValidateListingPhotosRejectsMissingObject(t *testing.T) {
	svc := &Service{storage: &listingMediaStorageStub{objects: map[string]domain.ObjectInfo{}}}

	err := svc.validateListingPhotos(context.Background(), 42, []string{"listings/42/missing.jpg"})
	if !errors.Is(err, ErrListingMediaUnavailable) {
		t.Fatalf("error = %v, want ErrListingMediaUnavailable", err)
	}
}

func TestCheckPublicMediaURLChecksAnonymousAccess(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodHead {
			t.Fatalf("method = %s, want HEAD", r.Method)
		}
		if r.URL.Path == "/private.jpg" {
			w.WriteHeader(http.StatusForbidden)
			return
		}
		w.WriteHeader(http.StatusOK)
	}))
	defer server.Close()

	if err := checkPublicMediaURL(context.Background(), server.URL+"/public.jpg"); err != nil {
		t.Fatalf("public object error = %v", err)
	}
	if err := checkPublicMediaURL(context.Background(), server.URL+"/private.jpg"); err == nil {
		t.Fatal("private object unexpectedly passed public access check")
	}
}
