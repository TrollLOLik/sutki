package attachmentmoderation

import (
	"context"
	"errors"
	"image"
	"image/color"
	"image/jpeg"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/TrollLOLik/sutki/backend/internal/domain"
	"github.com/TrollLOLik/sutki/backend/internal/infrastructure/videoframes"
)

// --- fakes -----------------------------------------------------------------

type fakeRepo struct {
	mu sync.Mutex

	jobs []domain.AttachmentModerationJob

	statuses        map[int64]string
	completed       map[int64]string // jobID -> decision
	completedFrames map[int64]int32
	retried         map[int64]time.Time
	rejected        map[int64]bool
	failed          map[int64]bool
	rejectionReason map[int64]string
	videoMeta       map[int64]string // attachmentID -> thumbnail key
	orphanedKey     string
	pendingCount    int64
	releaseCalls    int
}

func newFakeRepo() *fakeRepo {
	return &fakeRepo{
		statuses:        map[int64]string{},
		completed:       map[int64]string{},
		completedFrames: map[int64]int32{},
		retried:         map[int64]time.Time{},
		rejected:        map[int64]bool{},
		failed:          map[int64]bool{},
		rejectionReason: map[int64]string{},
		videoMeta:       map[int64]string{},
		orphanedKey:     videoJob().ObjectKey,
	}
}

func (r *fakeRepo) ReleaseStaleAttachmentJobs(context.Context, time.Duration) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.releaseCalls++
	return nil
}

func (r *fakeRepo) ClaimAttachmentModerationJobs(_ context.Context, batchSize int32) ([]domain.AttachmentModerationJob, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	if len(r.jobs) == 0 {
		return nil, nil
	}
	n := int(batchSize)
	if n > len(r.jobs) {
		n = len(r.jobs)
	}
	out := r.jobs[:n]
	r.jobs = r.jobs[n:]
	return out, nil
}

func (r *fakeRepo) CompleteAttachmentModeration(_ context.Context, jobID int64, decision, _, _ string, _ float32, frames int32) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.completed[jobID] = decision
	r.completedFrames[jobID] = frames
	return nil
}

func (r *fakeRepo) RetryAttachmentModeration(_ context.Context, jobID int64, next time.Time, _ string) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.retried[jobID] = next
	return nil
}

func (r *fakeRepo) FailAttachment(_ context.Context, jobID, attachmentID int64, reason, _ string) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.failed[attachmentID] = true
	r.statuses[attachmentID] = domain.AttachmentModerationFailed
	r.rejectionReason[attachmentID] = reason
	r.completed[jobID] = "failed"
	return nil
}

func (r *fakeRepo) SetAttachmentModerationStatus(_ context.Context, attachmentID int64, status string) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.statuses[attachmentID] = status
	return nil
}

func (r *fakeRepo) SetAttachmentVideoMeta(_ context.Context, attachmentID int64, _ *int32, thumbnailURL string) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.videoMeta[attachmentID] = thumbnailURL
	return nil
}

func (r *fakeRepo) RejectAttachment(
	_ context.Context,
	jobID, attachmentID int64,
	_, reason string,
	_ float32,
	frames int32,
) ([]string, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.rejected[attachmentID] = true
	r.rejectionReason[attachmentID] = reason
	r.statuses[attachmentID] = domain.AttachmentModerationRejected
	r.completed[jobID] = string(domain.ImageModerationReject)
	r.completedFrames[jobID] = frames
	if r.orphanedKey == "" {
		return nil, nil
	}
	return []string{r.orphanedKey}, nil
}

func (r *fakeRepo) CountPendingAttachments(context.Context, int64) (int64, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	return r.pendingCount, nil
}

type fakeStorage struct {
	mu      sync.Mutex
	objects map[string][]byte
	deleted []string
	// readErr makes ReadObject fail, simulating storage trouble.
	readErr error
}

func newFakeStorage() *fakeStorage {
	return &fakeStorage{objects: map[string][]byte{}}
}

func (s *fakeStorage) ReadObject(_ context.Context, key string, _ int64) (domain.ObjectData, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.readErr != nil {
		return domain.ObjectData{}, s.readErr
	}
	data, ok := s.objects[key]
	if !ok {
		return domain.ObjectData{}, errors.New("not found")
	}
	return domain.ObjectData{Bytes: data, ContentType: "video/mp4"}, nil
}

