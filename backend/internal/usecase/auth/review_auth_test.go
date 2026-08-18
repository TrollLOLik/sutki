package auth

import (
	"context"
	"testing"
	"time"

	"golang.org/x/crypto/bcrypt"

	"github.com/TrollLOLik/sutki/backend/internal/domain"
)

type reviewAuthNotifier struct {
	fakeNotifier
	loginCalls int
}

func (n *reviewAuthNotifier) SendLoginCode(context.Context, string, string, time.Duration) error {
	n.loginCalls++
	return nil
}

func newReviewAuthService(now, expiresAt time.Time) (*Service, *fakeAuthCodes, *reviewAuthNotifier) {
	codes := &fakeAuthCodes{}
	notifier := &reviewAuthNotifier{}
	return &Service{
		users:               &fakeUsers{user: domain.User{ID: 42, Email: "review@wigaj.ru"}},
		codes:               codes,
		notifier:            notifier,
		now:                 func() time.Time { return now },
		reviewAuthEnabled:   true,
		reviewAuthEmail:     "review@wigaj.ru",
		reviewAuthCode:      "482731",
		reviewAuthExpiresAt: expiresAt,
	}, codes, notifier
}

func TestRequestLoginCode_UsesTemporaryReviewerCodeWithoutSendingEmail(t *testing.T) {
	now := time.Date(2026, 8, 18, 12, 0, 0, 0, time.UTC)
	svc, codes, notifier := newReviewAuthService(now, now.Add(24*time.Hour))

	result, err := svc.RequestLoginCode(context.Background(), " REVIEW@WIGAJ.RU ")
	if err != nil {
		t.Fatalf("request reviewer code: %v", err)
	}
	if result.Exposed || result.Code != "" {
		t.Fatal("reviewer code must never be returned by the API")
	}
	if notifier.loginCalls != 0 {
		t.Fatalf("reviewer login queued %d emails, want none", notifier.loginCalls)
	}
	if !codes.exists {
		t.Fatal("reviewer code was not stored in the normal auth_code repository")
	}
	if codes.rec.Channel != "email" || codes.rec.Target != "review@wigaj.ru" {
		t.Fatalf("stored scope = %q/%q, want email/review@wigaj.ru", codes.rec.Channel, codes.rec.Target)
	}
	if err := bcrypt.CompareHashAndPassword([]byte(codes.rec.CodeHash), []byte("482731")); err != nil {
		t.Fatal("stored bcrypt hash does not contain the configured reviewer code")
	}
	if got := codes.rec.ExpiresAt.Sub(now); got != codeTTL {
		t.Fatalf("reviewer code TTL = %s, want %s", got, codeTTL)
	}
}

func TestRequestLoginCode_ExpiredReviewerAccessFallsBackToEmail(t *testing.T) {
	now := time.Date(2026, 8, 18, 12, 0, 0, 0, time.UTC)
	svc, _, notifier := newReviewAuthService(now, now.Add(-time.Second))

	if _, err := svc.RequestLoginCode(context.Background(), "review@wigaj.ru"); err != nil {
		t.Fatalf("request ordinary code after reviewer expiry: %v", err)
	}
	if notifier.loginCalls != 1 {
		t.Fatalf("ordinary email deliveries = %d, want 1", notifier.loginCalls)
	}
}

func TestRequestCode_DoesNotUseReviewerCredentialForEmailRebind(t *testing.T) {
	now := time.Date(2026, 8, 18, 12, 0, 0, 0, time.UTC)
	svc, _, notifier := newReviewAuthService(now, now.Add(24*time.Hour))

	if _, err := svc.RequestCode(context.Background(), "review@wigaj.ru"); err != nil {
		t.Fatalf("request factor-change code: %v", err)
	}
	if notifier.loginCalls != 1 {
		t.Fatalf("factor-change email deliveries = %d, want 1", notifier.loginCalls)
	}
}

func TestRequestAdminCode_DoesNotUseReviewerCredential(t *testing.T) {
	now := time.Date(2026, 8, 18, 12, 0, 0, 0, time.UTC)
	svc, _, notifier := newReviewAuthService(now, now.Add(24*time.Hour))

	if _, err := svc.RequestAdminCode(context.Background(), "review@wigaj.ru"); err != nil {
		t.Fatalf("request admin code: %v", err)
	}
	if notifier.loginCalls != 1 {
		t.Fatalf("admin email deliveries = %d, want 1", notifier.loginCalls)
	}
}
