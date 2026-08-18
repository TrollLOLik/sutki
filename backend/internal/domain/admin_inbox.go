package domain

import (
	"context"
	"encoding/json"
	"time"
)

const (
	AdminInboxKindReport      = "report"
	AdminInboxKindUser        = "user"
	AdminInboxKindListing     = "listing"
	AdminInboxKindMessage     = "message"
	AdminInboxKindReview      = "review"
	AdminInboxKindReviewReply = "review_reply"
	AdminInboxKindAttachment  = "attachment"

	AdminInboxActionStartReview = "start_review"
	AdminInboxActionResolve     = "resolve"
	AdminInboxActionDismiss     = "dismiss"
	AdminInboxActionApprove     = "approve"
	AdminInboxActionReject      = "reject"
	AdminInboxActionRetry       = "retry"
	AdminInboxActionRevoke      = "revoke_sanctions"

	AdminInboxSanctionRejectListing = "reject_listing"
	AdminInboxSanctionHideReview    = "hide_review"
	AdminInboxSanctionHideMessage   = "hide_message"
	AdminInboxSanctionDisableUser   = "disable_user"

	AdminInboxMediaStoragePublic    = "public"
	AdminInboxMediaStoragePrivate   = "private"
	AdminInboxMediaVariantOriginal  = "original"
	AdminInboxMediaVariantThumbnail = "thumbnail"
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
	Item            AdminInboxItem             `json:"item"`
	Evidence        json.RawMessage            `json:"evidence"`
	Context         json.RawMessage            `json:"context"`
	Media           []AdminInboxMedia          `json:"media"`
	Users           []AdminInboxUser           `json:"users"`
	RelatedReports  []AdminInboxRelatedReport  `json:"related_reports"`
	ActiveSanctions []AdminInboxSanctionRecord `json:"active_sanctions"`
	SanctionHistory []AdminSanctionHistory     `json:"sanction_history"`
}

// AdminSanctionHistory contains both active and revoked decisions. It is used
// by exact admin search so an investigation does not depend on an open report.
type AdminSanctionHistory struct {
	ID               int64      `json:"id"`
	ReportID         int64      `json:"report_id"`
	Type             string     `json:"type"`
	TargetType       string     `json:"target_type"`
	TargetID         int64      `json:"target_id"`
	SubjectUserID    *int32     `json:"subject_user_id,omitempty"`
	AppliedByAdminID int64      `json:"applied_by_admin_id"`
	AppliedByEmail   string     `json:"applied_by_email"`
	AppliedReason    string     `json:"applied_reason"`
	AppliedAt        time.Time  `json:"applied_at"`
	Active           bool       `json:"active"`
	RevokedAt        *time.Time `json:"revoked_at,omitempty"`
	RevokedByAdminID *int64     `json:"revoked_by_admin_id,omitempty"`
	RevokedByEmail   string     `json:"revoked_by_email,omitempty"`
	RevocationReason string     `json:"revocation_reason,omitempty"`
}

// AdminInboxSanctionRecord is the reversible operator decision attached to a
// report. PreviousState deliberately remains repository-private: the browser
// only needs the bounded metadata below, while restoration happens server-side.
type AdminInboxSanctionRecord struct {
	ID               int64     `json:"id"`
	Type             string    `json:"type"`
	TargetType       string    `json:"target_type"`
	TargetID         int64     `json:"target_id"`
	SubjectUserID    *int32    `json:"subject_user_id,omitempty"`
	AppliedByAdminID int64     `json:"applied_by_admin_id"`
	AppliedByEmail   string    `json:"applied_by_email"`
	AppliedReason    string    `json:"applied_reason"`
	AppliedAt        time.Time `json:"applied_at"`
}

// AdminInboxRelatedReport links complaints without merging their lifecycle.
// Operators can inspect recurring reports by object or account, while every
// complaint still requires its own explicit, audited decision.
type AdminInboxRelatedReport struct {
	ID             int64     `json:"id"`
	Status         string    `json:"status"`
	TargetType     string    `json:"target_type"`
	TargetID       int64     `json:"target_id"`
	Reason         string    `json:"reason"`
	Details        string    `json:"details"`
	ReporterUserID *int32    `json:"reporter_user_id,omitempty"`
	ReportedUserID *int32    `json:"reported_user_id,omitempty"`
	SameTarget     bool      `json:"same_target"`
	SameUser       bool      `json:"same_user"`
	CreatedAt      time.Time `json:"created_at"`
	UpdatedAt      time.Time `json:"updated_at"`
}

