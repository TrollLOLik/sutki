package auth

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"errors"
	"fmt"
	"log"
	"math/big"
	"net/mail"
	"strings"
	"time"

	"golang.org/x/crypto/bcrypt"

	"github.com/TrollLOLik/sutki/backend/internal/domain"
)

const (
	codeTTL     = 10 * time.Minute
	maxAttempts = 5
)

// Config tunes the auth service.
type Config struct {
	Secret     string
	AccessTTL  time.Duration
	RefreshTTL time.Duration
	// ExposeCode returns the generated login code in the API response and is
	// intended for development only (no email/SMS provider wired yet).
	ExposeCode bool
}

// Service implements passwordless email-code auth with JWT access/refresh.
type Service struct {
	users      domain.UserRepository
	codes      domain.AuthCodeRepository
	refresh    domain.RefreshTokenRepository
	tm         *TokenManager
	accessTTL  time.Duration
	refreshTTL time.Duration
	exposeCode bool
	now        func() time.Time
}

func New(
	users domain.UserRepository,
	codes domain.AuthCodeRepository,
	refresh domain.RefreshTokenRepository,
	cfg Config,
) *Service {
	return &Service{
		users:      users,
		codes:      codes,
		refresh:    refresh,
		tm:         NewTokenManager(cfg.Secret, cfg.AccessTTL),
		accessTTL:  cfg.AccessTTL,
		refreshTTL: cfg.RefreshTTL,
		exposeCode: cfg.ExposeCode,
		now:        time.Now,
	}
}

// TokenManager exposes the access-token parser for HTTP middleware.
func (s *Service) TokenManager() *TokenManager { return s.tm }

// RequestCodeResult reports the outcome of requesting an email login code.
type RequestCodeResult struct {
	ExpiresIn int64  // seconds until the code expires
	Code      string // populated only when ExposeCode is enabled (dev)
	Exposed   bool
}

// AuthResult is a freshly issued token pair plus the authenticated user.
type AuthResult struct {
	User         domain.User
	AccessToken  string
	RefreshToken string
	ExpiresIn    int64 // access token lifetime in seconds
}

// RequestCode generates and stores a hashed 6-digit code for the email.
func (s *Service) RequestCode(ctx context.Context, emailRaw string) (RequestCodeResult, error) {
	email, err := normalizeEmail(emailRaw)
	if err != nil {
		return RequestCodeResult{}, err
	}

	code, err := generateCode()
	if err != nil {
		return RequestCodeResult{}, err
	}
	hash, err := bcrypt.GenerateFromPassword([]byte(code), bcrypt.DefaultCost)
	if err != nil {
		return RequestCodeResult{}, err
	}
	expiresAt := s.now().Add(codeTTL)
	if err := s.codes.Upsert(ctx, email, string(hash), expiresAt); err != nil {
		return RequestCodeResult{}, err
	}

	// No email/SMS provider yet: log the code so it can be retrieved in dev.
	log.Printf("auth: login code for %s is %s (expires %s)", email, code, expiresAt.Format(time.RFC3339))

	res := RequestCodeResult{ExpiresIn: int64(codeTTL.Seconds())}
	if s.exposeCode {
		res.Code = code
		res.Exposed = true
	}
	return res, nil
}

