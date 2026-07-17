package domain

import (
	"context"
	"time"
)

// House moderation statuses (stored in house.status alongside 'active').
const (
	HouseStatusActive            = "active"
	HouseStatusPendingModeration = "pending_moderation"
	HouseStatusModerationReview  = "moderation_review"
	HouseStatusRejected          = "rejected"
	HouseStatusUnpublished       = "unpublished"
)

// Moderation decisions.
const (
	ModerationApprove = "approve"
	ModerationReject  = "reject"
	ModerationReview  = "review"
)

// Moderation verdict sources.
const (
	ModerationSourcePrefilter = "prefilter"
	ModerationSourceLLM       = "llm"
	ModerationSourceHuman     = "human"
)

// Moderation queue row statuses (mirrors the email outbox lifecycle).
const (
	ModerationQueued     = "queued"
	ModerationProcessing = "processing"
	ModerationDone       = "done"
	ModerationFailed     = "failed"
)

// ModerationVerdict is one moderation decision (or a queued LLM job) for a
// listing. Rows double as the durable work queue (status/attempts/next
// attempt) and the permanent audit trail (decision/reason/raw response).
type ModerationVerdict struct {
	ID          int64
	HouseID     int32
	ContentHash string
	Source      string
	Decision    string
	Category    string
	Reason      string
	Confidence  float32
	ModeratorID *int32
	Status      string
	Attempts    int32
	CreatedAt   time.Time
}

// ModerationRepository persists verdicts and drives the moderation queue.
type ModerationRepository interface {
	// EnqueueLLM inserts a queued LLM job unless one already exists for this
	// house+content hash (idempotent). Returns created=false on duplicate.
	EnqueueLLM(ctx context.Context, houseID int32, contentHash string) (created bool, err error)
	// RecordVerdict stores a final verdict row (prefilter or human source,
	// or the terminal state of an LLM job).
	RecordVerdict(ctx context.Context, v ModerationVerdict, rawResponse []byte) error
	// DueBatch claims up to limit due LLM jobs (queued/processing with
	// next_attempt_at <= now), marking them processing.
	DueBatch(ctx context.Context, limit int32) ([]ModerationVerdict, error)
	// CompleteLLM finalises a claimed job with the LLM decision.
	CompleteLLM(ctx context.Context, id int64, decision, category, reason string, confidence float32, rawResponse []byte) error
	// RescheduleLLM re-queues a claimed job after a transient failure.
	RescheduleLLM(ctx context.Context, id int64, nextAttempt time.Time, lastError string) error
	// FailLLM marks a job permanently failed (attempts exhausted).
	FailLLM(ctx context.Context, id int64, lastError string) error
	// SetHouseModeration updates house.status (+ rejection_reason for
	// rejects; pass "" to clear it).
	SetHouseModeration(ctx context.Context, houseID int32, status, rejectionReason string) error
	// CountRecentRejects counts LLM/human reject verdicts for listings of
	// the given owner within the window (user-level abuse signal).
	CountRecentRejects(ctx context.Context, ownerID int32, since time.Time) (int64, error)
	// CountReviewQueue returns the current number of houses awaiting a
	// human decision (for admin alerting).
	CountReviewQueue(ctx context.Context) (int64, error)
	// CountOwnerSubmissions counts moderation enqueues for an owner since
	// the cutoff (rate limiting create/update).
	CountOwnerSubmissions(ctx context.Context, ownerID int32, since time.Time) (int64, error)
	// FindDuplicateText reports whether another owner has an active listing
	// with the same content hash.
	FindDuplicateText(ctx context.Context, houseID int32, ownerID int32, contentHash string) (bool, error)
	// SavePhotoHash stores a photo perceptual hash (upsert on house+key).
	SavePhotoHash(ctx context.Context, houseID int32, mediaKey string, phash uint64) error
	// FindSimilarPhoto reports whether a photo with Hamming distance <=
	// maxDistance exists on an active listing of a different owner.
	FindSimilarPhoto(ctx context.Context, houseID, ownerID int32, phash uint64, maxDistance int) (bool, error)
	// GetHouseForModeration loads the fields the moderator needs.
	GetHouseForModeration(ctx context.Context, houseID int32) (ModerationHouse, error)
}

// ModerationHouse is the slice of a listing the moderation pipeline reads.
type ModerationHouse struct {
	ID              int32
	OwnerID         int32
	OwnerEmail      string
	Status          string
	City            string
	Street          string
	HouseNumber     string
	NumberRoom      string
	Description     string
	Price           int64
	CountRoom       string
	Area            int32
	MaxGuests       *int32
	SmokingAllowed  string
	PetsAllowed     string
	ChildrenAllowed string
	EventsAllowed   string
	ServicesList    string
	CategoriesList  string
	PhotoKeys       []string
	POIs            []HousePOI
}

// ListingModerator accepts freshly created/updated listings into the
// moderation pipeline. Implemented by the moderation service; consumed by the
// listing use case.
type ListingModerator interface {
	// Submit runs the prefilter synchronously and enqueues the LLM job.
	// Returns the resulting house status so the caller can inform the user.
	Submit(ctx context.Context, houseID int32) (status string, err error)
	// AllowSubmission enforces the per-owner daily rate limit.
	AllowSubmission(ctx context.Context, ownerID int32) (bool, error)
}
