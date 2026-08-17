package domain

import (
	"context"
	"encoding/json"
	"time"
)

const (
	AdminInboxKindReport      = "report"
	AdminInboxKindListing     = "listing"
	AdminInboxKindReview      = "review"
	AdminInboxKindReviewReply = "review_reply"
	AdminInboxKindAttachment  = "attachment"

	AdminInboxActionStartReview = "start_review"
	AdminInboxActionResolve     = "resolve"
	AdminInboxActionDismiss     = "dismiss"
	AdminInboxActionApprove     = "approve"
	AdminInboxActionReject      = "reject"
	AdminInboxActionRetry       = "retry"
)

// AdminInboxSummary contains only currently actionable items. Closed reports
// and completed automatic verdicts remain in their source tables as audit
// history, but do not inflate the operator queue.
type AdminInboxSummary struct {
	Reports     int64 `json:"reports"`
	Listings    int64 `json:"listings"`
	Reviews     int64 `json:"reviews"`
	Attachments int64 `json:"attachments"`
	Total       int64 `json:"total"`
}

// AdminInboxItem is the compact, normalized row shared by reports and every
// manual-review queue. Kind plus ID is the stable identifier used by the
// detail endpoint.
type AdminInboxItem struct {
	Kind          string    `json:"kind"`
	ID            int64     `json:"id"`
	SubjectUserID *int32    `json:"subject_user_id,omitempty"`
	Status        string    `json:"status"`
	Title         string    `json:"title"`
	Summary       string    `json:"summary"`
	Reason        string    `json:"reason,omitempty"`
	Attempts      int32     `json:"attempts,omitempty"`
	CreatedAt     time.Time `json:"created_at"`
	UpdatedAt     time.Time `json:"updated_at"`
}

type AdminInboxPage struct {
	Items  []AdminInboxItem `json:"items"`
	Total  int64            `json:"total"`
	Limit  int32            `json:"limit"`
	Offset int32            `json:"offset"`
}

// AdminInboxDetail keeps immutable evidence separate from queue context. For
// reports Evidence is the server-captured target snapshot; for moderation it
// is the current entity snapshot. Context contains transport and model/job
// diagnostics and is never exposed by the public API.
type AdminInboxDetail struct {
	Item     AdminInboxItem  `json:"item"`
	Evidence json.RawMessage `json:"evidence"`
	Context  json.RawMessage `json:"context"`
}

type AdminInboxFilter struct {
	Kind   string
	Limit  int32
	Offset int32
}

// AdminInboxAction is the complete security context for one operator
// decision. ActorAdminID is written to the immutable admin audit log, while
// ActorUserID links human listing verdicts to the existing user identity.
type AdminInboxAction struct {
	Kind           string
	ID             int64
	Action         string
	Reason         string
	ActorAdminID   int64
	ActorUserID    int32
	ActorIPAddress string
	ActorUserAgent string
}

type AdminInboxActionResult struct {
	Kind          string `json:"kind"`
	ID            int64  `json:"id"`
	Status        string `json:"status"`
	SubjectUserID *int32 `json:"-"`
}

// AdminQueueEvent is intentionally transport-neutral. Telegram is one
// operator notification channel; source tables remain the authoritative queue.
type AdminQueueEvent struct {
	Kind          string
	ID            int64
	Title         string
	Reason        string
	SubjectUserID *int32
}

type AdminQueueNotifier interface {
	NotifyAdminQueue(ctx context.Context, event AdminQueueEvent) error
}

type AdminInboxRepository interface {
	AdminInboxSummary(ctx context.Context, includeModeration bool) (AdminInboxSummary, error)
	ListAdminInbox(ctx context.Context, filter AdminInboxFilter, includeModeration bool) (AdminInboxPage, error)
	GetAdminInboxItem(ctx context.Context, kind string, id int64) (AdminInboxDetail, error)
	ApplyAdminInboxAction(ctx context.Context, action AdminInboxAction) (AdminInboxActionResult, error)
}
