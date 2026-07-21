package listing

import (
	"bytes"
	"context"
	"crypto/sha256"
	"errors"
	"slices"
	"testing"
	"time"

	"github.com/TrollLOLik/sutki/backend/internal/domain"
)

type recordingViewRepository struct {
	eventID        string
	houseID        int32
	hash           []byte
	kind           string
	viewedOn       time.Time
	userID         *int32
	result         domain.ListingViewResult
	recentIDs      []int32
	listUserID     int32
	listSince      time.Time
	listLimit      int32
	attachedUserID int32
	attachedHash   []byte
	attachedIDs    []int32
	attachedSince  time.Time
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

func (r *recordingViewRepository) ListRecentIDs(_ context.Context, userID int32, since time.Time, limit int32) ([]int32, error) {
	r.listUserID = userID
	r.listSince = since
	r.listLimit = limit
	return r.recentIDs, nil
}

func (r *recordingViewRepository) AttachGuestHistory(_ context.Context, userID int32, guestHash []byte, houseIDs []int32, since time.Time) error {
	r.attachedUserID = userID
	r.attachedHash = append([]byte(nil), guestHash...)
	r.attachedIDs = append([]int32(nil), houseIDs...)
	r.attachedSince = since
	return nil
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

func TestViewedListingIDsUsesBoundedRecentWindow(t *testing.T) {
	repo := &recordingViewRepository{recentIDs: []int32{9, 4}}
	service := &Service{viewRepo: repo}

	before := time.Now().UTC().AddDate(0, 0, -viewHistoryDays).Add(-time.Second)
	got, err := service.ViewedListingIDs(context.Background(), 17)
	if err != nil {
		t.Fatalf("ViewedListingIDs() error = %v", err)
	}
	after := time.Now().UTC().AddDate(0, 0, -viewHistoryDays).Add(time.Second)
	if !slices.Equal(got, repo.recentIDs) {
		t.Fatalf("ViewedListingIDs() = %v, want %v", got, repo.recentIDs)
	}
	if repo.listUserID != 17 || repo.listLimit != viewHistoryLimit {
		t.Fatalf("list args = user %d, limit %d", repo.listUserID, repo.listLimit)
	}
	if repo.listSince.Before(before) || repo.listSince.After(after) {
		t.Fatalf("list since = %v, want about 90 days ago", repo.listSince)
	}
}

func TestAttachGuestViewHistoryHashesGuestAndDeduplicatesIDs(t *testing.T) {
	repo := &recordingViewRepository{}
	service := &Service{viewRepo: repo}

	if err := service.AttachGuestViewHistory(context.Background(), 23, " guest-device ", []int32{7, 7, 8}); err != nil {
		t.Fatalf("AttachGuestViewHistory() error = %v", err)
	}
	wantHash := sha256.Sum256([]byte("guest:guest-device"))
	if repo.attachedUserID != 23 || !bytes.Equal(repo.attachedHash, wantHash[:]) {
		t.Fatalf("attached identity = user %d, hash %x", repo.attachedUserID, repo.attachedHash)
	}
	if len(repo.attachedIDs) != 2 || repo.attachedIDs[0] != 7 || repo.attachedIDs[1] != 8 {
		t.Fatalf("attached ids = %v, want [7 8]", repo.attachedIDs)
	}
}
