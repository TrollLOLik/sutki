package domain

import (
	"context"
	"encoding/json"
	"time"
)

const (
	ReportTargetUser    = "user"
	ReportTargetListing = "listing"
	ReportTargetMessage = "message"
	ReportTargetReview  = "review"

	ReportReasonSpam                 = "spam"
	ReportReasonFraud                = "fraud"
	ReportReasonHarassment           = "harassment"
	ReportReasonInappropriateContent = "inappropriate_content"
	ReportReasonPersonalData         = "personal_data"
	ReportReasonOther                = "other"

	ReportStatusNew = "new"
)

// AbuseReport is an immutable user complaint plus its moderation state. The
// evidence is produced by the server from the reported object, never accepted
// from the reporting client.
type AbuseReport struct {
	ID             int64
	ReporterUserID int32
	ReportedUserID int32
	TargetType     string
	TargetID       int64
	Reason         string
	Details        string
	Status         string
	Evidence       json.RawMessage
	Source         string
	AppVersion     string
	IPAddress      string
	UserAgent      string
	CreatedAt      time.Time
}

// ReportTarget is the repository-verified owner and snapshot of a reported
// entity. Message targets are additionally authorized against conversation
// membership before this value is returned.
type ReportTarget struct {
	UserID   int32
	Evidence json.RawMessage
}

type CreateAbuseReport struct {
	ReporterUserID int32
	TargetType     string
	TargetID       int64
	Reason         string
	Details        string
	Source         string
	AppVersion     string
	IPAddress      string
	UserAgent      string
}

type BlockedUser struct {
	UserID    int32
	Name      string
	AvatarURL string
	BlockedAt time.Time
}

type BlockedUsersPage struct {
	Items  []BlockedUser
	Total  int64
	Limit  int32
	Offset int32
}

// UserBlockState describes the pair-level restriction from the viewer's
// perspective. BlockedByMe is intentionally directional: clients may offer an
// unblock action only to the user who created the block, while the other side
// receives neutral copy without learning who initiated it.
type UserBlockState struct {
	Blocked     bool `json:"blocked"`
	BlockedByMe bool `json:"blocked_by_me"`
}

// UserBlockChecker is the narrow read contract consumed by chat and booking.
// Keeping it separate from AbuseRepository prevents those use cases from
// depending on complaint creation or block-list mutations.
type UserBlockChecker interface {
	IsBlockedBetween(ctx context.Context, firstUserID, secondUserID int32) (bool, error)
	BlockState(ctx context.Context, viewerUserID, otherUserID int32) (UserBlockState, error)
}

// AbuseRepository owns both complaint evidence collection and pair-level
// blocks. CreateReport must enforce its daily limit transactionally so it
// remains correct with multiple API replicas.
type AbuseRepository interface {
	CreateReport(ctx context.Context, report CreateAbuseReport, maxPerDay int32) (AbuseReport, error)
	BlockUser(ctx context.Context, blockerUserID, blockedUserID int32) (BlockedUser, error)
	UnblockUser(ctx context.Context, blockerUserID, blockedUserID int32) error
	ListBlockedUsers(ctx context.Context, blockerUserID, limit, offset int32) (BlockedUsersPage, error)
	IsBlockedBetween(ctx context.Context, firstUserID, secondUserID int32) (bool, error)
	BlockState(ctx context.Context, viewerUserID, otherUserID int32) (UserBlockState, error)
}