func (s *fakeStorage) PutObject(_ context.Context, key string, data []byte, _ string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.objects[key] = data
	return nil
}

func (s *fakeStorage) Delete(_ context.Context, key string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.deleted = append(s.deleted, key)
	delete(s.objects, key)
	return nil
}

func (s *fakeStorage) deletedKeys() []string {
	s.mu.Lock()
	defer s.mu.Unlock()
	return append([]string(nil), s.deleted...)
}

func (s *fakeStorage) PresignUpload(context.Context, string, int64, string) (domain.UploadTarget, error) {
	return domain.UploadTarget{}, errors.New("not implemented")
}
func (s *fakeStorage) PresignGet(context.Context, string, time.Duration) (string, error) {
	return "", errors.New("not implemented")
}
func (s *fakeStorage) StatObject(context.Context, string) (domain.ObjectInfo, error) {
	return domain.ObjectInfo{}, errors.New("not implemented")
}
func (s *fakeStorage) CopyObjectIfMatch(context.Context, string, string, string) (domain.ObjectInfo, error) {
	return domain.ObjectInfo{}, errors.New("not implemented")
}
func (s *fakeStorage) PublicURL(key string) string { return "https://example.invalid/" + key }

type fakeExtractor struct {
	available  bool
	info       videoframes.MediaInfo
	probeErr   error
	frameCount int
	framesErr  error
	coverErr   error
	lastOpts   videoframes.ExtractOptions
}

func (e *fakeExtractor) Available() bool { return e.available }

func (e *fakeExtractor) Probe(context.Context, string) (videoframes.MediaInfo, error) {
	if e.probeErr != nil {
		return videoframes.MediaInfo{}, e.probeErr
	}
	return e.info, nil
}

func (e *fakeExtractor) ExtractFrames(_ context.Context, _, destDir string, opts videoframes.ExtractOptions) ([]string, error) {
	if e.framesErr != nil {
		return nil, e.framesErr
	}
	e.lastOpts = opts
	paths := make([]string, 0, e.frameCount)
	for i := 0; i < e.frameCount; i++ {
		p := filepath.Join(destDir, "frame_"+string(rune('a'+i))+".jpg")
		file, err := os.OpenFile(p, os.O_WRONLY|os.O_CREATE|os.O_TRUNC, 0o600)
		if err != nil {
			return nil, err
		}
		frame := image.NewRGBA(image.Rect(0, 0, 8, 8))
		for y := 0; y < 8; y++ {
			for x := 0; x < 8; x++ {
				frame.Set(x, y, color.RGBA{R: uint8(i * 20), G: 120, B: 200, A: 255})
			}
		}
		if err := jpeg.Encode(file, frame, &jpeg.Options{Quality: 80}); err != nil {
			_ = file.Close()
			return nil, err
		}
		if err := file.Close(); err != nil {
			return nil, err
		}
		paths = append(paths, p)
	}
	return paths, nil
}

func (e *fakeExtractor) ExtractCover(_ context.Context, _, destPath string, _ int) error {
	if e.coverErr != nil {
		return e.coverErr
	}
	return os.WriteFile(destPath, []byte("cover"), 0o600)
}

type fakeModerator struct {
	result  domain.ImageModerationResult
	results []domain.ImageModerationResult
	err     error
	// keys records what was actually sent for checking.
	mu    sync.Mutex
	keys  []string
	calls int
}

func (m *fakeModerator) ModerateStoredKeys(_ context.Context, keys []string, _ string) (domain.ImageModerationResult, error) {
	m.mu.Lock()
	m.keys = append(m.keys, keys...)
	call := m.calls
	m.calls++
	defer m.mu.Unlock()
	if m.err != nil {
		return domain.ImageModerationResult{}, m.err
	}
	if call < len(m.results) {
		return m.results[call], nil
	}
	return m.result, nil
}

func (m *fakeModerator) sentKeys() []string {
	m.mu.Lock()
	defer m.mu.Unlock()
	return append([]string(nil), m.keys...)
}

type fakeNotifier struct {
	mu        sync.Mutex
	approved  []int64
	rejected  []int64
	failed    []int64
	rejectMsg string
}

type fakeAdminQueueNotifier struct {
	events chan domain.AdminQueueEvent
}

func (f *fakeAdminQueueNotifier) NotifyAdminQueue(_ context.Context, event domain.AdminQueueEvent) error {
	f.events <- event
	return nil
}

