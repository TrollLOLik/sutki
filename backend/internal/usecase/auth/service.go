package auth

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"math/big"
	"net/http"
	"net/mail"
	"strings"
	"sync"
	"time"

	"golang.org/x/crypto/bcrypt"

	"github.com/TrollLOLik/sutki/backend/internal/domain"
)

const (
	codeTTL = 10 * time.Minute
	// resendCooldown throttles how often a new code may be requested per email.
	resendCooldown = 60 * time.Second
	maxAttempts    = 5
)

// Config tunes the auth service.
type Config struct {
	Secret     string
	AccessTTL  time.Duration
	RefreshTTL time.Duration
	// ExposeCode returns the generated login code in the API response and is
	// intended for development only (no email/SMS provider wired yet).
	ExposeCode bool

	// Notifier queues outgoing email (login codes). May be nil in tests or
	// when SMTP is not configured; sends are then skipped.
	Notifier     domain.EmailNotifier
	DadataAPIKey string
	Storage      domain.FileStorage
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
	storage    domain.FileStorage

	notifier     domain.EmailNotifier
	dadataAPIKey string

	// NOTE(multi-instance): these in-memory maps are correct for a single
	// backend instance only. Before scaling horizontally they must move to a
	// shared store (e.g. Redis or the DB), otherwise email-change tokens and
	// the session blacklist won't be visible across instances.
	emailChangeTokens sync.Map // map[int32]emailChangeToken (userID -> token+expiry)
	sessionCache      sync.Map // map[int64]time.Time (sid -> expiresAt)
	sessionBlacklist  sync.Map // map[int64]bool (sid -> isBlacklisted)
	ipLocationCache   sync.Map // map[string]string (ip -> city/region)
}

// emailChangeTokenTTL bounds the window between confirming the old email and
// completing the change. Without it, tokens lived until process restart.
const emailChangeTokenTTL = 15 * time.Minute

// emailChangeToken is a short-lived proof that the user recently confirmed
// ownership of their current email.
type emailChangeToken struct {
	token     string
	expiresAt time.Time
}

// loadEmailChangeToken returns the user's live token, deleting it if expired.
func (s *Service) loadEmailChangeToken(userID int32) (emailChangeToken, bool) {
	v, ok := s.emailChangeTokens.Load(userID)
	if !ok {
		return emailChangeToken{}, false
	}
	tok, ok := v.(emailChangeToken)
	if !ok {
		s.emailChangeTokens.Delete(userID)
		return emailChangeToken{}, false
	}
	if s.now().After(tok.expiresAt) {
		s.emailChangeTokens.Delete(userID)
		return emailChangeToken{}, false
	}
	return tok, true
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
		storage:    cfg.Storage,

		notifier:     cfg.Notifier,
		dadataAPIKey: cfg.DadataAPIKey,
	}
}

// TokenManager exposes the access-token parser for HTTP middleware.
func (s *Service) TokenManager() *TokenManager { return s.tm }
func (s *Service) ExposeCode() bool            { return s.exposeCode }

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

	// Throttle: reject if a code was issued for this email within the cooldown.
	// This prevents invalidating a victim's pending code and flooding their inbox.
	// Bypassed in dev (exposeCode=true) so developers can test quickly.
	if !s.exposeCode {
		switch existing, err := s.codes.Get(ctx, email); {
		case err == nil:
			if s.now().Before(existing.CreatedAt.Add(resendCooldown)) {
				return RequestCodeResult{}, domain.ErrCodeRequestTooSoon
			}
		case errors.Is(err, domain.ErrNotFound):
			// No prior code for this email: proceed.
		default:
			return RequestCodeResult{}, err
		}
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

	// Queue the verification email into the durable outbox. Enqueue is a
	// fast DB insert (delivery happens in a background worker), so it stays
	// on the request path: if queueing fails we log and continue — the code
	// is already stored and dev flows (exposeCode) still work.
	if s.notifier != nil {
		if err := s.notifier.SendLoginCode(ctx, email, code, codeTTL); err != nil {
			log.Printf("auth: failed to queue login code email to %s: %v", maskEmail(email), err)
		}
	}

	// No email/SMS provider yet: log the code so it can be retrieved in dev.
	// Gated by exposeCode so the plaintext code never reaches production logs.
	if s.exposeCode {
		log.Printf("auth: login code for %s is %s (expires %s)", email, code, expiresAt.Format(time.RFC3339))
	}

	res := RequestCodeResult{ExpiresIn: int64(codeTTL.Seconds())}
	if s.exposeCode {
		res.Code = code
		res.Exposed = true
	}
	return res, nil
}

