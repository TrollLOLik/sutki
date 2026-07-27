// Package attachmentmoderation runs chat attachment checks outside the request
// that uploaded them.
//
// Why asynchronous: a video has to be sampled into frames and inspected by a
// vision model. Even the cheap contact-sheet pass is too slow to hold an HTTP
// request open. So the attachment is stored as `pending`, the sender sees
// "Проверяется", the recipient sees nothing, and a background worker produces
// the verdict.
//
// Invariants, mirroring usecase/moderation:
//   - The model never blocks a user-facing request.
//   - An attachment we could not check stays `pending` and is retried. Failing
//     open (publishing unchecked media) is not an option for user-uploaded video.
//   - A junk verdict is treated as "not approved", never as approval.
//   - A dead worker cannot strand an attachment: the lease expires and the job
//     returns to the queue.
package attachmentmoderation

import (
	"context"
	"errors"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"github.com/TrollLOLik/sutki/backend/internal/domain"
	"github.com/TrollLOLik/sutki/backend/internal/infrastructure/videoframes"
	"github.com/TrollLOLik/sutki/backend/internal/observability"
)

const (
	// pollInterval matches the listing moderator. The wake channel handles the
	// latency-sensitive path, so a long tick is fine as a safety net.
	pollInterval = 15 * time.Second

	// batchSize is 1 on purpose. Frame extraction is CPU work and the target
	// server has two cores shared with the API; two concurrent ffmpeg processes
	// would make the API visibly slower. Vision calls inside one job still run
	// in bounded parallel (see imagemoderation).
	batchSize = 1

	// leaseTimeout is how long a claimed job may stay in `processing` before
	// another worker may take it. Generous relative to the worst case (probe +
	// extract + contact sheets + frame escalation) so a slow job is not stolen.
	leaseTimeout = 5 * time.Minute

	// maxAttempts before the attachment is rejected outright. Retrying forever
	// would leave the sender staring at "Проверяется" indefinitely; at some
	// point an unverifiable file has to be dropped.
	maxAttempts = 5

	// maxObjectBytes bounds what we pull from storage into the worker. Matches
	// the video size limit.
	maxObjectBytes = 50 * 1024 * 1024
)

// retryBackoff for transient failures (model down, ffmpeg hiccup).
var retryBackoff = []time.Duration{30 * time.Second, 2 * time.Minute, 10 * time.Minute, 30 * time.Minute}

// Repository is the persistence slice the worker needs.
type Repository interface {
	ReleaseStaleAttachmentJobs(ctx context.Context, lease time.Duration) error
	ClaimAttachmentModerationJobs(ctx context.Context, batchSize int32) ([]domain.AttachmentModerationJob, error)
	CompleteAttachmentModeration(ctx context.Context, jobID int64, decision, category, reason string, confidence float32, framesChecked int32) error
	RetryAttachmentModeration(ctx context.Context, jobID int64, nextAttemptAt time.Time, lastError string) error
	SetAttachmentModerationStatus(ctx context.Context, attachmentID int64, status string) error
	SetAttachmentVideoMeta(ctx context.Context, attachmentID int64, durationSeconds *int32, thumbnailURL string) error
	// DeleteAttachment removes one reference and returns the upload capability
	// and sealed object only when no other message still references them.
	DeleteAttachment(ctx context.Context, attachmentID int64) (orphanedObjectKeys []string, err error)
	CountPendingAttachments(ctx context.Context, messageID int64) (int64, error)
}

// Notifier publishes the outcome so clients can update without polling.
type Notifier interface {
	// AttachmentApproved fires once every attachment of a message has passed.
	// Only then may the message be delivered to the recipient.
	AttachmentApproved(ctx context.Context, conversationID, messageID int64)
	// AttachmentRejected fires when an attachment was dropped, so the sender
	// learns why instead of watching an eternal spinner.
	AttachmentRejected(ctx context.Context, conversationID, messageID int64, reason string)
}