func (n *fakeNotifier) AttachmentApproved(_ context.Context, _, messageID int64) {
	n.mu.Lock()
	defer n.mu.Unlock()
	n.approved = append(n.approved, messageID)
}

func (n *fakeNotifier) AttachmentRejected(_ context.Context, _, messageID int64, reason string) {
	n.mu.Lock()
	defer n.mu.Unlock()
	n.rejected = append(n.rejected, messageID)
	n.rejectMsg = reason
}

func (n *fakeNotifier) AttachmentFailed(_ context.Context, _, messageID int64, _ string) {
	n.mu.Lock()
	defer n.mu.Unlock()
	n.failed = append(n.failed, messageID)
}

func (n *fakeNotifier) counts() (int, int) {
	n.mu.Lock()
	defer n.mu.Unlock()
	return len(n.approved), len(n.rejected)
}

// --- helpers ---------------------------------------------------------------

func newTestService(t *testing.T, repo *fakeRepo, storage *fakeStorage, ext *fakeExtractor, mod *fakeModerator, notifier *fakeNotifier) *Service {
	t.Helper()
	return New(Config{
		Repo:            repo,
		Storage:         storage,
		Extractor:       ext,
		Moderator:       mod,
		Notifier:        notifier,
		WorkDir:         t.TempDir(),
		MaxVideoSeconds: 60,
	})
}

func videoJob() domain.AttachmentModerationJob {
	return domain.AttachmentModerationJob{
		ID: 1, AttachmentID: 10, MessageID: 100, ConversationID: 1000,
		ObjectKey: "chat/uploads/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.mp4",
		MimeType:  "video/mp4", Kind: domain.AttachmentKindVideo, Attempts: 1,
	}
}

func approved() domain.ImageModerationResult {
	return domain.ImageModerationResult{Decision: domain.ImageModerationApprove, Category: "safe", Confidence: 1}
}

// --- tests -----------------------------------------------------------------

func TestApprovedVideoBecomesVisibleAndGetsCover(t *testing.T) {
	repo := newFakeRepo()
	storage := newFakeStorage()
	job := videoJob()
	storage.objects[job.ObjectKey] = []byte("video bytes")

	ext := &fakeExtractor{available: true, info: videoframes.MediaInfo{DurationSeconds: 30, HasVideoStream: true}, frameCount: 8}
	mod := &fakeModerator{result: approved()}
	notifier := &fakeNotifier{}
	svc := newTestService(t, repo, storage, ext, mod, notifier)

	svc.processJob(context.Background(), job)

	if got := repo.statuses[job.AttachmentID]; got != domain.AttachmentModerationApproved {
		t.Fatalf("expected attachment approved, got %q", got)
	}
	if got := repo.completed[job.ID]; got != string(domain.ImageModerationApprove) {
		t.Fatalf("expected job completed as approve, got %q", got)
	}
	// The verdict has to record how many frames were actually inspected — that is
	// the audit trail when someone complains a video slipped through.
	if got := repo.completedFrames[job.ID]; got != 8 {
		t.Fatalf("expected 8 frames recorded, got %d", got)
	}
	// A cover is what the feed renders instead of an inline player.
	if repo.videoMeta[job.AttachmentID] == "" {
		t.Fatal("expected a cover key to be stored")
	}
	approvedCount, _ := notifier.counts()
	if approvedCount != 1 {
		t.Fatalf("expected one approval notification, got %d", approvedCount)
	}
	if keys := mod.sentKeys(); len(keys) != 2 {
		t.Fatalf("expected two contact-sheet requests for 8 frames, got %d (%v)", len(keys), keys)
	}
	if ext.lastOpts.MaxFrames != 12 || ext.lastOpts.Width != 1280 || ext.lastOpts.DurationSeconds != 30 {
		t.Fatalf("unexpected extraction policy: %+v", ext.lastOpts)
	}
}

