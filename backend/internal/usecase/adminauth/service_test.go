package adminauth

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"testing"
	"time"

	"github.com/TrollLOLik/sutki/backend/internal/domain"
	"github.com/TrollLOLik/sutki/backend/internal/usecase/auth"
)

type adminRepoStub struct {
	account       domain.AdminAccount
	findErr       error
	created       domain.AdminSession
	createAudit   domain.AdminAuditEntry
	loaded        domain.AdminSession
	loadErr       error
	loadedHash    []byte
	loadedAfter   time.Time
	revokedHash   []byte
	revokeAudit   domain.AdminAuditEntry
	appendedAudit domain.AdminAuditEntry
}

func (s *adminRepoStub) FindAccountByEmail(context.Context, string) (domain.AdminAccount, error) {
	return s.account, s.findErr
}

func (s *adminRepoStub) CreateSession(_ context.Context, session domain.AdminSession, audit domain.AdminAuditEntry) (domain.AdminSession, error) {
	s.created = session
	s.createAudit = audit
	session.ID = 42
	session.LastActiveAt = session.CreatedAt
	return session, nil
}

func (s *adminRepoStub) GetAndTouchSession(_ context.Context, tokenHash []byte, _ time.Time, activeAfter time.Time) (domain.AdminSession, error) {
	s.loadedHash = append([]byte(nil), tokenHash...)
	s.loadedAfter = activeAfter
	return s.loaded, s.loadErr
}

func (s *adminRepoStub) RevokeSession(_ context.Context, tokenHash []byte, audit domain.AdminAuditEntry) error {
	s.revokedHash = append([]byte(nil), tokenHash...)
	s.revokeAudit = audit
	return nil
}

func (s *adminRepoStub) AppendAudit(_ context.Context, entry domain.AdminAuditEntry) error {
	s.appendedAudit = entry
	return nil
}

type adminOTPStub struct {
	requestedEmail string
	verifiedEmail  string
	verifiedCode   string
	requestResult  auth.RequestCodeResult
	requestErr     error
	verifyErr      error
}

func (s *adminOTPStub) RequestAdminCode(_ context.Context, email string) (auth.RequestCodeResult, error) {
	s.requestedEmail = email
	return s.requestResult, s.requestErr
}

func (s *adminOTPStub) VerifyAdminCode(_ context.Context, email, code string) error {
	s.verifiedEmail = email
	s.verifiedCode = code
	return s.verifyErr
}

func TestRequestCodeDoesNotRevealUnknownAdmin(t *testing.T) {
	repo := &adminRepoStub{findErr: domain.ErrNotFound}
	otp := &adminOTPStub{}
	svc := New(repo, otp, Config{})

	result, err := svc.RequestCode(context.Background(), "unknown@example.com")
	if err != nil {
		t.Fatalf("RequestCode: %v", err)
	}
	if result.ExpiresIn != 600 {
		t.Fatalf("ExpiresIn = %d, want 600", result.ExpiresIn)
	}
	if otp.requestedEmail != "" {
		t.Fatalf("OTP requested for an unknown admin: %q", otp.requestedEmail)
	}
}

func TestRequestCodeDoesNotRevealCooldownForKnownAdmin(t *testing.T) {
	repo := &adminRepoStub{account: domain.AdminAccount{
		ID: 7, Email: "owner@wigaj.ru", Role: domain.AdminRoleOwner, Enabled: true,
	}}
	otp := &adminOTPStub{requestErr: domain.ErrCodeRequestTooSoon}
	svc := New(repo, otp, Config{})

	result, err := svc.RequestCode(context.Background(), "owner@wigaj.ru")
	if err != nil {
		t.Fatalf("RequestCode: %v", err)
	}
	if result.ExpiresIn != 600 {
		t.Fatalf("ExpiresIn = %d, want generic 600", result.ExpiresIn)
	}
}

