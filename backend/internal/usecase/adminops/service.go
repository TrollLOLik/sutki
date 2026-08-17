package adminops

import (
	"context"
	"errors"
	"strings"
	"time"

	"github.com/TrollLOLik/sutki/backend/internal/domain"
	"github.com/TrollLOLik/sutki/backend/internal/usecase/auth"
)

const (
	defaultLimit int32 = 50
	maxLimit     int32 = 100
)

var (
	ErrInvalidInput = errors.New("invalid admin management input")
	ErrSelfChange   = errors.New("admin cannot change own access")
)

type ClientMeta struct {
	IPAddress string
	UserAgent string
}

type Service struct {
	repo domain.AdminManagementRepository
	now  func() time.Time
}

func New(repo domain.AdminManagementRepository) *Service {
	return &Service{repo: repo, now: time.Now}
}

func (s *Service) ListStaff(ctx context.Context) ([]domain.AdminAccount, error) {
	return s.repo.ListAdminAccounts(ctx)
}

func (s *Service) CreateStaff(ctx context.Context, actorAdminID int64, emailRaw, role string, meta ClientMeta) (domain.AdminAccount, error) {
	if actorAdminID <= 0 || !validRole(role) {
		return domain.AdminAccount{}, ErrInvalidInput
	}
	email, err := auth.NormalizeEmail(emailRaw)
	if err != nil {
		return domain.AdminAccount{}, ErrInvalidInput
	}
	return s.repo.CreateAdminAccount(ctx, domain.AdminStaffChange{
		ActorAdminID: actorAdminID,
		Email:        email,
		Role:         role,
		Enabled:      true,
		IPAddress:    strings.TrimSpace(meta.IPAddress),
		UserAgent:    truncate(meta.UserAgent, 500),
		CreatedAt:    s.now().UTC(),
	})
}

func (s *Service) UpdateStaff(ctx context.Context, actorAdminID, targetAdminID int64, role string, enabled bool, meta ClientMeta) (domain.AdminAccount, error) {
	if actorAdminID <= 0 || targetAdminID <= 0 || !validRole(role) {
		return domain.AdminAccount{}, ErrInvalidInput
	}
	if actorAdminID == targetAdminID {
		return domain.AdminAccount{}, ErrSelfChange
	}
	return s.repo.UpdateAdminAccount(ctx, domain.AdminStaffChange{
		ActorAdminID:  actorAdminID,
		TargetAdminID: targetAdminID,
		Role:          role,
		Enabled:       enabled,
		IPAddress:     strings.TrimSpace(meta.IPAddress),
		UserAgent:     truncate(meta.UserAgent, 500),
		CreatedAt:     s.now().UTC(),
	})
}

func (s *Service) ListAudit(ctx context.Context, action string, limit, offset int32) (domain.AdminAuditPage, error) {
	action = strings.TrimSpace(action)
	if len(action) > 64 || offset < 0 {
		return domain.AdminAuditPage{}, ErrInvalidInput
	}
	if limit <= 0 {
		limit = defaultLimit
	}
	if limit > maxLimit {
		limit = maxLimit
	}
	return s.repo.ListAdminAudit(ctx, domain.AdminAuditFilter{
		Action: action,
		Limit:  limit,
		Offset: offset,
	})
}

func validRole(role string) bool {
	return role == domain.AdminRoleSupport || role == domain.AdminRoleModerator || role == domain.AdminRoleOwner
}

func truncate(value string, max int) string {
	value = strings.TrimSpace(value)
	if len(value) <= max {
		return value
	}
	return value[:max]
}