func TestShortVideoUsesOneSixFrameSheet(t *testing.T) {
	repo := newFakeRepo()
	storage := newFakeStorage()
	job := videoJob()
	storage.objects[job.ObjectKey] = []byte("video bytes")

	ext := &fakeExtractor{available: true, info: videoframes.MediaInfo{DurationSeconds: 15, HasVideoStream: true}, frameCount: 6}
	mod := &fakeModerator{result: approved()}
	svc := newTestService(t, repo, storage, ext, mod, &fakeNotifier{})

	svc.processJob(context.Background(), job)

	if ext.lastOpts.MaxFrames != 6 {
		t.Fatalf("expected short video to sample at most six frames, got %+v", ext.lastOpts)
	}
	if keys := mod.sentKeys(); len(keys) != 1 || !strings.Contains(keys[0], ".sheets/") {
		t.Fatalf("expected one contact-sheet request, got %v", keys)
	}
}

func TestVideoFrameLimitIsClampedToTwelve(t *testing.T) {
	svc := New(Config{MaxVideoFrames: 100})
	if svc.maxFrames != 12 {
		t.Fatalf("expected the paid-work ceiling to be clamped to 12 frames, got %d", svc.maxFrames)
	}
}

func TestLowConfidenceSheetEscalatesToOriginalFrames(t *testing.T) {
	repo := newFakeRepo()
	storage := newFakeStorage()
	job := videoJob()
	storage.objects[job.ObjectKey] = []byte("video bytes")

	ext := &fakeExtractor{available: true, info: videoframes.MediaInfo{DurationSeconds: 45, HasVideoStream: true}, frameCount: 8}
	mod := &fakeModerator{results: []domain.ImageModerationResult{
		{Decision: domain.ImageModerationApprove, Category: "safe", Confidence: 0.7},
		approved(),
	}}
	svc := newTestService(t, repo, storage, ext, mod, &fakeNotifier{})

	svc.processJob(context.Background(), job)

	if got := repo.statuses[job.AttachmentID]; got != domain.AttachmentModerationApproved {
		t.Fatalf("expected full-resolution escalation to approve, got %q", got)
	}
	// Two sheets are checked first, followed by all eight original frames.
	if keys := mod.sentKeys(); len(keys) != 10 {
		t.Fatalf("expected 2 sheet keys plus 8 frame keys, got %d (%v)", len(keys), keys)
	}
}

// Frames are uploaded to storage for checking and must be cleaned up afterwards,
// or every video permanently leaves 8-10 stray objects behind.
func TestTemporaryFramesAreDeleted(t *testing.T) {
	repo := newFakeRepo()
	storage := newFakeStorage()
	job := videoJob()
	storage.objects[job.ObjectKey] = []byte("video bytes")

	ext := &fakeExtractor{available: true, info: videoframes.MediaInfo{DurationSeconds: 10, HasVideoStream: true}, frameCount: 3}
	mod := &fakeModerator{result: approved()}
	svc := newTestService(t, repo, storage, ext, mod, &fakeNotifier{})

	svc.processJob(context.Background(), job)

	sheetKeys := 0
	for _, key := range storage.deletedKeys() {
		if strings.HasPrefix(key, job.ObjectKey+".sheets/") {
			sheetKeys++
		}
	}
	if sheetKeys != 1 {
		t.Fatalf("expected one temporary contact sheet deleted, got %d (%v)", sheetKeys, storage.deletedKeys())
	}
}

func TestRejectedVideoIsDeletedEverywhere(t *testing.T) {
	repo := newFakeRepo()
	storage := newFakeStorage()
	job := videoJob()
	storage.objects[job.ObjectKey] = []byte("video bytes")

	ext := &fakeExtractor{available: true, info: videoframes.MediaInfo{DurationSeconds: 20, HasVideoStream: true}, frameCount: 5}
	mod := &fakeModerator{result: domain.ImageModerationResult{
		Decision: domain.ImageModerationReject, Category: "sexual", Reason: "нарушение", Confidence: 1,
	}}
	notifier := &fakeNotifier{}
	svc := newTestService(t, repo, storage, ext, mod, notifier)

	svc.processJob(context.Background(), job)

	if !repo.rejected[job.AttachmentID] {
		t.Fatal("expected the attachment to become a rejected tombstone")
	}
	if repo.rejectionReason[job.AttachmentID] == "" {
		t.Fatal("expected the rejection reason to be stored on the tombstone")
	}
	// The original object must go too, not just the database row.
	foundOriginal := false
	for _, key := range storage.deletedKeys() {
		if key == job.ObjectKey {
			foundOriginal = true
		}
	}
	if !foundOriginal {
		t.Fatalf("expected the original object to be deleted, got %v", storage.deletedKeys())
	}
	_, rejectedCount := notifier.counts()
	if rejectedCount != 1 {
		t.Fatalf("expected one rejection notification, got %d", rejectedCount)
	}
	// The sender must not be left with an eternal spinner and no explanation.
	if notifier.rejectMsg == "" {
		t.Fatal("expected a reason in the rejection notification")
	}
}