// VerifyCode checks the code, upserts the user and issues a token pair.
func (s *Service) VerifyCode(ctx context.Context, emailRaw, code string) (AuthResult, error) {
	email, err := normalizeEmail(emailRaw)
	if err != nil {
		return AuthResult{}, err
	}
	code = strings.TrimSpace(code)

	rec, err := s.codes.Get(ctx, email)
	if err != nil {
		if errors.Is(err, domain.ErrNotFound) {
			return AuthResult{}, domain.ErrCodeInvalid
		}
		return AuthResult{}, err
	}
	if rec.Attempts >= maxAttempts {
		return AuthResult{}, domain.ErrTooManyAttempts
	}
	if s.now().After(rec.ExpiresAt) {
		_ = s.codes.Delete(ctx, email)
		return AuthResult{}, domain.ErrCodeExpired
	}
	if bcrypt.CompareHashAndPassword([]byte(rec.CodeHash), []byte(code)) != nil {
		_ = s.codes.IncrementAttempts(ctx, email)
		return AuthResult{}, domain.ErrCodeInvalid
	}

	// Code is valid: consume it, then find or create the account.
	_ = s.codes.Delete(ctx, email)

	user, err := s.users.GetByEmail(ctx, email)
	if errors.Is(err, domain.ErrNotFound) {
		user, err = s.users.Create(ctx, email)
	}
	if err != nil {
		return AuthResult{}, err
	}
	return s.issueTokens(ctx, user)
}

// Refresh rotates a refresh token, returning a new token pair.
func (s *Service) Refresh(ctx context.Context, refreshToken string) (AuthResult, error) {
	hash := hashToken(refreshToken)
	rec, err := s.refresh.Get(ctx, hash)
	if err != nil {
		if errors.Is(err, domain.ErrNotFound) {
			return AuthResult{}, domain.ErrTokenInvalid
		}
		return AuthResult{}, err
	}
	if rec.RevokedAt != nil || s.now().After(rec.ExpiresAt) {
		return AuthResult{}, domain.ErrTokenInvalid
	}
	if err := s.refresh.Revoke(ctx, hash); err != nil {
		return AuthResult{}, err
	}
	user, err := s.users.GetByID(ctx, rec.UserID)
	if err != nil {
		if errors.Is(err, domain.ErrNotFound) {
			return AuthResult{}, domain.ErrTokenInvalid
		}
		return AuthResult{}, err
	}
	return s.issueTokens(ctx, user)
}

// Logout revokes a refresh token. Unknown tokens are a no-op.
func (s *Service) Logout(ctx context.Context, refreshToken string) error {
	return s.refresh.Revoke(ctx, hashToken(refreshToken))
}

// GetUser returns the account for an authenticated user id.
func (s *Service) GetUser(ctx context.Context, id int32) (domain.User, error) {
	return s.users.GetByID(ctx, id)
}

// UpdateProfile updates the mutable profile fields for a user.
func (s *Service) UpdateProfile(ctx context.Context, id int32, name, phone, city string) (domain.User, error) {
	return s.users.UpdateProfile(ctx, id, strings.TrimSpace(name), strings.TrimSpace(phone), strings.TrimSpace(city))
}

func (s *Service) issueTokens(ctx context.Context, user domain.User) (AuthResult, error) {
	now := s.now()
	access, _, err := s.tm.Issue(user.ID, now)
	if err != nil {
		return AuthResult{}, err
	}
	refreshToken, err := generateToken()
	if err != nil {
		return AuthResult{}, err
	}
	if err := s.refresh.Create(ctx, user.ID, hashToken(refreshToken), now.Add(s.refreshTTL)); err != nil {
		return AuthResult{}, err
	}
	return AuthResult{
		User:         user,
		AccessToken:  access,
		RefreshToken: refreshToken,
		ExpiresIn:    int64(s.accessTTL.Seconds()),
	}, nil
}

func normalizeEmail(raw string) (string, error) {
	email := strings.ToLower(strings.TrimSpace(raw))
	if email == "" {
		return "", domain.ErrInvalidEmail
	}
	if _, err := mail.ParseAddress(email); err != nil {
		return "", domain.ErrInvalidEmail
	}
	return email, nil
}

func generateCode() (string, error) {
	n, err := rand.Int(rand.Reader, big.NewInt(1000000))
	if err != nil {
		return "", err
	}
	return fmt.Sprintf("%06d", n.Int64()), nil
}

func generateToken() (string, error) {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(b), nil
}

func hashToken(token string) string {
	sum := sha256.Sum256([]byte(token))
	return hex.EncodeToString(sum[:])
}