// FrameExtractor is the videoframes slice used here.
type FrameExtractor interface {
	Available() bool
	Probe(ctx context.Context, path string) (videoframes.MediaInfo, error)
	ExtractFrames(ctx context.Context, path, destDir string, opts videoframes.ExtractOptions) ([]string, error)
	ExtractCover(ctx context.Context, path, destPath string, width int) error
}

// ImageModerator checks a batch of stored object keys.
type ImageModerator interface {
	ModerateStoredKeys(ctx context.Context, keys []string, usage string) (domain.ImageModerationResult, error)
}

// Config wires the worker.
type Config struct {
	Repo      Repository
	Storage   domain.FileStorage
	Extractor FrameExtractor
	Moderator ImageModerator
	Notifier  Notifier
	// WorkDir is where video files and frames are staged. Should be a tmpfs
	// mount with a size cap so a burst cannot fill the disk.
	WorkDir string
	// MaxVideoSeconds rejects clips longer than the policy allows. Checked here
	// and not only on the client: duration reported by a client is not evidence.
	MaxVideoSeconds int
	// MaxVideoFrames is the upper bound on uniformly sampled video frames.
	// The common path packs six frames into each paid vision request.
	MaxVideoFrames int
}

type Service struct {
	repo      Repository
	storage   domain.FileStorage
	extractor FrameExtractor
	moderator ImageModerator
	notifier  Notifier
	workDir   string
	maxVideo  int
	maxFrames int
	wake      chan struct{}
}

func New(cfg Config) *Service {
	workDir := cfg.WorkDir
	if workDir == "" {
		workDir = filepath.Join(os.TempDir(), "chat-moderation")
	}
	maxVideo := cfg.MaxVideoSeconds
	if maxVideo <= 0 {
		maxVideo = 60
	}
	maxFrames := cfg.MaxVideoFrames
	if maxFrames <= 0 {
		maxFrames = 12
	}
	if maxFrames > 12 {
		maxFrames = 12
	}
	return &Service{
		repo:      cfg.Repo,
		storage:   cfg.Storage,
		extractor: cfg.Extractor,
		moderator: cfg.Moderator,
		notifier:  cfg.Notifier,
		workDir:   workDir,
		maxVideo:  maxVideo,
		maxFrames: maxFrames,
		// Buffered: a send must never block the sending request.
		wake: make(chan struct{}, 1),
	}
}

// Wake asks the worker to poll immediately, so an upload is checked in about a
// second rather than after the next tick.
func (s *Service) Wake() {
	select {
	case s.wake <- struct{}{}:
	default:
	}
}

// StartWorker launches the background loop. Call once from main.
func (s *Service) StartWorker(ctx context.Context) {
	if !s.extractor.Available() {
		// Not fatal: images still moderate fine. But video jobs will keep
		// retrying, so this has to be loud.
		log.Printf("attachment moderation: ffmpeg/ffprobe NOT available — video and animated attachments cannot be checked")
	}
	go func() {
		defer observability.RecoverAndRepanic(ctx)
		ticker := time.NewTicker(pollInterval)
		defer ticker.Stop()
		for {
			select {
			case <-ctx.Done():
				return
			case <-ticker.C:
			case <-s.wake:
			}
			s.processDue(ctx)
		}
	}()
	log.Printf("attachment moderation worker: started (poll %s, batch %d, workdir %s)", pollInterval, batchSize, s.workDir)
}