func TestRejectedReferenceDoesNotDeleteSharedObject(t *testing.T) {
	repo := newFakeRepo()
	repo.orphanedKey = ""
	storage := newFakeStorage()
	job := videoJob()
	storage.objects[job.ObjectKey] = []byte("video bytes")

	ext := &fakeExtractor{
		available:  true,
		info:       videoframes.MediaInfo{DurationSeconds: 5, HasVideoStream: true},
		frameCount: 2,
	}
	mod := &fakeModerator{result: domain.ImageModerationResult{
		Decision:   domain.ImageModerationReject,
		Category:   "sexual",
		Reason:     "violation",
		Confidence: 1,
	}}
	svc := newTestService(t, repo, storage, ext, mod, &fakeNotifier{})

	svc.processJob(context.Background(), job)

	for _, key := range storage.deletedKeys() {
		if key == job.ObjectKey {
			t.Fatalf("shared object %q was deleted while another reference exists", key)
		}
	}
}

// "review" means the model was unsure. There is no human queue for chat media,
// so an unresolvable attachment is dropped rather than left pending forever.
func TestReviewVerdictIsTreatedAsRejection(t *testing.T) {
	repo := newFakeRepo()
	storage := newFakeStorage()
	job := videoJob()
	storage.objects[job.ObjectKey] = []byte("video bytes")

	ext := &fakeExtractor{available: true, info: videoframes.MediaInfo{DurationSeconds: 15, HasVideoStream: true}, frameCount: 4}
	mod := &fakeModerator{result: domain.ImageModerationResult{
		Decision: domain.ImageModerationReview, Category: "other", Confidence: 0.4,
	}}
	svc := newTestService(t, repo, storage, ext, mod, &fakeNotifier{})

	svc.processJob(context.Background(), job)

	if !repo.rejected[job.AttachmentID] {
		t.Fatal("expected an unresolved attachment to be dropped, not left pending")
	}
	if got := repo.statuses[job.AttachmentID]; got == domain.AttachmentModerationApproved {
		t.Fatal("a review verdict must never approve")
	}
}

// Duration is enforced server-side: a client claiming 30 seconds proves nothing.
func TestOverlongVideoIsRejectedWithoutModeration(t *testing.T) {
	repo := newFakeRepo()
	storage := newFakeStorage()
	job := videoJob()
	storage.objects[job.ObjectKey] = []byte("video bytes")

	ext := &fakeExtractor{available: true, info: videoframes.MediaInfo{DurationSeconds: 300, HasVideoStream: true}, frameCount: 8}
	mod := &fakeModerator{result: approved()}
	svc := newTestService(t, repo, storage, ext, mod, &fakeNotifier{})

	svc.processJob(context.Background(), job)

	if !repo.rejected[job.AttachmentID] {
		t.Fatal("expected an over-length video to be rejected")
	}
	// No point paying for vision calls on a file that fails policy anyway.
	if len(mod.sentKeys()) != 0 {
		t.Fatalf("expected no moderation calls for an over-length video, got %v", mod.sentKeys())
	}
}

// A file that ffprobe cannot read is not valid media: reject, do not retry.
func TestUnprobeableFileIsRejected(t *testing.T) {
	repo := newFakeRepo()
	storage := newFakeStorage()
	job := videoJob()
	storage.objects[job.ObjectKey] = []byte("not a video")

	ext := &fakeExtractor{available: true, probeErr: videoframes.ErrProbeFailed}
	svc := newTestService(t, repo, storage, ext, &fakeModerator{result: approved()}, &fakeNotifier{})

	svc.processJob(context.Background(), job)

	if !repo.rejected[job.AttachmentID] {
		t.Fatal("expected an unprobeable file to be rejected")
	}
	if len(repo.retried) != 0 {
		t.Fatal("a corrupt file must not be retried")
	}
}

