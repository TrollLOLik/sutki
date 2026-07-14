package listing

import (
	"bytes"
	"context"
	"errors"
	"testing"
	"time"

	"github.com/TrollLOLik/sutki/backend/internal/domain"
)

type recordingViewRepository struct {
	eventID  string
	houseID  int32
	hash     []byte
	kind     string
	viewedOn time.Time
	userID   *int32
	result   domain.ListingViewResult
}

func (r *recordingViewRepository) Record(_ context.Context, eventID string, houseID int32, viewerHash []byte, viewerKind string, viewedOn time.Time, userID *int32) (domain.ListingViewResult, error) {
	r.eventID = eventID
	r.houseID = houseID
	r.hash = append([]byte(nil), viewerHash...)
	r.kind = viewerKind
	r.viewedOn = viewedOn
	r.userID = userID
	return r.result, nil
}

func TestRecordViewUsesAuthenticatedIdentity(t *testing.T) {
	repo := &recordingViewRepository{result: domain.ListingViewResult{Counted: true, Views: 12}}
	service := &Service{viewRepo: repo}
	userID := int32(42)

	got, err := service.RecordView(context.Background(), "event-1", 7, "rotatable-guest-id", &userID)
	if err != nil {
		t.Fatalf("RecordView() error = %v", err)
	}
	if got != repo.result {
		t.Fatalf("RecordView() = %+v, want %+v", got, repo.result)
	}
	if repo.kind != "authenticated" || repo.userID == nil || *repo.userID != userID {
		t.Fatalf("recorded identity = kind %q, user %v", repo.kind, repo.userID)
	}
	if repo.eventID != "event-1" || repo.houseID != 7 {
		t.Fatalf("recorded event/listing = %q/%d", repo.eventID, repo.houseID)
	}
	if repo.viewedOn.Location() != time.UTC || repo.viewedOn.Hour() != 0 || repo.viewedOn.Minute() != 0 || repo.viewedOn.Second() != 0 {
		t.Fatalf("viewedOn = %v, want UTC day boundary", repo.viewedOn)
	}

	firstHash := append([]byte(nil), repo.hash...)
	_, err = service.RecordView(context.Background(), "event-2", 7, "another-guest-id", &userID)
	if err != nil {
		t.Fatalf("second RecordView() error = %v", err)
	}
	if !bytes.Equal(firstHash, repo.hash) {
		t.Fatal("authenticated viewer hash changed with guest id")
	}
}

func TestRecordViewRequiresGuestIdentity(t *testing.T) {
	service := &Service{viewRepo: &recordingViewRepository{}}

	_, err := service.RecordView(context.Background(), "event-1", 7, "  ", nil)
	if !errors.Is(err, ErrMissingViewIdentity) {
		t.Fatalf("RecordView() error = %v, want %v", err, ErrMissingViewIdentity)
	}
}
