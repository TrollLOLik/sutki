package imagemoderation

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"image"
	"image/color"
	"image/png"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/TrollLOLik/sutki/backend/internal/domain"
)

// pngBytes builds a real 1x1 PNG. imageDataURL sniffs the actual content type
// via http.DetectContentType, so a fake byte slice would be rejected as an
// unsupported image before moderation is ever reached.
func pngBytes(t *testing.T) []byte {
	t.Helper()
	img := image.NewRGBA(image.Rect(0, 0, 1, 1))
	img.Set(0, 0, color.RGBA{R: 10, G: 20, B: 30, A: 255})
	var buf bytes.Buffer
	if err := png.Encode(&buf, img); err != nil {
		t.Fatalf("encode png: %v", err)
	}
	return buf.Bytes()
}

type fakeStorage struct {
	data []byte
	// failKey makes ReadObject fail for one specific key.
	failKey string
}

func (f *fakeStorage) ReadObject(_ context.Context, key string, _ int64) (domain.ObjectData, error) {
	if f.failKey != "" && key == f.failKey {
		return domain.ObjectData{}, errors.New("storage unavailable")
	}
	return domain.ObjectData{Bytes: f.data, ContentType: "image/png"}, nil
}

func (f *fakeStorage) PresignUpload(context.Context, string, int64, string) (domain.UploadTarget, error) {
	return domain.UploadTarget{}, errors.New("not implemented")
}
func (f *fakeStorage) PresignGet(context.Context, string, time.Duration) (string, error) {
	return "", errors.New("not implemented")
}
func (f *fakeStorage) StatObject(context.Context, string) (domain.ObjectInfo, error) {
	return domain.ObjectInfo{}, errors.New("not implemented")
}
func (f *fakeStorage) PublicURL(key string) string          { return "https://example.invalid/" + key }
func (f *fakeStorage) Delete(context.Context, string) error { return nil }

// fakeModerator returns a per-call verdict and records concurrency.
type fakeModerator struct {
	mu       sync.Mutex
	verdicts map[string]domain.ImageModerationResult
	// dataURLByCall records how many images each request carried.
	callSizes []int

	inFlight    atomic.Int32
	maxInFlight atomic.Int32
	calls       atomic.Int32
	delay       time.Duration
	// verdictFor resolves a verdict by call order when verdicts is nil.
	verdictForCall func(n int32) domain.ImageModerationResult
}

func (f *fakeModerator) ModerateImages(ctx context.Context, imageURLs []string, _ string) (domain.ImageModerationResult, error) {
	current := f.inFlight.Add(1)
	for {
		max := f.maxInFlight.Load()
		if current <= max || f.maxInFlight.CompareAndSwap(max, current) {
			break
		}
	}
	defer f.inFlight.Add(-1)

	n := f.calls.Add(1)

	f.mu.Lock()
	f.callSizes = append(f.callSizes, len(imageURLs))
	f.mu.Unlock()

	if f.delay > 0 {
		select {
		case <-time.After(f.delay):
		case <-ctx.Done():
			return domain.ImageModerationResult{}, ctx.Err()
		}
	}

	if f.verdictForCall != nil {
		return f.verdictForCall(n), nil
	}
	return domain.ImageModerationResult{Decision: domain.ImageModerationApprove, Category: "safe", Confidence: 1}, nil
}

func keys(n int) []string {
	out := make([]string, n)
	for i := range out {
		out[i] = fmt.Sprintf("chat/uploads/%032d.png", i)
	}
	return out
}

// One vision request per image is a security requirement, not an optimisation:
// some providers only inspect the first image of a multi-image prompt, which
// previously let an unsafe non-cover photo through.
func TestModerateStoredImagesSendsOneImagePerRequest(t *testing.T) {
	storage := &fakeStorage{data: pngBytes(t)}
	moderator := &fakeModerator{}

	if _, err := ModerateStoredImages(context.Background(), moderator, storage, keys(5), "chat", 1<<20); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if got := moderator.calls.Load(); got != 5 {
		t.Fatalf("expected 5 moderation calls, got %d", got)
	}
	for i, size := range moderator.callSizes {
		if size != 1 {
			t.Fatalf("call %d carried %d images, expected exactly 1", i, size)
		}
	}
}