// Infrastructure trouble is different: retry, and keep the attachment pending so
// nothing unverified reaches the recipient.
func TestTransientFailureRetriesAndKeepsPending(t *testing.T) {
	repo := newFakeRepo()
	storage := newFakeStorage()
	storage.readErr = errors.New("storage unavailable")
	job := videoJob()

	ext := &fakeExtractor{available: true}
	svc := newTestService(t, repo, storage, ext, &fakeModerator{result: approved()}, &fakeNotifier{})

	svc.processJob(context.Background(), job)

	if _, retried := repo.retried[job.ID]; !retried {
		t.Fatal("expected the job to be rescheduled")
	}
	if repo.rejected[job.AttachmentID] {
		t.Fatal("a transient failure must not delete the attachment")
	}
	if got := repo.statuses[job.AttachmentID]; got == domain.AttachmentModerationApproved {
		t.Fatal("an unchecked attachment must never be approved")
	}
}

// After the retry budget is spent the attachment is dropped: leaving the sender
// on "Проверяется" indefinitely is worse than telling them it failed.
func TestExhaustedRetriesMarkAttachmentFailed(t *testing.T) {
	repo := newFakeRepo()
	storage := newFakeStorage()
	storage.readErr = errors.New("storage still unavailable")
	job := videoJob()
	job.Attempts = maxAttempts

	svc := newTestService(t, repo, storage, &fakeExtractor{available: true}, &fakeModerator{result: approved()}, &fakeNotifier{})
	queue := &fakeAdminQueueNotifier{events: make(chan domain.AdminQueueEvent, 1)}
	svc.SetAdminQueueNotifier(queue)

	svc.processJob(context.Background(), job)

	if !repo.failed[job.AttachmentID] {
		t.Fatal("expected the attachment to become retryable after the retry budget")
	}
	if repo.rejected[job.AttachmentID] {
		t.Fatal("provider trouble must not be recorded as a policy rejection")
	}
	if len(storage.deleted) != 0 {
		t.Fatal("a retryable upload must remain in storage")
	}
	if _, retried := repo.retried[job.ID]; retried {
		t.Fatal("expected no further retry after the budget is spent")
	}
	select {
	case event := <-queue.events:
		if event.Kind != domain.AdminInboxKindAttachment || event.ID != job.AttachmentID {
			t.Fatalf("admin queue event = %#v", event)
		}
	case <-time.After(time.Second):
		t.Fatal("timed out waiting for attachment admin queue notification")
	}
}

func TestInvalidVisionRequestIsNotRetried(t *testing.T) {
	for _, message := range []string{
		"llm client: empty vision response (finish_reason=length)",
		"decode image moderation verdict: unexpected end of JSON input",
		`llm client: vision status 400: unknown field "enable_thinking"`,
		"llm client: vision status 403: Project not found. Please contact support",
	} {
		if !isNonRetryableModerationError(errors.New(message)) {
			t.Fatalf("expected non-retryable moderation error: %s", message)
		}
	}
	if isNonRetryableModerationError(errors.New("llm client: vision request failed: timeout")) {
		t.Fatal("a transient transport timeout must remain retryable")
	}
}

// An album is delivered only when nothing of it is pending: three of five photos
// appearing would look broken.
func TestApprovalWaitsForRemainingAttachments(t *testing.T) {
	repo := newFakeRepo()
	repo.pendingCount = 2 // siblings still being checked
	storage := newFakeStorage()
	job := videoJob()
	job.Kind = domain.AttachmentKindImage

	notifier := &fakeNotifier{}
	svc := newTestService(t, repo, storage, &fakeExtractor{available: true}, &fakeModerator{result: approved()}, notifier)

	svc.processJob(context.Background(), job)

	if got := repo.statuses[job.AttachmentID]; got != domain.AttachmentModerationApproved {
		t.Fatalf("this attachment should still be approved, got %q", got)
	}
	approvedCount, _ := notifier.counts()
	if approvedCount != 0 {
		t.Fatal("must not deliver the message while siblings are pending")
	}
}

// A still image needs no frame extraction — that path must stay cheap.
func TestImageSkipsFrameExtraction(t *testing.T) {
	repo := newFakeRepo()
	storage := newFakeStorage()
	job := videoJob()
	job.Kind = domain.AttachmentKindImage
	job.MimeType = "image/jpeg"

	// framesErr would fire if the code tried to extract frames for an image.
	ext := &fakeExtractor{available: true, framesErr: errors.New("must not be called")}
	mod := &fakeModerator{result: approved()}
	svc := newTestService(t, repo, storage, ext, mod, &fakeNotifier{})

	svc.processJob(context.Background(), job)

	if got := repo.statuses[job.AttachmentID]; got != domain.AttachmentModerationApproved {
		t.Fatalf("expected image approved, got %q", got)
	}
	keys := mod.sentKeys()
	if len(keys) != 1 || keys[0] != job.ObjectKey {
		t.Fatalf("expected the original key checked directly, got %v", keys)
	}
}

