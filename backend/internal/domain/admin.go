package domain

import (
	"context"
	"encoding/json"
	"time"
)

const (
	AdminRoleSupport   = "support"
	AdminRoleModerator = "moderator"
	AdminRoleOwner     = "owner"
)

// AdminAccount grants access to the operator surface to an existing account.
// It deliberately lives outside the legacy user.roles column: public account
// tokens and admin sessions are separate credentials with separate lifetimes.
type AdminAccount struct {
	ID          int64
	UserID      int32
	Email       string
	Name        string
	Role        string
	Enabled     bool
	CreatedAt   time.Time
	UpdatedAt   time.Time
	LastLoginAt *time.Time
}

type AdminAuditRecord struct {
	ID         int64           `json:"id"`
	Actor      AdminAccount    `json:"actor"`
	Action     string          `json:"action"`
	TargetType string          `json:"target_type,omitempty"`
	TargetID   string          `json:"target_id,omitempty"`
	Reason     string          `json:"reason,omitempty"`
	Metadata   json.RawMessage `json:"metadata"`
	IPAddress  string          `json:"ip_address,omitempty"`
	UserAgent  string          `json:"user_agent,omitempty"`
	CreatedAt  time.Time       `json:"created_at"`
}

type AdminAuditPage struct {
	Items  []AdminAuditRecord `json:"items"`
	Total  int64              `json:"total"`
	Limit  int32              `json:"limit"`
	Offset int32              `json:"offset"`
}

type AdminAuditFilter struct {
	Action string
	Limit  int32
	Offset int32
}

type AdminStaffChange struct {
	ActorAdminID  int64
	TargetAdminID int64
	Email         string
	Role          string
	Enabled       bool
	IPAddress     string
	UserAgent     string
	CreatedAt     time.Time
}

// AdminSession is an opaque, server-stored browser session. Only hashes of the
// session and CSRF tokens are persisted.
type AdminSession struct {
	ID             int64
	AdminAccountID int64
	Account        AdminAccount
	TokenHash      []byte
	CSRFTokenHash  []byte
	IPAddress      string
	UserAgent      string
	CreatedAt      time.Time
	LastActiveAt   time.Time
	ExpiresAt      time.Time
}

// AdminAuditEntry is append-only from the application's perspective. Admin
// handlers never receive update or delete methods for this log.
type AdminAuditEntry struct {
	ActorAdminID int64
	Action       string
	TargetType   string
	TargetID     string
	Reason       string
	Metadata     json.RawMessage
	IPAddress    string
	UserAgent    string
	CreatedAt    time.Time
}

type AdminRepository interface {
	FindAccountByEmail(ctx context.Context, email string) (AdminAccount, error)
	CreateSession(ctx context.Context, session AdminSession, audit AdminAuditEntry) (AdminSession, error)
	GetAndTouchSession(ctx context.Context, tokenHash []byte, now, activeAfter time.Time) (AdminSession, error)
	RevokeSession(ctx context.Context, tokenHash []byte, audit AdminAuditEntry) error
	AppendAudit(ctx context.Context, entry AdminAuditEntry) error
}

type AdminManagementRepository interface {
	ListAdminAccounts(ctx context.Context) ([]AdminAccount, error)
	CreateAdminAccount(ctx context.Context, change AdminStaffChange) (AdminAccount, error)
	UpdateAdminAccount(ctx context.Context, change AdminStaffChange) (AdminAccount, error)
	ListAdminAudit(ctx context.Context, filter AdminAuditFilter) (AdminAuditPage, error)
}