func (s *Service) processDue(ctx context.Context) {
	// Reclaim jobs abandoned by a dead worker before looking for new ones.
	if err := s.repo.ReleaseStaleAttachmentJobs(ctx, leaseTimeout); err != nil {
		log.Printf("attachment moderation: release stale jobs: %v", err)
	}

	for {
		batch, err := s.repo.ClaimAttachmentModerationJobs(ctx, batchSize)
		if err != nil {
			log.Printf("attachment moderation: claim batch: %v", err)
			observability.CaptureException(ctx, err)
			return
		}
		if len(batch) == 0 {
			return
		}

		var wg sync.WaitGroup
		for _, job := range batch {
			if ctx.Err() != nil {
				return
			}
			wg.Add(1)
			go func(job domain.AttachmentModerationJob) {
				defer wg.Done()
				s.processJob(ctx, job)
			}(job)
		}
		wg.Wait()
	}
}

// processJob checks one attachment and applies the verdict.
func (s *Service) processJob(ctx context.Context, job domain.AttachmentModerationJob) {
	result, framesChecked, err := s.inspect(ctx, job)
	if err != nil {
		s.handleFailure(ctx, job, err)
		return
	}

	switch result.Decision {
	case domain.ImageModerationApprove:
		s.approve(ctx, job, result, framesChecked)
	case domain.ImageModerationReject:
		s.reject(ctx, job, result, framesChecked)
	default:
		// "review" means the model was unsure. There is no human moderation
		// queue for chat media, and leaving the attachment pending forever is
		// worse than dropping it — the sender at least learns it did not go
		// through and can send something clearer.
		s.reject(ctx, job, domain.ImageModerationResult{
			Decision:   domain.ImageModerationReject,
			Category:   result.Category,
			Reason:     "не удалось однозначно проверить вложение",
			Confidence: result.Confidence,
		}, framesChecked)
	}
}

// inspect produces a verdict for the job's attachment.
func (s *Service) inspect(ctx context.Context, job domain.AttachmentModerationJob) (domain.ImageModerationResult, int32, error) {
	switch job.Kind {
	case domain.AttachmentKindImage:
		// A still image needs no frame extraction: hand the stored key straight
		// to the existing image moderator.
		result, err := s.moderator.ModerateStoredKeys(ctx, []string{job.ObjectKey}, "chat")
		return result, 1, err

	case domain.AttachmentKindVideo, domain.AttachmentKindAnimated:
		return s.inspectFrames(ctx, job)

	default:
		return domain.ImageModerationResult{}, 0, fmt.Errorf("unknown attachment kind %q", job.Kind)
	}
}