func TestModerateStoredImagesRunsInBoundedParallel(t *testing.T) {
	storage := &fakeStorage{data: pngBytes(t)}
	moderator := &fakeModerator{delay: 30 * time.Millisecond}

	if _, err := ModerateStoredImages(context.Background(), moderator, storage, keys(10), "chat", 1<<20); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	max := moderator.maxInFlight.Load()
	if max > moderationConcurrency {
		t.Fatalf("concurrency limit exceeded: %d in flight, limit %d", max, moderationConcurrency)
	}
	// Parallelism has to actually happen — a sequential loop would also satisfy
	// the bound above and reintroduce the multi-minute album.
	if max < 2 {
		t.Fatalf("expected concurrent moderation, peak in-flight was %d", max)
	}
}

// The verdict must not depend on which request finished first.
func TestModerateStoredImagesRejectWinsRegardlessOfOrder(t *testing.T) {
	storage := &fakeStorage{data: pngBytes(t)}

	// The last image to be dispatched is the offending one, so an
	// order-dependent implementation would return approve.
	moderator := &fakeModerator{
		verdictForCall: func(n int32) domain.ImageModerationResult {
			if n == 8 {
				return domain.ImageModerationResult{Decision: domain.ImageModerationReject, Category: "sexual", Confidence: 1}
			}
			return domain.ImageModerationResult{Decision: domain.ImageModerationApprove, Category: "safe", Confidence: 1}
		},
	}

	result, err := ModerateStoredImages(context.Background(), moderator, storage, keys(8), "chat", 1<<20)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if result.Decision != domain.ImageModerationReject {
		t.Fatalf("expected reject to win, got %q", result.Decision)
	}
	if result.Category != "sexual" {
		t.Fatalf("expected the rejecting verdict to be returned, got category %q", result.Category)
	}
}

// A review verdict survives when nothing is outright rejected.
func TestModerateStoredImagesReviewSurvives(t *testing.T) {
	storage := &fakeStorage{data: pngBytes(t)}
	moderator := &fakeModerator{
		verdictForCall: func(n int32) domain.ImageModerationResult {
			if n == 3 {
				return domain.ImageModerationResult{Decision: domain.ImageModerationReview, Category: "other", Confidence: 0.5}
			}
			return domain.ImageModerationResult{Decision: domain.ImageModerationApprove, Category: "safe", Confidence: 1}
		},
	}

	result, err := ModerateStoredImages(context.Background(), moderator, storage, keys(6), "chat", 1<<20)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if result.Decision != domain.ImageModerationReview {
		t.Fatalf("expected review, got %q", result.Decision)
	}
}

// A storage failure is an infrastructure problem and must surface as an error,
// not be silently treated as an approval.
func TestModerateStoredImagesStorageFailurePropagates(t *testing.T) {
	batch := keys(4)
	storage := &fakeStorage{data: pngBytes(t), failKey: batch[2]}
	moderator := &fakeModerator{}

	_, err := ModerateStoredImages(context.Background(), moderator, storage, batch, "chat", 1<<20)
	if err == nil {
		t.Fatal("expected an error when storage read fails")
	}
	if !errors.Is(err, domain.ErrImageModerationUnavailable) {
		t.Fatalf("expected ErrImageModerationUnavailable, got %v", err)
	}
}

// Single-image callers (avatars, listing previews) keep the direct path.
func TestModerateStoredImagesSingleKey(t *testing.T) {
	storage := &fakeStorage{data: pngBytes(t)}
	moderator := &fakeModerator{}

	result, err := ModerateStoredImages(context.Background(), moderator, storage, keys(1), "avatar", 1<<20)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if result.Decision != domain.ImageModerationApprove {
		t.Fatalf("expected approve, got %q", result.Decision)
	}
	if got := moderator.calls.Load(); got != 1 {
		t.Fatalf("expected exactly 1 call, got %d", got)
	}
}

func TestModerateStoredImagesEmptyBatchApproves(t *testing.T) {
	result, err := ModerateStoredImages(context.Background(), &fakeModerator{}, &fakeStorage{}, nil, "chat", 1<<20)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if result.Decision != domain.ImageModerationApprove {
		t.Fatalf("expected approve for an empty batch, got %q", result.Decision)
	}
}