const (
	AdminInboxUserRelationSubject  = "subject"
	AdminInboxUserRelationReporter = "reporter"
)

// AdminInboxUser is a deliberately bounded operator view of an account
// related to a queue item. Authentication secrets, OTP challenges, payment
// data and message history must never be added to this structure.
type AdminInboxUser struct {
	Relation             string     `json:"relation"`
	ID                   int32      `json:"id"`
	Name                 string     `json:"name"`
	Email                string     `json:"email"`
	Phone                string     `json:"phone"`
	PhoneVerified        bool       `json:"phone_verified"`
	City                 string     `json:"city"`
	AccountEnabled       bool       `json:"account_enabled"`
	Deleted              bool       `json:"deleted"`
	IdentityVerified     bool       `json:"identity_verified"`
	PublicProfileVisible bool       `json:"public_profile_visible"`
	CreatedAt            time.Time  `json:"created_at"`
	LastSeenAt           *time.Time `json:"last_seen_at,omitempty"`
	LastAppVersion       string     `json:"last_app_version"`
	ActiveSessions       int32      `json:"active_sessions"`
	ListingsTotal        int32      `json:"listings_total"`
	ListingsActive       int32      `json:"listings_active"`
	ReviewsAuthored      int32      `json:"reviews_authored"`
	BookingsAsGuest      int32      `json:"bookings_as_guest"`
	BookingsAsOwner      int32      `json:"bookings_as_owner"`
	ReportsSubmitted     int32      `json:"reports_submitted"`
	ReportsReceived      int32      `json:"reports_received"`
	BlocksCreated        int32      `json:"blocks_created"`
	BlocksReceived       int32      `json:"blocks_received"`
}

// AdminInboxMedia is display metadata for an object related to one queue
// item. It intentionally contains no storage key or direct URL: the admin
// client receives media only through the authenticated relation-checking
// endpoint.
type AdminInboxMedia struct {
	ID           int64  `json:"id"`
	FileName     string `json:"file_name"`
	MimeType     string `json:"mime_type"`
	SizeBytes    int64  `json:"size_bytes"`
	Width        *int32 `json:"width,omitempty"`
	Height       *int32 `json:"height,omitempty"`
	HasThumbnail bool   `json:"has_thumbnail"`
}

// AdminInboxMediaObject is an internal, non-serialized storage reference
// returned only after the repository proves that mediaID belongs to the
// requested queue item.
type AdminInboxMediaObject struct {
	Key      string
	Storage  string
	MimeType string
	FileName string
}

type AdminInboxFilter struct {
	Kind   string
	Limit  int32
	Offset int32
}

type AdminSearchFilter struct {
	Kind  string
	Query string
	ID    int64
	Phone string
}

type AdminSearchPage struct {
	Items []AdminInboxItem `json:"items"`
}

// AdminInboxAction is the complete security context for one operator
// decision. ActorAdminID is written to the immutable admin audit log, while
// ActorUserID links human listing verdicts to the existing user identity.
type AdminInboxAction struct {
	Kind           string
	ID             int64
	Action         string
	Reason         string
	Sanctions      []string
	SanctionIDs    []int64
	ActorAdminID   int64
	ActorUserID    int32
	ActorIPAddress string
	ActorUserAgent string
}

type AdminInboxActionResult struct {
	Kind               string   `json:"kind"`
	ID                 int64    `json:"id"`
	Status             string   `json:"status"`
	Sanctions          []string `json:"sanctions,omitempty"`
	RevokedSanctionIDs []int64  `json:"revoked_sanction_ids,omitempty"`
	SubjectUserID      *int32   `json:"-"`
	TargetType         string   `json:"-"`
	TargetID           int64    `json:"-"`
	RevokedSessionIDs  []int64  `json:"-"`
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
	GetAdminInboxMedia(ctx context.Context, kind string, id, mediaID int64, variant string) (AdminInboxMediaObject, error)
	SearchAdminItems(ctx context.Context, filter AdminSearchFilter) (AdminSearchPage, error)
	GetAdminSearchItem(ctx context.Context, kind string, id int64) (AdminInboxDetail, error)
	GetAdminSearchMedia(ctx context.Context, kind string, id, mediaID int64, variant string) (AdminInboxMediaObject, error)
	ApplyAdminInboxAction(ctx context.Context, action AdminInboxAction) (AdminInboxActionResult, error)
}