// inspectFrames downloads the media, samples frames and moderates them.
//
// The frames are uploaded back to storage under a temporary prefix because the
// image moderator reads objects by key — that keeps one code path for "check
// these pictures" instead of two. Temporary frame objects are removed in all
// cases, including failure.
func (s *Service) inspectFrames(ctx context.Context, job domain.AttachmentModerationJob) (domain.ImageModerationResult, int32, error) {
	if !s.extractor.Available() {
		return domain.ImageModerationResult{}, 0, fmt.Errorf("%w: ffmpeg unavailable", domain.ErrImageModerationUnavailable)
	}

	dir, err := os.MkdirTemp(s.workDir, "job-*")
	if err != nil {
		return domain.ImageModerationResult{}, 0, fmt.Errorf("create workdir: %w", err)
	}
	// Always clean up: leftover video files on a 50 GB disk add up fast.
	defer os.RemoveAll(dir)

	localPath := filepath.Join(dir, "media")
	if err := s.downloadObject(ctx, job.ObjectKey, localPath); err != nil {
		return domain.ImageModerationResult{}, 0, err
	}

	// Duration is verified here, not trusted from the client. A file that cannot
	// be probed is rejected rather than retried: it is not valid media.
	info, err := s.extractor.Probe(ctx, localPath)
	if err != nil {
		if errors.Is(err, videoframes.ErrToolMissing) {
			return domain.ImageModerationResult{}, 0, err
		}
		return domain.ImageModerationResult{
			Decision:   domain.ImageModerationReject,
			Category:   "invalid_media",
			Reason:     "файл не является корректным видео",
			Confidence: 1,
		}, 0, nil
	}
	if job.Kind == domain.AttachmentKindVideo && info.DurationSeconds > s.maxVideo {
		return domain.ImageModerationResult{
			Decision:   domain.ImageModerationReject,
			Category:   "too_long",
			Reason:     fmt.Sprintf("видео длиннее %d секунд", s.maxVideo),
			Confidence: 1,
		}, 0, nil
	}

	framesDir := filepath.Join(dir, "frames")
	if err := os.MkdirAll(framesDir, 0o700); err != nil {
		return domain.ImageModerationResult{}, 0, err
	}

	opts := videoframes.DefaultExtractOptions()
	// Short clips need one 3x2 sheet; longer clips use two. Frames are sampled
	// uniformly across the verified duration rather than only near the start.
	opts.MaxFrames = s.maxFrames
	if info.DurationSeconds <= 15 && opts.MaxFrames > 6 {
		opts.MaxFrames = 6
	}
	opts.DurationSeconds = info.DurationSeconds
	// Contact sheets downscale cells to 320px, but escalation sends these
	// source frames directly, so retain substantially more detail.
	opts.Width = 1280
	if job.Kind == domain.AttachmentKindAnimated {
		// A GIF is typically a couple of seconds long, so a 4-second interval
		// would yield a single frame — exactly the blind spot being closed here.
		opts.MaxFrames = 6
	}

	frames, err := s.extractor.ExtractFrames(ctx, localPath, framesDir, opts)
	if err != nil {
		if errors.Is(err, videoframes.ErrNoFrames) {
			return domain.ImageModerationResult{
				Decision:   domain.ImageModerationReject,
				Category:   "invalid_media",
				Reason:     "не удалось извлечь кадры из файла",
				Confidence: 1,
			}, 0, nil
		}
		return domain.ImageModerationResult{}, 0, err
	}

	// Pack six frames into one contact sheet before uploading. This keeps the
	// whole video covered while reducing the common path to one or two calls.
	timestamps := make([]int, len(frames))
	if len(frames) > 1 && info.DurationSeconds > 0 {
		for i := range frames {
			timestamps[i] = i * (info.DurationSeconds - 1) / (len(frames) - 1)
		}
	}

	sheetDir := filepath.Join(dir, "sheets")
	sheets, err := videoframes.ComposeContactSheets(frames, timestamps, sheetDir, 6)
	if err != nil {
		return domain.ImageModerationResult{}, 0, fmt.Errorf("compose contact sheets: %w", err)
	}

	// Upload sheets next to the original under a temp prefix, moderate them,
	// then delete them regardless of outcome.
	keys := make([]string, 0, len(sheets)+len(frames))
	defer func() {
		for _, key := range keys {
			cleanupCtx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
			if err := s.storage.Delete(cleanupCtx, key); err != nil {
				log.Printf("attachment moderation: delete temporary object %q: %v", key, err)
			}
			cancel()
		}
	}()

	for i, sheetPath := range sheets {
		key := fmt.Sprintf("%s.sheets/%03d.jpg", job.ObjectKey, i)
		if err := s.uploadObject(ctx, key, sheetPath); err != nil {
			return domain.ImageModerationResult{}, 0, fmt.Errorf("upload contact sheet: %w", err)
		}
		keys = append(keys, key)
	}

	result, err := s.moderator.ModerateStoredKeys(ctx, keys, "chat_video_contact_sheet")
	if err != nil {
		return domain.ImageModerationResult{}, 0, err
	}

	if result.Decision == domain.ImageModerationReview || result.Confidence < 0.9 {
		frameKeys := make([]string, 0, len(frames))
		for i, framePath := range frames {
			key := fmt.Sprintf("%s.frames/%03d.jpg", job.ObjectKey, i)
			if err := s.uploadObject(ctx, key, framePath); err != nil {
				return domain.ImageModerationResult{}, 0, fmt.Errorf("upload escalation frame: %w", err)
			}
			keys = append(keys, key)
			frameKeys = append(frameKeys, key)
		}
		result, err = s.moderator.ModerateStoredKeys(ctx, frameKeys, "chat_video_frame")
		if err != nil {
			return domain.ImageModerationResult{}, 0, err
		}
	}

	// A cover is only meaningful for video, and only if the content passed.
	if job.Kind == domain.AttachmentKindVideo && result.Decision == domain.ImageModerationApprove {
		s.attachCover(ctx, job, localPath, dir, info)
	}

	return result, int32(len(frames)), nil
}