// VerifyCode checks the code, upserts the user and issues a token pair.
func (s *Service) VerifyCode(ctx context.Context, emailRaw, code string, info domain.DeviceInfo) (AuthResult, error) {
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

	// Link guest requests and change their status to in_progress
	if err := s.users.LinkGuestRequests(ctx, user.ID, email); err != nil {
		log.Printf("auth: failed to link guest requests for user %d (email %s): %v", user.ID, maskEmail(email), err)
	}

	return s.issueTokens(ctx, user, info)
}

// Refresh rotates a refresh token, returning a new token pair.
func (s *Service) Refresh(ctx context.Context, refreshToken string, info domain.DeviceInfo) (AuthResult, error) {
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
	return s.issueTokens(ctx, user, info)
}

// Logout revokes a refresh token. Unknown tokens are a no-op.
func (s *Service) Logout(ctx context.Context, refreshToken string) error {
	return s.refresh.Revoke(ctx, hashToken(refreshToken))
}

func (s *Service) formatUserAvatar(u domain.User) domain.User {
	if u.AvatarURL == "" {
		return u
	}
	if strings.HasPrefix(u.AvatarURL, "http://") || strings.HasPrefix(u.AvatarURL, "https://") || strings.Contains(u.AvatarURL, "upload_files/") {
		return u
	}
	u.AvatarURL = s.storage.PublicURL(u.AvatarURL)
	return u
}

// GetUser returns the account for an authenticated user id.
func (s *Service) GetUser(ctx context.Context, id int32) (domain.User, error) {
	u, err := s.users.GetByID(ctx, id)
	if err != nil {
		return domain.User{}, err
	}
	return s.formatUserAvatar(u), nil
}

// UpdateProfile updates the provided profile fields for a user. nil fields are
// left unchanged (PATCH semantics).
func (s *Service) UpdateProfile(ctx context.Context, id int32, name, surname, patronymic, phone, city, avatarURL *string, birthday *time.Time, vkID *string, vkIDDoNull *bool) (domain.User, error) {
	u, err := s.users.UpdateProfile(ctx, id, trimPtr(name), trimPtr(surname), trimPtr(patronymic), trimPtr(phone), trimPtr(city), trimPtr(avatarURL), birthday, vkID, vkIDDoNull)
	if err != nil {
		return domain.User{}, err
	}
	return s.formatUserAvatar(u), nil
}

// DeleteUser deletes a user account (e.g. if they abort onboarding).
func (s *Service) DeleteUser(ctx context.Context, id int32) error {
	return s.users.Delete(ctx, id)
}

// CheckDeleteAccount checks if the user has any active bookings.
func (s *Service) CheckDeleteAccount(ctx context.Context, userID int32) (bool, error) {
	count, err := s.users.CheckActiveBookings(ctx, userID)
	if err != nil {
		return false, err
	}
	return count > 0, nil
}

// RequestDeleteAccountCode requests a confirmation code for deleting the account.
func (s *Service) RequestDeleteAccountCode(ctx context.Context, userID int32) (RequestCodeResult, error) {
	user, err := s.users.GetByID(ctx, userID)
	if err != nil {
		return RequestCodeResult{}, err
	}

	hasActive, err := s.CheckDeleteAccount(ctx, userID)
	if err != nil {
		return RequestCodeResult{}, err
	}
	if hasActive {
		return RequestCodeResult{}, domain.ErrActiveBookings
	}

	return s.RequestCode(ctx, user.Email)
}

// ConfirmDeleteAccount confirms deletion by verifying the code and then performing anonymization.
func (s *Service) ConfirmDeleteAccount(ctx context.Context, userID int32, code string) error {
	user, err := s.users.GetByID(ctx, userID)
	if err != nil {
		return err
	}

	hasActive, err := s.CheckDeleteAccount(ctx, userID)
	if err != nil {
		return err
	}
	if hasActive {
		return domain.ErrActiveBookings
	}

	email, err := normalizeEmail(user.Email)
	if err != nil {
		return err
	}
	code = strings.TrimSpace(code)

	rec, err := s.codes.Get(ctx, email)
	if err != nil {
		if errors.Is(err, domain.ErrNotFound) {
			return domain.ErrCodeInvalid
		}
		return err
	}
	if rec.Attempts >= maxAttempts {
		return domain.ErrTooManyAttempts
	}
	if s.now().After(rec.ExpiresAt) {
		_ = s.codes.Delete(ctx, email)
		return domain.ErrCodeExpired
	}
	if bcrypt.CompareHashAndPassword([]byte(rec.CodeHash), []byte(code)) != nil {
		_ = s.codes.IncrementAttempts(ctx, email)
		return domain.ErrCodeInvalid
	}

	_ = s.codes.Delete(ctx, email)

	h := sha256.New()
	h.Write([]byte(email))
	emailHash := hex.EncodeToString(h.Sum(nil))

	if err := s.users.AnonymizeAndRevoke(ctx, userID, emailHash); err != nil {
		return err
	}

	return nil
}