// An animated GIF must be sampled, not handed over as a single still: that was
// the "safe cover, violation at second three" gap.
func TestAnimatedImageIsSampledIntoFrames(t *testing.T) {
	repo := newFakeRepo()
	storage := newFakeStorage()
	job := videoJob()
	job.Kind = domain.AttachmentKindAnimated
	job.MimeType = "image/gif"
	storage.objects[job.ObjectKey] = []byte("gif bytes")

	ext := &fakeExtractor{available: true, info: videoframes.MediaInfo{DurationSeconds: 3, HasVideoStream: true}, frameCount: 3}
	mod := &fakeModerator{result: approved()}
	svc := newTestService(t, repo, storage, ext, mod, &fakeNotifier{})

	svc.processJob(context.Background(), job)

	keys := mod.sentKeys()
	if len(keys) != 1 {
		t.Fatalf("expected one contact sheet to be checked, got %d (%v)", len(keys), keys)
	}
	for _, key := range keys {
		if key == job.ObjectKey {
			t.Fatal("the GIF itself must not be checked as a single still")
		}
	}
}

// Without ffmpeg video cannot be verified. It must retry, never pass through.
func TestMissingFFmpegRetriesRatherThanApproves(t *testing.T) {
	repo := newFakeRepo()
	storage := newFakeStorage()
	job := videoJob()
	storage.objects[job.ObjectKey] = []byte("video bytes")

	ext := &fakeExtractor{available: false}
	svc := newTestService(t, repo, storage, ext, &fakeModerator{result: approved()}, &fakeNotifier{})

	svc.processJob(context.Background(), job)

	if got := repo.statuses[job.AttachmentID]; got == domain.AttachmentModerationApproved {
		t.Fatal("video must never be approved without a frame check")
	}
	if _, retried := repo.retried[job.ID]; !retried {
		t.Fatal("expected the job to be retried while ffmpeg is unavailable")
	}
}

// A missing cover is cosmetic and must not undo an approval.
func TestCoverFailureDoesNotBlockApproval(t *testing.T) {
	repo := newFakeRepo()
	storage := newFakeStorage()
	job := videoJob()
	storage.objects[job.ObjectKey] = []byte("video bytes")

	ext := &fakeExtractor{
		available:  true,
		info:       videoframes.MediaInfo{DurationSeconds: 10, HasVideoStream: true},
		frameCount: 3,
		coverErr:   errors.New("cover failed"),
	}
	svc := newTestService(t, repo, storage, ext, &fakeModerator{result: approved()}, &fakeNotifier{})

	svc.processJob(context.Background(), job)

	if got := repo.statuses[job.AttachmentID]; got != domain.AttachmentModerationApproved {
		t.Fatalf("expected approval despite a cover failure, got %q", got)
	}
}

// The worker must reclaim jobs abandoned by a dead process before taking new
// ones, or an attachment stays pending forever and is never delivered.
func TestProcessDueReleasesStaleJobsFirst(t *testing.T) {
	repo := newFakeRepo()
	svc := newTestService(t, repo, newFakeStorage(), &fakeExtractor{available: true}, &fakeModerator{result: approved()}, &fakeNotifier{})

	svc.processDue(context.Background())

	if repo.releaseCalls == 0 {
		t.Fatal("expected stale jobs to be released before claiming")
	}
}

func TestWakeIsNonBlocking(t *testing.T) {
	svc := newTestService(t, newFakeRepo(), newFakeStorage(), &fakeExtractor{available: true}, &fakeModerator{}, &fakeNotifier{})

	// Several wakes with no worker draining the channel must not block the
	// caller — Wake runs on the request path that just uploaded a file.
	done := make(chan struct{})
	go func() {
		for i := 0; i < 100; i++ {
			svc.Wake()
		}
		close(done)
	}()

	select {
	case <-done:
	case <-time.After(2 * time.Second):
		t.Fatal("Wake blocked")
	}
}