// attachCover generates the feed thumbnail and records duration.
//
// Best-effort: a missing cover degrades to a play button over a neutral
// placeholder, which is far better than rejecting media that already passed
// moderation.
func (s *Service) attachCover(ctx context.Context, job domain.AttachmentModerationJob, localPath, dir string, info videoframes.MediaInfo) {
	coverPath := filepath.Join(dir, "cover.jpg")
	if err := s.extractor.ExtractCover(ctx, localPath, coverPath, 720); err != nil {
		log.Printf("attachment moderation: cover for attachment %d: %v", job.AttachmentID, err)
		return
	}

	coverKey := fmt.Sprintf("%s.cover.jpg", job.ObjectKey)
	if err := s.uploadObject(ctx, coverKey, coverPath); err != nil {
		log.Printf("attachment moderation: upload cover for attachment %d: %v", job.AttachmentID, err)
		return
	}

	duration := int32(info.DurationSeconds)
	if err := s.repo.SetAttachmentVideoMeta(ctx, job.AttachmentID, &duration, coverKey); err != nil {
		log.Printf("attachment moderation: save video meta for attachment %d: %v", job.AttachmentID, err)
	}
}

func (s *Service) approve(ctx context.Context, job domain.AttachmentModerationJob, result domain.ImageModerationResult, frames int32) {
	if err := s.repo.SetAttachmentModerationStatus(ctx, job.AttachmentID, domain.AttachmentModerationApproved); err != nil {
		log.Printf("attachment moderation: approve attachment %d: %v", job.AttachmentID, err)
		return
	}
	if err := s.repo.CompleteAttachmentModeration(ctx, job.ID, string(domain.ImageModerationApprove), result.Category, result.Reason, result.Confidence, frames); err != nil {
		log.Printf("attachment moderation: complete job %d: %v", job.ID, err)
	}

	// The message becomes deliverable only when nothing of it is pending: an
	// album must not appear with three of its five photos.
	pending, err := s.repo.CountPendingAttachments(ctx, job.MessageID)
	if err != nil {
		log.Printf("attachment moderation: count pending for message %d: %v", job.MessageID, err)
		return
	}
	if pending == 0 && s.notifier != nil {
		s.notifier.AttachmentApproved(ctx, job.ConversationID, job.MessageID)
	}
}

func (s *Service) reject(ctx context.Context, job domain.AttachmentModerationJob, result domain.ImageModerationResult, frames int32) {
	// Record the verdict before deleting the row: the job holds the audit trail
	// (category, reason, how many frames were checked) for complaint handling.
	if err := s.repo.CompleteAttachmentModeration(ctx, job.ID, string(domain.ImageModerationReject), result.Category, result.Reason, result.Confidence, frames); err != nil {
		log.Printf("attachment moderation: complete rejected job %d: %v", job.ID, err)
	}

	// Deleting the attachment row cascades the job away, so the object has to be
	// removed via the key captured in the job.
	orphanedKeys, err := s.repo.DeleteAttachment(ctx, job.AttachmentID)
	if err != nil {
		log.Printf("attachment moderation: delete rejected attachment %d: %v", job.AttachmentID, err)
	}
	for _, orphanedKey := range orphanedKeys {
		if err := s.storage.Delete(ctx, orphanedKey); err != nil {
			log.Printf("attachment moderation: delete rejected object %q: %v", orphanedKey, err)
		}
		if orphanedKey == job.ObjectKey {
			if err := s.storage.Delete(ctx, orphanedKey+".cover.jpg"); err != nil {
				log.Printf("attachment moderation: delete rejected cover %q: %v", orphanedKey+".cover.jpg", err)
			}
		}
	}

	if s.notifier != nil {
		s.notifier.AttachmentRejected(ctx, job.ConversationID, job.MessageID, result.Reason)
	}
}