// trimPtr trims a non-nil string pointer in place, leaving nil pointers as-is.
func trimPtr(s *string) *string {
	if s == nil {
		return nil
	}
	t := strings.TrimSpace(*s)
	return &t
}

func (s *Service) issueTokens(ctx context.Context, user domain.User, info domain.DeviceInfo) (AuthResult, error) {
	now := s.now()

	refreshToken, err := generateToken()
	if err != nil {
		return AuthResult{}, err
	}

	// Clean fields
	info.DeviceName = trimPtr(info.DeviceName)
	info.DeviceOS = trimPtr(info.DeviceOS)
	info.AppVersion = trimPtr(info.AppVersion)
	info.IPAddress = trimPtr(info.IPAddress)
	info.Location = trimPtr(info.Location)

	sessionID, err := s.refresh.Create(ctx, user.ID, hashToken(refreshToken), now.Add(s.refreshTTL),
		info.DeviceName, info.DeviceOS, info.AppVersion, info.IPAddress, info.Location)
	if err != nil {
		return AuthResult{}, err
	}

	access, _, err := s.tm.Issue(user.ID, sessionID, now)
	if err != nil {
		return AuthResult{}, err
	}

	return AuthResult{
		User:         s.formatUserAvatar(user),
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
	// mail.ParseAddress accepts RFC 5322 forms like `"Name" <a@b.com>`; take the
	// bare address so the stored key/lookup is always a plain email.
	addr, err := mail.ParseAddress(email)
	if err != nil {
		return "", domain.ErrInvalidEmail
	}
	return addr.Address, nil
}

// maskEmail redacts an email address for log output; see domain.MaskEmail.
// Dev-only paths gated by exposeCode may still log full addresses.
func maskEmail(email string) string {
	return domain.MaskEmail(email)
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

func (s *Service) RequestOldEmailCode(ctx context.Context, userID int32) (RequestCodeResult, error) {
	user, err := s.users.GetByID(ctx, userID)
	if err != nil {
		return RequestCodeResult{}, err
	}
	return s.RequestCode(ctx, user.Email)
}

func (s *Service) VerifyOldEmailCode(ctx context.Context, userID int32, code string) (string, error) {
	user, err := s.users.GetByID(ctx, userID)
	if err != nil {
		return "", err
	}
	email, err := normalizeEmail(user.Email)
	if err != nil {
		return "", err
	}
	code = strings.TrimSpace(code)

	rec, err := s.codes.Get(ctx, email)
	if err != nil {
		if errors.Is(err, domain.ErrNotFound) {
			return "", domain.ErrCodeInvalid
		}
		return "", err
	}
	if rec.Attempts >= maxAttempts {
		return "", domain.ErrTooManyAttempts
	}
	if s.now().After(rec.ExpiresAt) {
		_ = s.codes.Delete(ctx, email)
		return "", domain.ErrCodeExpired
	}
	if bcrypt.CompareHashAndPassword([]byte(rec.CodeHash), []byte(code)) != nil {
		_ = s.codes.IncrementAttempts(ctx, email)
		return "", domain.ErrCodeInvalid
	}

	_ = s.codes.Delete(ctx, email)

	b := make([]byte, 16)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	token := hex.EncodeToString(b)
	s.emailChangeTokens.Store(userID, emailChangeToken{
		token:     token,
		expiresAt: s.now().Add(emailChangeTokenTTL),
	})

	return token, nil
}

func (s *Service) RequestNewEmailCode(ctx context.Context, userID int32, oldToken, newEmailRaw string) (RequestCodeResult, error) {
	stored, ok := s.loadEmailChangeToken(userID)
	if !ok || subtle.ConstantTimeCompare([]byte(stored.token), []byte(oldToken)) != 1 {
		return RequestCodeResult{}, domain.ErrTokenInvalid
	}

	newEmail, err := normalizeEmail(newEmailRaw)
	if err != nil {
		return RequestCodeResult{}, err
	}

	_, err = s.users.GetByEmail(ctx, newEmail)
	if err == nil {
		return RequestCodeResult{}, domain.ErrEmailTaken
	} else if !errors.Is(err, domain.ErrNotFound) {
		return RequestCodeResult{}, err
	}

	return s.RequestCode(ctx, newEmail)
}

func (s *Service) ConfirmEmailChange(ctx context.Context, userID int32, newEmailRaw, code string) (domain.User, error) {
	_, ok := s.loadEmailChangeToken(userID)
	if !ok {
		return domain.User{}, domain.ErrTokenInvalid
	}

	newEmail, err := normalizeEmail(newEmailRaw)
	if err != nil {
		return domain.User{}, err
	}
	code = strings.TrimSpace(code)

	rec, err := s.codes.Get(ctx, newEmail)
	if err != nil {
		if errors.Is(err, domain.ErrNotFound) {
			return domain.User{}, domain.ErrCodeInvalid
		}
		return domain.User{}, err
	}
	if rec.Attempts >= maxAttempts {
		return domain.User{}, domain.ErrTooManyAttempts
	}
	if s.now().After(rec.ExpiresAt) {
		_ = s.codes.Delete(ctx, newEmail)
		return domain.User{}, domain.ErrCodeExpired
	}
	if bcrypt.CompareHashAndPassword([]byte(rec.CodeHash), []byte(code)) != nil {
		_ = s.codes.IncrementAttempts(ctx, newEmail)
		return domain.User{}, domain.ErrCodeInvalid
	}

	_ = s.codes.Delete(ctx, newEmail)
	s.emailChangeTokens.Delete(userID)

	u, err := s.users.UpdateEmail(ctx, userID, newEmail)
	if err != nil {
		return domain.User{}, err
	}
	return s.formatUserAvatar(u), nil
}

func (s *Service) IsValidSession(ctx context.Context, sid int64) bool {
	if sid == 0 {
		return false
	}
	if s.isSessionBlacklisted(sid) {
		return false
	}

	now := s.now()
	if exp, found := s.sessionCacheGet(sid); found {
		if now.Before(exp) {
			return true
		}
		s.blacklistSession(sid)
		return false
	}

	// Fallback to database
	token, err := s.refresh.GetByID(ctx, sid)
	if err != nil {
		s.blacklistSession(sid)
		return false
	}

	if token.RevokedAt != nil || now.After(token.ExpiresAt) {
		s.blacklistSession(sid)
		return false
	}

	s.sessionCacheSet(sid, token.ExpiresAt)
	return true
}

func (s *Service) blacklistSession(sid int64) {
	s.sessionBlacklist.Store(sid, true)
	s.sessionCache.Delete(sid)
}

func (s *Service) sessionCacheGet(sid int64) (time.Time, bool) {
	val, ok := s.sessionCache.Load(sid)
	if !ok {
		return time.Time{}, false
	}
	return val.(time.Time), true
}

func (s *Service) sessionCacheSet(sid int64, expiresAt time.Time) {
	s.sessionCache.Store(sid, expiresAt)
}

func (s *Service) isSessionBlacklisted(sid int64) bool {
	_, ok := s.sessionBlacklist.Load(sid)
	return ok
}

// SessionDTO is a clean structure for JSON responses.
type SessionDTO struct {
	ID           int64     `json:"id"`
	DeviceName   string    `json:"device_name"`
	DeviceOS     string    `json:"device_os"`
	AppVersion   string    `json:"app_version"`
	IPAddress    string    `json:"ip_address"`
	Location     string    `json:"location"`
	LastActiveAt time.Time `json:"last_active_at"`
}

type SessionsResult struct {
	Current SessionDTO   `json:"current"`
	Active  []SessionDTO `json:"active"`
}

func (s *Service) ListSessions(ctx context.Context, userID int32, currentSID int64) (SessionsResult, error) {
	tokens, err := s.refresh.ListActive(ctx, userID)
	if err != nil {
		return SessionsResult{}, err
	}

	var current SessionDTO
	active := make([]SessionDTO, 0)

	for _, t := range tokens {
		dto := SessionDTO{
			ID:           t.ID,
			DeviceName:   stringOrEmpty(t.DeviceName),
			DeviceOS:     stringOrEmpty(t.DeviceOS),
			AppVersion:   stringOrEmpty(t.AppVersion),
			IPAddress:    stringOrEmpty(t.IPAddress),
			Location:     stringOrEmpty(t.Location),
			LastActiveAt: t.LastActiveAt,
		}

		if t.ID == currentSID {
			current = dto
		} else {
			active = append(active, dto)
		}
	}

	// If current session was not found in the DB (should not happen normally but just in case)
	if current.ID == 0 && currentSID != 0 {
		current.ID = currentSID
		current.DeviceOS = "Unknown OS"
		current.DeviceName = "Current Device"
		current.LastActiveAt = s.now()
	}

	return SessionsResult{
		Current: current,
		Active:  active,
	}, nil
}

func stringOrEmpty(ptr *string) string {
	if ptr == nil {
		return ""
	}
	return *ptr
}

func (s *Service) RevokeSession(ctx context.Context, sessionID int64, userID int32) error {
	err := s.refresh.RevokeByID(ctx, sessionID, userID)
	if err != nil {
		return err
	}
	s.blacklistSession(sessionID)
	return nil
}

func (s *Service) RevokeAllSessionsExcept(ctx context.Context, currentSID int64, userID int32) error {
	// First fetch all other active sessions to blacklist them in memory
	tokens, err := s.refresh.ListActive(ctx, userID)
	if err == nil {
		for _, t := range tokens {
			if t.ID != currentSID {
				s.blacklistSession(t.ID)
			}
		}
	}

	return s.refresh.RevokeAllExcept(ctx, currentSID, userID)
}

func (s *Service) UpdateSessionActiveTime(ctx context.Context, sid int64) {
	if sid == 0 {
		return
	}
	now := s.now()
	// Update active time in background (without blocking response) and rate-limit db calls to once every 5 minutes
	cacheKey := fmt.Sprintf("last_write_%d", sid)
	if val, ok := s.sessionCache.Load(cacheKey); ok {
		lastWrite := val.(time.Time)
		if now.Sub(lastWrite) < 5*time.Minute {
			return
		}
	}

	s.sessionCache.Store(cacheKey, now)

	go func() {
		bgCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		_ = s.refresh.UpdateActiveTime(bgCtx, sid, now)
	}()
}

func (s *Service) resolveAndSaveLocation(sessionID int64, ip string) {
	if ip == "" || ip == "127.0.0.1" || ip == "::1" || strings.HasPrefix(ip, "10.") || strings.HasPrefix(ip, "192.168.") || strings.HasPrefix(ip, "172.16.") {
		return
	}

	// 1. Check local IP cache
	if cachedVal, ok := s.ipLocationCache.Load(ip); ok {
		city := cachedVal.(string)
		if city != "" {
			bgCtx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
			defer cancel()
			_ = s.refresh.UpdateLocation(bgCtx, sessionID, city)
		}
		return
	}

	// 2. Fetch from DaData with timeout
	if s.dadataAPIKey == "" {
		return
	}

	bgCtx, cancel := context.WithTimeout(context.Background(), 300*time.Millisecond)
	defer cancel()

	url := "https://suggestions.dadata.ru/suggestions/api/4_1/rs/iplocate/address?ip=" + ip
	req, err := http.NewRequestWithContext(bgCtx, "GET", url, nil)
	if err != nil {
		return
	}

	req.Header.Set("Accept", "application/json")
	req.Header.Set("Authorization", "Token "+s.dadataAPIKey)

	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return
	}

	bodyBytes, err := io.ReadAll(resp.Body)
	if err != nil {
		return
	}

	var parsed struct {
		Location *struct {
			Value string `json:"value"`
			Data  *struct {
				City string `json:"city"`
			} `json:"data"`
		} `json:"location"`
	}

	if err := json.Unmarshal(bodyBytes, &parsed); err != nil {
		return
	}

	city := ""
	if parsed.Location != nil {
		if parsed.Location.Data != nil && parsed.Location.Data.City != "" {
			city = parsed.Location.Data.City
		} else {
			city = parsed.Location.Value
		}
	}

	if city == "" {
		return
	}

	// Cache IP
	s.ipLocationCache.Store(ip, city)

	// Save to DB
	dbCtx, dbCancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer dbCancel()
	_ = s.refresh.UpdateLocation(dbCtx, sessionID, city)
}
