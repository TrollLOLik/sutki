package adminauth

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/base64"
	"encoding/json"
	"errors"
	"strings"
	"time"

	"github.com/TrollLOLik/sutki/backend/internal/domain"
	"github.com/TrollLOLik/sutki/backend/internal/usecase/auth"
)

var (
	ErrInvalidCredentials = errors.New("invalid admin credentials")
	ErrInvalidSession     = errors.New("invalid admin session")
	ErrInvalidCSRF        = errors.New("invalid csrf token")
	ErrForbidden          = errors.New("admin role forbidden")
)

const tokenBytes = 32

type OTPService interface {
	RequestAdminCode(ctx context.Context, email string) (auth.RequestCodeResult, error)
	VerifyAdminCode(ctx context.Context, email, code string) error
}

type Config struct {
	SessionTTL time.Duration
	IdleTTL    time.Duration
	Now        func() time.Time
}

type ClientMeta struct {
	IPAddress string
	UserAgent string
}

type LoginResult struct {
	Account      domain.AdminAccount
	SessionToken string
	CSRFToken    string
	ExpiresAt    time.Time
}

type Service struct {
	repo       domain.AdminRepository
	otp        OTPService
	sessionTTL time.Duration
	idleTTL    time.Duration
	now        func() time.Time
}

func New(repo domain.AdminRepository, otp OTPService, cfg Config) *Service {
	if cfg.SessionTTL <= 0 {
		cfg.SessionTTL = 8 * time.Hour
	}
	if cfg.IdleTTL <= 0 {
		cfg.IdleTTL = 30 * time.Minute
	}
	if cfg.Now == nil {
		cfg.Now = time.Now
	}
	return &Service{
		repo: repo, otp: otp, sessionTTL: cfg.SessionTTL,
		idleTTL: cfg.IdleTTL, now: cfg.Now,
	}
}

// RequestCode deliberately returns the same response for an unknown or
// disabled address. The admin roster must not be enumerable from the public
// login endpoint.
func (s *Service) RequestCode(ctx context.Context, emailRaw string) (auth.RequestCodeResult, error) {
	email, err := auth.NormalizeEmail(emailRaw)
	if err != nil {
		return auth.RequestCodeResult{}, err
	}
	account, err := s.repo.FindAccountByEmail(ctx, email)
	if errors.Is(err, domain.ErrNotFound) || (err == nil && !account.Enabled) {
		return auth.RequestCodeResult{ExpiresIn: int64((10 * time.Minute).Seconds())}, nil
	}
	if err != nil {
		return auth.RequestCodeResult{}, err
	}
	result, err := s.otp.RequestAdminCode(ctx, email)
	if errors.Is(err, domain.ErrCodeRequestTooSoon) {
		// A different status for a recently used operator address would reveal
		// membership in the private admin roster on the second request.
		return auth.RequestCodeResult{ExpiresIn: int64((10 * time.Minute).Seconds())}, nil
	}
	return result, err
}

func (s *Service) VerifyCode(ctx context.Context, emailRaw, code string, meta ClientMeta) (LoginResult, error) {
	email, err := auth.NormalizeEmail(emailRaw)
	if err != nil {
		return LoginResult{}, ErrInvalidCredentials
	}
	account, err := s.repo.FindAccountByEmail(ctx, email)
	if errors.Is(err, domain.ErrNotFound) || (err == nil && !account.Enabled) {
		return LoginResult{}, ErrInvalidCredentials
	}
	if err != nil {
		return LoginResult{}, err
	}
	if !validRole(account.Role) {
		return LoginResult{}, ErrForbidden
	}
	if err := s.otp.VerifyAdminCode(ctx, email, code); err != nil {
		if errors.Is(err, domain.ErrCodeInvalid) || errors.Is(err, domain.ErrCodeExpired) || errors.Is(err, domain.ErrTooManyAttempts) {
			return LoginResult{}, ErrInvalidCredentials
		}
		return LoginResult{}, err
	}

	sessionToken, err := randomToken()
	if err != nil {
		return LoginResult{}, err
	}
	csrfToken, err := randomToken()
	if err != nil {
		return LoginResult{}, err
	}
	now := s.now().UTC()
	expiresAt := now.Add(s.sessionTTL)
	metadata, _ := json.Marshal(map[string]string{"role": account.Role})
	session, err := s.repo.CreateSession(ctx, domain.AdminSession{
		AdminAccountID: account.ID,
		Account:        account,
		TokenHash:      hashToken(sessionToken),
		CSRFTokenHash:  hashToken(csrfToken),
		IPAddress:      meta.IPAddress,
		UserAgent:      truncate(meta.UserAgent, 500),
		CreatedAt:      now,
		ExpiresAt:      expiresAt,
	}, domain.AdminAuditEntry{
		ActorAdminID: account.ID,
		Action:       "admin.login",
		Metadata:     metadata,
		IPAddress:    meta.IPAddress,
		UserAgent:    truncate(meta.UserAgent, 500),
		CreatedAt:    now,
	})
	if err != nil {
		return LoginResult{}, err
	}
	return LoginResult{
		Account: account, SessionToken: sessionToken, CSRFToken: csrfToken,
		ExpiresAt: session.ExpiresAt,
	}, nil
}