// handleFailure retries transient problems and gives up after maxAttempts.
func (s *Service) handleFailure(ctx context.Context, job domain.AttachmentModerationJob, cause error) {
	log.Printf("attachment moderation: job %d (attachment %d) failed on attempt %d: %v", job.ID, job.AttachmentID, job.Attempts, cause)

	// A missing provider project/model will not heal on a retry. Repeating paid
	// requests only delays the sender and creates avoidable provider traffic.
	// Keep the fail-closed policy, but reject immediately and expose the reason
	// through the normal attachment notification.
	if isNonRetryableModerationError(cause) {
		s.reject(ctx, job, domain.ImageModerationResult{
			Decision:   domain.ImageModerationReject,
			Category:   "moderation_unavailable",
			Reason:     "не удалось проверить вложение: сервис модерации временно недоступен",
			Confidence: 0,
		}, 0)
		return
	}

	if int(job.Attempts) >= maxAttempts {
		// Out of retries. The attachment was never verified, so it cannot be
		// published — reject it and tell the sender.
		s.reject(ctx, job, domain.ImageModerationResult{
			Decision:   domain.ImageModerationReject,
			Category:   "unverified",
			Reason:     "не удалось проверить вложение, попробуйте отправить снова",
			Confidence: 0,
		}, 0)
		return
	}

	idx := int(job.Attempts) - 1
	if idx < 0 {
		idx = 0
	}
	if idx >= len(retryBackoff) {
		idx = len(retryBackoff) - 1
	}
	next := time.Now().Add(retryBackoff[idx])

	msg := cause.Error()
	if len(msg) > 900 {
		msg = msg[:900]
	}
	if err := s.repo.RetryAttachmentModeration(ctx, job.ID, next, msg); err != nil {
		log.Printf("attachment moderation: schedule retry for job %d: %v", job.ID, err)
	}
}

func isNonRetryableModerationError(err error) bool {
	if err == nil {
		return false
	}
	message := strings.ToLower(err.Error())
	if strings.Contains(message, "decode image moderation verdict") ||
		strings.Contains(message, "empty vision response (finish_reason=length)") {
		return true
	}
	if strings.Contains(message, "vision status 400") &&
		(strings.Contains(message, "response_format") ||
			strings.Contains(message, "chat_template_kwargs") ||
			strings.Contains(message, "enable_thinking")) {
		return true
	}
	return strings.Contains(message, "vision status 403") &&
		(strings.Contains(message, "project not found") ||
			strings.Contains(message, "invalid project") ||
			strings.Contains(message, "project_id"))
}

// downloadObject streams a stored object to a local file.
func (s *Service) downloadObject(ctx context.Context, key, destPath string) error {
	object, err := s.storage.ReadObject(ctx, key, maxObjectBytes)
	if err != nil {
		return fmt.Errorf("read object %q: %w", key, err)
	}
	if err := os.WriteFile(destPath, object.Bytes, 0o600); err != nil {
		return fmt.Errorf("write local copy: %w", err)
	}
	return nil
}

// uploadObject puts a local file into storage under key.
func (s *Service) uploadObject(ctx context.Context, key, srcPath string) error {
	data, err := os.ReadFile(srcPath)
	if err != nil {
		return err
	}
	contentType := "image/jpeg"
	if !strings.HasSuffix(strings.ToLower(srcPath), ".jpg") {
		contentType = "application/octet-stream"
	}
	return s.storage.PutObject(ctx, key, data, contentType)
}