func TestVerifyCodeCreatesOpaqueHashedSession(t *testing.T) {
	now := time.Date(2026, 8, 17, 12, 0, 0, 0, time.UTC)
	account := domain.AdminAccount{ID: 7, UserID: 11, Email: "owner@wigaj.ru", Role: domain.AdminRoleOwner, Enabled: true}
	repo := &adminRepoStub{account: account}
	otp := &adminOTPStub{}
	svc := New(repo, otp, Config{SessionTTL: 8 * time.Hour, IdleTTL: 30 * time.Minute, Now: func() time.Time { return now }})

	result, err := svc.VerifyCode(context.Background(), account.Email, "123456", ClientMeta{IPAddress: "127.0.0.1", UserAgent: "test-agent"})
	if err != nil {
		t.Fatalf("VerifyCode: %v", err)
	}
	if otp.verifiedEmail != account.Email || otp.verifiedCode != "123456" {
		t.Fatalf("admin OTP not verified with expected values: %#v", otp)
	}
	if result.SessionToken == "" || result.CSRFToken == "" || result.SessionToken == result.CSRFToken {
		t.Fatalf("invalid generated tokens: session=%q csrf=%q", result.SessionToken, result.CSRFToken)
	}
	if !bytes.Equal(repo.created.TokenHash, hashToken(result.SessionToken)) {
		t.Fatal("repository did not receive the session token hash")
	}
	if !bytes.Equal(repo.created.CSRFTokenHash, hashToken(result.CSRFToken)) {
		t.Fatal("repository did not receive the CSRF token hash")
	}
	if bytes.Contains(repo.created.TokenHash, []byte(result.SessionToken)) || bytes.Contains(repo.created.CSRFTokenHash, []byte(result.CSRFToken)) {
		t.Fatal("repository received a plaintext token")
	}
	if !result.ExpiresAt.Equal(now.Add(8 * time.Hour)) {
		t.Fatalf("ExpiresAt = %s", result.ExpiresAt)
	}
	if repo.createAudit.Action != "admin.login" || repo.createAudit.ActorAdminID != account.ID {
		t.Fatalf("unexpected audit: %#v", repo.createAudit)
	}
	var metadata map[string]string
	if err := json.Unmarshal(repo.createAudit.Metadata, &metadata); err != nil || metadata["role"] != domain.AdminRoleOwner {
		t.Fatalf("unexpected audit metadata: %s (%v)", repo.createAudit.Metadata, err)
	}
}

func TestAuthenticateRequiresCSRFAndEnforcesRoles(t *testing.T) {
	now := time.Date(2026, 8, 17, 12, 0, 0, 0, time.UTC)
	const sessionToken = "session-token"
	const csrfToken = "csrf-token"
	repo := &adminRepoStub{loaded: domain.AdminSession{
		AdminAccountID: 7,
		CSRFTokenHash:  hashToken(csrfToken),
		Account: domain.AdminAccount{
			ID: 7, Role: domain.AdminRoleSupport, Enabled: true,
		},
	}}
	svc := New(repo, &adminOTPStub{}, Config{SessionTTL: 8 * time.Hour, IdleTTL: 30 * time.Minute, Now: func() time.Time { return now }})

	if _, err := svc.Authenticate(context.Background(), sessionToken, "wrong", true); !errors.Is(err, ErrInvalidCSRF) {
		t.Fatalf("Authenticate wrong CSRF = %v, want ErrInvalidCSRF", err)
	}
	session, err := svc.Authenticate(context.Background(), sessionToken, csrfToken, true)
	if err != nil {
		t.Fatalf("Authenticate: %v", err)
	}
	if !bytes.Equal(repo.loadedHash, hashToken(sessionToken)) {
		t.Fatal("repository lookup did not use a session-token hash")
	}
	if !repo.loadedAfter.Equal(now.Add(-30 * time.Minute)) {
		t.Fatalf("idle cutoff = %s", repo.loadedAfter)
	}
	if err := svc.RequireRole(session, domain.AdminRoleSupport); err != nil {
		t.Fatalf("support role rejected: %v", err)
	}
	if err := svc.RequireRole(session, domain.AdminRoleModerator); !errors.Is(err, ErrForbidden) {
		t.Fatalf("support accepted as moderator: %v", err)
	}
	if err := svc.RequireRole(session, "unknown"); !errors.Is(err, ErrForbidden) {
		t.Fatalf("unknown minimum role accepted: %v", err)
	}
}

func TestAuthenticateRejectsExpiredOrIdleSession(t *testing.T) {
	repo := &adminRepoStub{loadErr: domain.ErrNotFound}
	svc := New(repo, &adminOTPStub{}, Config{})
	if _, err := svc.Authenticate(context.Background(), "expired", "", false); !errors.Is(err, ErrInvalidSession) {
		t.Fatalf("Authenticate = %v, want ErrInvalidSession", err)
	}
}