func (s *Service) Authenticate(ctx context.Context, sessionToken, csrfToken string, requireCSRF bool) (domain.AdminSession, error) {
	sessionToken = strings.TrimSpace(sessionToken)
	if sessionToken == "" {
		return domain.AdminSession{}, ErrInvalidSession
	}
	now := s.now().UTC()
	session, err := s.repo.GetAndTouchSession(ctx, hashToken(sessionToken), now, now.Add(-s.idleTTL))
	if errors.Is(err, domain.ErrNotFound) {
		return domain.AdminSession{}, ErrInvalidSession
	}
	if err != nil {
		return domain.AdminSession{}, err
	}
	if requireCSRF {
		presented := hashToken(strings.TrimSpace(csrfToken))
		if csrfToken == "" || len(session.CSRFTokenHash) != len(presented) || subtle.ConstantTimeCompare(session.CSRFTokenHash, presented) != 1 {
			return domain.AdminSession{}, ErrInvalidCSRF
		}
	}
	return session, nil
}

func (s *Service) Logout(ctx context.Context, sessionToken, csrfToken string, meta ClientMeta) error {
	session, err := s.Authenticate(ctx, sessionToken, csrfToken, true)
	if err != nil {
		return err
	}
	return s.repo.RevokeSession(ctx, hashToken(sessionToken), domain.AdminAuditEntry{
		ActorAdminID: session.AdminAccountID,
		Action:       "admin.logout",
		IPAddress:    meta.IPAddress,
		UserAgent:    truncate(meta.UserAgent, 500),
		CreatedAt:    s.now().UTC(),
	})
}

func (s *Service) RequireRole(session domain.AdminSession, minimum string) error {
	if !validRole(session.Account.Role) || !validRole(minimum) || roleRank(session.Account.Role) < roleRank(minimum) {
		return ErrForbidden
	}
	return nil
}

func (s *Service) AppendAudit(ctx context.Context, session domain.AdminSession, action, targetType, targetID, reason string, metadata json.RawMessage, meta ClientMeta) error {
	return s.repo.AppendAudit(ctx, domain.AdminAuditEntry{
		ActorAdminID: session.AdminAccountID,
		Action:       action,
		TargetType:   targetType,
		TargetID:     targetID,
		Reason:       reason,
		Metadata:     metadata,
		IPAddress:    meta.IPAddress,
		UserAgent:    truncate(meta.UserAgent, 500),
		CreatedAt:    s.now().UTC(),
	})
}

func validRole(role string) bool {
	return role == domain.AdminRoleSupport || role == domain.AdminRoleModerator || role == domain.AdminRoleOwner
}

func roleRank(role string) int {
	switch role {
	case domain.AdminRoleOwner:
		return 3
	case domain.AdminRoleModerator:
		return 2
	case domain.AdminRoleSupport:
		return 1
	default:
		return 0
	}
}

func randomToken() (string, error) {
	raw := make([]byte, tokenBytes)
	if _, err := rand.Read(raw); err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(raw), nil
}

func hashToken(token string) []byte {
	sum := sha256.Sum256([]byte(token))
	return sum[:]
}

func truncate(value string, max int) string {
	value = strings.TrimSpace(value)
	if len(value) <= max {
		return value
	}
	return value[:max]
}
