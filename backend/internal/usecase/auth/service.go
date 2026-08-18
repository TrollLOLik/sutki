package auth

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"math/big"
	"net"
	"net/http"
	"net/mail"
	"strings"
	"sync"
	"time"

	"golang.org/x/crypto/bcrypt"

	"github.com/TrollLOLik/sutki/backend/internal/domain"
	"github.com/TrollLOLik/sutki/backend/internal/media"
	"github.com/TrollLOLik/sutki/backend/internal/observability"
	"github.com/TrollLOLik/sutki/backend/internal/usecase/imagemoderation"
)

const (
	codeTTL = 10 * time.Minute
	// resendCooldown throttles how often a new code may be requested per email.
	resendCooldown        = 60 * time.Second
	maxAttempts           = 5
	phonePendingTTL       = 30 * time.Second
	adminEmailCodeChannel = "admin_email"
)

// Config tunes the auth service.
type Config struct {
	Secret     string
	AccessTTL  time.Duration
	RefreshTTL time.Duration
	// ExposeCode returns the generated login code in the API response and is
	// intended for development only.
	ExposeCode bool

	// Notifier queues outgoing email (login codes). May be nil in tests or
	// when SMTP is not configured; sends are then skipped.
	Notifier        domain.EmailNotifier
	PhoneCaller     domain.PhoneCallProvider
	PhoneChallenges domain.PhoneChallengeRepository
	// ReauthChallenges persists factor-change proofs. Required in any
	// deployment that allows changing a phone or email: when nil, every such
	// change is refused rather than silently permitted.
	ReauthChallenges domain.ReauthChallengeRepository
	DadataAPIKey     string
	Storage          domain.FileStorage
	ImageModerator   domain.ImageModerator
}

// Service implements passwordless email/phone auth with JWT access/refresh.
type Service struct {
	users            domain.UserRepository
	codes            domain.AuthCodeRepository
	refresh          domain.RefreshTokenRepository
	phoneCaller      domain.PhoneCallProvider
	phoneChallenges  domain.PhoneChallengeRepository
	reauthChallenges domain.ReauthChallengeRepository
	tm               *TokenManager
	accessTTL        time.Duration
	refreshTTL       time.Duration
	exposeCode       bool
	now              func() time.Time
	storage          domain.FileStorage
	imageModerator   domain.ImageModerator

	notifier     domain.EmailNotifier
	dadataAPIKey string

	// onGuestRequestsLinked is called (in background) with the request IDs
	// that were just linked to a freshly verified user, so the booking use
	// case can notify listing owners. Set via SetGuestRequestsLinkedHook to
	// avoid a construction-order cycle in main. May be nil.
	onGuestRequestsLinked func(ctx context.Context, requestIDs []int32)

	// NOTE(multi-instance): these in-memory maps are correct for a single
	// backend instance only. Before scaling horizontally they must move to a
	// shared store (e.g. Redis or the DB), otherwise email-change tokens and
	// the session blacklist won't be visible across instances.
	sessionCache     sync.Map // map[int64]time.Time (sid -> expiresAt)
	sessionBlacklist sync.Map // map[int64]bool (sid -> isBlacklisted)
	ipLocationCache  sync.Map // map[string]string (ip -> city/region)
}

// reauthTokenTTL bounds the window between proving the current factor and
// completing the change. Without it, tokens lived until process restart.
const reauthTokenTTL = 15 * time.Minute

// Factors a re-authentication challenge can be sent on.
const (
	ReauthFactorPhone = "phone"
	ReauthFactorEmail = "email"
)

// reauthTokenBytes is the entropy of a proof token. 32 bytes matches the
// refresh tokens: a proof authorizes taking over the account, so it must not be
// the weakest link.
const reauthTokenBytes = 32

// requireReauth rejects unless the caller presents a live, verified, unspent
// proof scoped to this purpose. The proof is validated but NOT spent here: a
// factor change is a request/confirm pair, and burning the proof on the first
// half would leave the second half unauthorized.
//
// The spend happens in ConsumeAndRebind, inside the same transaction as the
// rebind itself, where the factor is also re-checked against a locked account
// row. This function is the cheap early gate, not the security boundary.
func (s *Service) requireReauth(ctx context.Context, userID int32, purpose, presented string) error {
	if s.reauthChallenges == nil {
		// Fail closed. A deployment without the repository wired cannot verify
		// anyone, and silently allowing the change would be the exact hole this
		// whole mechanism exists to close.
		return domain.ErrReauthRequired
	}
	if presented == "" {
		return domain.ErrReauthRequired
	}
	if _, err := s.reauthChallenges.Get(ctx, hashToken(presented), userID, purpose, s.now()); err != nil {
		if errors.Is(err, domain.ErrNotFound) {
			return domain.ErrReauthRequired
		}
		return err
	}
	return nil
}

// rebindWithProof spends the proof and applies the factor change as one
// transaction, so a failure anywhere leaves neither applied.
func (s *Service) rebindWithProof(ctx context.Context, req domain.ReauthRebind, presented string) error {
	if s.reauthChallenges == nil {
		return domain.ErrReauthRequired
	}
	if presented == "" {
		return domain.ErrReauthRequired
	}
	req.TokenHash = hashToken(presented)
	err := s.reauthChallenges.ConsumeAndRebind(ctx, req, reauthFactorFor)
	if errors.Is(err, domain.ErrNotFound) {
		return domain.ErrReauthRequired
	}
	return err
}

// validReauthPurpose rejects anything outside the enum the table's CHECK
// allows, so a bad client value fails here rather than as a 23514 from the DB.
func validReauthPurpose(p string) bool {
	return p == domain.ReauthPurposeChangePhone || p == domain.ReauthPurposeChangeEmail
}

// reauthFactorFor picks the factor the account must prove.
//
// A verified phone wins over email: the phone is what grants passwordless
// login, so it is both the stronger proof and the thing an attacker is trying
// to replace. Accounts always have at least one — they are created either
// through an email code or a phone call — so the error is a guard, not a path.
func reauthFactorFor(u domain.User) (string, error) {
	if u.PhoneVerifiedAt != nil && u.PhoneNormalized != "" {
		return ReauthFactorPhone, nil
	}
	if u.Email != "" {
		return ReauthFactorEmail, nil
	}
	return "", domain.ErrReauthUnavailable
}

// ReauthChallenge tells the client which factor it must satisfy, alongside the
// usual delivery details.
type ReauthChallenge struct {
	Factor string
	RequestCodeResult
}

// RequestReauthCode sends a one-time code on the factor already attached to the
// account. It never accepts a target from the caller — that is the whole point:
// the code has to reach whoever owns the account today, not whoever holds the
// access token right now.
func (s *Service) RequestReauthCode(ctx context.Context, userID int32, purpose string) (ReauthChallenge, error) {
	if !validReauthPurpose(purpose) {
		return ReauthChallenge{}, domain.ErrCodeInvalid
	}
	if s.reauthChallenges == nil {
		return ReauthChallenge{}, domain.ErrReauthUnavailable
	}
	user, err := s.users.GetByID(ctx, userID)
	if err != nil {
		return ReauthChallenge{}, err
	}
	factor, err := reauthFactorFor(user)
	if err != nil {
		return ReauthChallenge{}, err
	}

	var res RequestCodeResult
	var phoneChallengeID *string
	if factor == ReauthFactorPhone {
		res, err = s.requestPhoneChallenge(ctx, user.PhoneNormalized, domain.PhoneChallengePurposeReauth, &userID)
		if err != nil {
			return ReauthChallenge{}, err
		}
		id := res.ChallengeID
		phoneChallengeID = &id
	} else {
		res, err = s.RequestCode(ctx, user.Email)
		if err != nil {
			return ReauthChallenge{}, err
		}
	}

	// Record what this code is for, server-side, BEFORE the user ever sends it
	// back. Verification reads purpose and factor from here rather than from the
	// verify request, so a client cannot request a code "to change my email" and
	// then present it as authorization to change the phone.
	now := s.now()
	if _, err := s.reauthChallenges.Start(ctx, domain.ReauthAttempt{
		UserID:           userID,
		Purpose:          purpose,
		Factor:           factor,
		PhoneChallengeID: phoneChallengeID,
		ExpiresAt:        now.Add(codeTTL),
		Now:              now,
	}); err != nil {
		return ReauthChallenge{}, err
	}
	return ReauthChallenge{Factor: factor, RequestCodeResult: res}, nil
}

// VerifyReauthCode checks the code against the attempt the server recorded and,
// on success, issues the short-lived proof the change endpoints demand.
//
// It deliberately takes no purpose and no challenge id: both come from the
// stored attempt. Accepting either from the caller is what let a code issued
// for one operation be redeemed as authorization for another.
func (s *Service) VerifyReauthCode(ctx context.Context, userID int32, code string) (string, error) {
	if s.reauthChallenges == nil {
		return "", domain.ErrReauthUnavailable
	}
	now := s.now()
	attempt, err := s.reauthChallenges.Pending(ctx, userID, now)
	if err != nil {
		if errors.Is(err, domain.ErrNotFound) {
			return "", domain.ErrCodeInvalid
		}
		return "", err
	}
	user, err := s.users.GetByID(ctx, userID)
	if err != nil {
		return "", err
	}
	// The account must still designate the factor this attempt was opened for,
	// or the code in flight no longer proves what it was meant to.
	factor, err := reauthFactorFor(user)
	if err != nil {
		return "", err
	}
	if factor != attempt.Factor {
		return "", domain.ErrReauthRequired
	}

	if attempt.Factor == ReauthFactorPhone {
		if attempt.PhoneChallengeID == nil {
			return "", domain.ErrCodeInvalid
		}
		c, err := s.verifyPhoneChallenge(ctx, user.PhoneNormalized, code,
			domain.PhoneChallengePurposeReauth, *attempt.PhoneChallengeID, &userID)
		if err != nil {
			return "", err
		}
		if err := s.phoneChallenges.MarkVerified(ctx, c.ID); err != nil {
			return "", err
		}
	} else {
		email, err := normalizeEmail(user.Email)
		if err != nil {
			return "", err
		}
		if err := s.consumeEmailCode(ctx, email, code); err != nil {
			return "", err
		}
	}

	return s.issueReauthToken(ctx, attempt.ID, userID, now)
}

// RequestReauthVoiceFallback re-delivers a pending phone re-auth code as a
// voice call. Number and challenge both come from the server side.
func (s *Service) RequestReauthVoiceFallback(ctx context.Context, userID int32) (RequestCodeResult, error) {
	if s.reauthChallenges == nil {
		return RequestCodeResult{}, domain.ErrReauthUnavailable
	}
	attempt, err := s.reauthChallenges.Pending(ctx, userID, s.now())
	if err != nil {
		if errors.Is(err, domain.ErrNotFound) {
			return RequestCodeResult{}, domain.ErrCodeInvalid
		}
		return RequestCodeResult{}, err
	}
	if attempt.Factor != ReauthFactorPhone || attempt.PhoneChallengeID == nil {
		return RequestCodeResult{}, domain.ErrCodeInvalid
	}
	user, err := s.users.GetByID(ctx, userID)
	if err != nil {
		return RequestCodeResult{}, err
	}
	return s.RequestPhoneVoiceFallback(ctx, user.PhoneNormalized, *attempt.PhoneChallengeID,
		domain.PhoneChallengePurposeReauth, &userID)
}

// issueReauthToken mints a proof for the attempt whose code just checked out and
// stores only its hash. The token is handed to the client exactly once; the
// database never holds anything spendable.
func (s *Service) issueReauthToken(ctx context.Context, attemptID int64, userID int32, now time.Time) (string, error) {
	b := make([]byte, reauthTokenBytes)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	token := hex.EncodeToString(b)
	if err := s.reauthChallenges.MarkVerified(ctx, attemptID, userID, hashToken(token), now.Add(reauthTokenTTL), now); err != nil {
		if errors.Is(err, domain.ErrNotFound) {
			// Another request verified the same attempt first.
			return "", domain.ErrCodeInvalid
		}
		return "", err
	}
	return token, nil
}

// consumeEmailCode spends one attempt and checks the code for an email target,
// deleting the record on success. Shared by every email-code verification so
// the attempt budget is spent identically on all of them.
func (s *Service) consumeEmailCode(ctx context.Context, email, code string) error {
	return s.consumeScopedEmailCode(ctx, "email", email, code)
}

// VerifyAdminCode consumes only an admin_email challenge and never issues a
// normal user token pair. The admin-auth use case creates its own session only
// after checking that the account is still enabled and has an operator role.
func (s *Service) VerifyAdminCode(ctx context.Context, emailRaw, code string) error {
	email, err := normalizeEmail(emailRaw)
	if err != nil {
		return err
	}
	return s.consumeScopedEmailCode(ctx, adminEmailCodeChannel, email, code)
}

func (s *Service) consumeScopedEmailCode(ctx context.Context, channel, email, code string) error {
	code = strings.TrimSpace(code)
	rec, err := s.codes.ConsumeAttempt(ctx, channel, email, maxAttempts)
	if err != nil {
		if errors.Is(err, domain.ErrNotFound) {
			return domain.ErrCodeInvalid
		}
		return err
	}
	if s.now().After(rec.ExpiresAt) {
		_ = s.codes.Delete(ctx, channel, email)
		return domain.ErrCodeExpired
	}
	if bcrypt.CompareHashAndPassword([]byte(rec.CodeHash), []byte(code)) != nil {
		return domain.ErrCodeInvalid
	}
	_ = s.codes.Delete(ctx, channel, email)
	return nil
}

// afterFactorChange runs once a rebind has committed: it drops the in-memory
// session cache for the sessions the transaction already revoked, and warns the
// address the account had beforehand.
//
// The durable half of the revocation — refresh_token.revoked_at — is written
// inside the rebind transaction, so it cannot be lost. What happens here is the
// process-local cache invalidation that makes it take effect immediately on
// this instance, plus the notification. Both are best-effort by design: the
// factor is already rebound, and failing the call now would tell the user their
// change failed when it did not.
func (s *Service) afterFactorChange(ctx context.Context, userID int32, currentSID int64, priorSessions []domain.RefreshToken, factor, previousEmail string) {
	// Mirrors the revocation already committed by ConsumeAndRebind into this
	// process's positive session cache.
	//
	// priorSessions is a snapshot taken BEFORE the transaction on purpose:
	// ListActive filters on revoked_at IS NULL, so asking again here would
	// return only the surviving session and the loop would silently blacklist
	// nothing — leaving a stolen session that is warm in the cache passing the
	// middleware for the rest of its access token's life.
	for _, t := range priorSessions {
		if t.ID != currentSID {
			s.blacklistSession(t.ID)
		}
	}

	// Email is the only channel that can reach the *former* owner: the phone
	// provider sends codes, not messages, and after a phone rebind the old
	// number is no longer on the account anyway. A phone-only account
	// therefore gets no warning — the re-auth gate is what protects it.
	if previousEmail == "" || s.notifier == nil {
		return
	}
	if err := s.notifier.NotifyFactorChanged(ctx, userID, previousEmail, factor); err != nil {
		log.Printf("auth: failed to queue %s-change notice for user %d: %v", factor, userID, err)
	}
}

func New(
	users domain.UserRepository,
	codes domain.AuthCodeRepository,
	refresh domain.RefreshTokenRepository,
	cfg Config,
) *Service {
	return &Service{
		users:            users,
		codes:            codes,
		refresh:          refresh,
		phoneCaller:      cfg.PhoneCaller,
		phoneChallenges:  cfg.PhoneChallenges,
		reauthChallenges: cfg.ReauthChallenges,
		tm:               NewTokenManager(cfg.Secret, cfg.AccessTTL),
		accessTTL:        cfg.AccessTTL,
		refreshTTL:       cfg.RefreshTTL,
		exposeCode:       cfg.ExposeCode,
		now:              time.Now,
		storage:          cfg.Storage,
		imageModerator:   cfg.ImageModerator,

		notifier:     cfg.Notifier,
		dadataAPIKey: cfg.DadataAPIKey,
	}
}

// SetGuestRequestsLinkedHook registers the callback fired after guest
// requests are linked to a verified user (booking.Service.HandleGuestRequestsLinked).
// Setter injection because the booking service is constructed after auth.
func (s *Service) SetGuestRequestsLinkedHook(fn func(ctx context.Context, requestIDs []int32)) {
	s.onGuestRequestsLinked = fn
}

// TokenManager exposes the access-token parser for HTTP middleware.
func (s *Service) TokenManager() *TokenManager { return s.tm }
func (s *Service) ExposeCode() bool            { return s.exposeCode }

// RequestCodeResult reports the outcome of requesting an email login code.
type RequestCodeResult struct {
	ExpiresIn         int64  // seconds until the code expires
	Code              string // populated only when ExposeCode is enabled (dev)
	Exposed           bool
	ChallengeID       string
	DeliveryMode      string
	CodeLength        int32
	RetryAfter        int64
	FallbackAvailable bool
	Reused            bool
}

// AuthResult is a freshly issued token pair plus the authenticated user.
type AuthResult struct {
	User         domain.User
	AccessToken  string
	RefreshToken string
	ExpiresIn    int64 // access token lifetime in seconds
}

// RequestLoginCode sends a code only when the email is already linked to an
// account. Registration is available exclusively through a phone number.
func (s *Service) RequestLoginCode(ctx context.Context, emailRaw string) (RequestCodeResult, error) {
	email, err := normalizeEmail(emailRaw)
	if err != nil {
		return RequestCodeResult{}, err
	}
	if _, err := s.users.GetByEmail(ctx, email); err != nil {
		if errors.Is(err, domain.ErrNotFound) {
			return RequestCodeResult{}, domain.ErrEmailAccountNotFound
		}
		return RequestCodeResult{}, err
	}
	return s.RequestCode(ctx, email)
}

// RequestCode generates and stores a hashed 6-digit code. Internal factor
// change flows intentionally use it for an address not linked to the account
// yet; public email login must go through RequestLoginCode instead.
func (s *Service) RequestCode(ctx context.Context, emailRaw string) (RequestCodeResult, error) {
	return s.requestEmailCode(ctx, "email", emailRaw)
}

// RequestAdminCode issues an OTP scoped exclusively to the operator surface.
// Keeping it in a separate auth_code channel prevents a code requested for the
// admin panel from being replayed against ordinary application login.
func (s *Service) RequestAdminCode(ctx context.Context, emailRaw string) (RequestCodeResult, error) {
	return s.requestEmailCode(ctx, adminEmailCodeChannel, emailRaw)
}

func (s *Service) requestEmailCode(ctx context.Context, channel, emailRaw string) (RequestCodeResult, error) {
	email, err := normalizeEmail(emailRaw)
	if err != nil {
		return RequestCodeResult{}, err
	}

	// Throttle: reject if a code was issued for this email within the cooldown.
	// This prevents invalidating a victim's pending code and flooding their inbox.
	// Bypassed in dev (exposeCode=true) so developers can test quickly.
	if !s.exposeCode {
		switch existing, err := s.codes.Get(ctx, channel, email); {
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
	authCode := domain.AuthCode{
		Channel:   channel,
		Target:    email,
		CodeHash:  string(hash),
		ExpiresAt: expiresAt,
		CreatedAt: s.now(),
	}
	if err := s.codes.Upsert(ctx, authCode); err != nil {
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

	// Log the email code only in dev so it can be retrieved locally.
	// Gated by exposeCode so the plaintext code never reaches production logs.
	if s.exposeCode {
		log.Printf("auth: login code for %s is %s (expires %s)", maskEmail(email), code, expiresAt.Format(time.RFC3339))
	}

	res := RequestCodeResult{ExpiresIn: int64(codeTTL.Seconds())}
	if s.exposeCode {
		res.Code = code
		res.Exposed = true
	}
	return res, nil
}

// VerifyCode checks the code for an existing account and issues a token pair.
func (s *Service) VerifyCode(ctx context.Context, emailRaw, code string, info domain.DeviceInfo) (AuthResult, error) {
	email, err := normalizeEmail(emailRaw)
	if err != nil {
		return AuthResult{}, err
	}
	code = strings.TrimSpace(code)

	// Spend the attempt before comparing — see verifyPhoneChallenge for why the
	// read-compare-increment shape is unsafe under concurrency.
	rec, err := s.codes.ConsumeAttempt(ctx, "email", email, maxAttempts)
	if err != nil {
		if errors.Is(err, domain.ErrNotFound) {
			return AuthResult{}, domain.ErrCodeInvalid
		}
		return AuthResult{}, err
	}
	if s.now().After(rec.ExpiresAt) {
		_ = s.codes.Delete(ctx, "email", email)
		return AuthResult{}, domain.ErrCodeExpired
	}
	if bcrypt.CompareHashAndPassword([]byte(rec.CodeHash), []byte(code)) != nil {
		return AuthResult{}, domain.ErrCodeInvalid
	}

	// Code is valid: consume it, then resolve the existing account. Keep this
	// check even though RequestCode already performs it: an old code or a race
	// with account deletion must never turn email login back into registration.
	_ = s.codes.Delete(ctx, "email", email)

	user, err := s.users.GetByEmail(ctx, email)
	if errors.Is(err, domain.ErrNotFound) {
		return AuthResult{}, domain.ErrEmailAccountNotFound
	}
	if err != nil {
		return AuthResult{}, err
	}

	// Link guest requests and change their status to in_progress. For each
	// linked request the booking hook notifies the listing owner (email +
	// chat card) — this is the first moment the guest has a user account.
	linkedIDs, err := s.users.LinkGuestRequests(ctx, user.ID, email)
	if err != nil {
		log.Printf("auth: failed to link guest requests for user %d (email %s): %v", user.ID, maskEmail(email), err)
	} else if len(linkedIDs) > 0 && s.onGuestRequestsLinked != nil {
		// Detached context: notifications must not be cut off when the HTTP
		// request context is cancelled after the response.
		go s.onGuestRequestsLinked(context.Background(), linkedIDs)
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
	cleanAvatarURL := trimPtr(avatarURL)
	oldAvatarURL := ""
	var avatarSeal *media.SealedObject
	if cleanAvatarURL != nil {
		oldUser, err := s.users.GetByID(ctx, id)
		if err != nil {
			return domain.User{}, err
		}
		oldAvatarURL = oldUser.AvatarURL
		if *cleanAvatarURL != "" && *cleanAvatarURL != oldAvatarURL {
			if !media.IsOwnedKey(*cleanAvatarURL, "avatars", id) {
				return domain.User{}, domain.ErrUnsafeImage
			}
			sealed, err := media.SealOwnedObject(
				ctx,
				s.storage,
				*cleanAvatarURL,
				"avatars",
				"avatars",
				id,
				5*1024*1024,
				map[string]bool{"image/jpeg": true, "image/png": true, "image/webp": true},
			)
			if err != nil {
				return domain.User{}, fmt.Errorf("%w: %v", domain.ErrImageModerationUnavailable, err)
			}
			avatarSeal = &sealed
			*cleanAvatarURL = sealed.Key
			if err := s.moderateAvatar(ctx, id, sealed.Key); err != nil {
				if sealed.Created {
					_ = s.storage.Delete(ctx, sealed.Key)
					_ = s.storage.Delete(ctx, sealed.SourceKey)
				}
				return domain.User{}, err
			}
		}
	}

	u, err := s.users.UpdateProfile(ctx, id, trimPtr(name), trimPtr(surname), trimPtr(patronymic), trimPtr(phone), trimPtr(city), cleanAvatarURL, birthday, vkID, vkIDDoNull)
	if err != nil {
		if avatarSeal != nil && avatarSeal.Created {
			_ = s.storage.Delete(ctx, avatarSeal.Key)
		}
		return domain.User{}, err
	}
	if avatarSeal != nil && avatarSeal.Created {
		if err := s.storage.Delete(ctx, avatarSeal.SourceKey); err != nil {
			log.Printf("auth update profile: delete sealed avatar source for user %d: %v", id, err)
		}
	}
	if cleanAvatarURL != nil && oldAvatarURL != *cleanAvatarURL && s.storage != nil && media.IsOwnedKey(oldAvatarURL, "avatars", id) {
		if err := s.storage.Delete(ctx, oldAvatarURL); err != nil {
			log.Printf("auth update profile: delete replaced avatar for user %d: %v", id, err)
		}
	}
	return s.formatUserAvatar(u), nil
}

func (s *Service) moderateAvatar(ctx context.Context, userID int32, key string) error {
	if s.storage == nil || s.imageModerator == nil {
		return nil
	}
	if !media.IsOwnedKey(key, "avatars", userID) {
		return domain.ErrUnsafeImage
	}
	info, err := s.storage.StatObject(ctx, key)
	if err != nil {
		return fmt.Errorf("verify avatar: %w", err)
	}
	contentType := strings.ToLower(strings.TrimSpace(info.ContentType))
	if info.SizeBytes <= 0 || info.SizeBytes > 5*1024*1024 || (contentType != "image/jpeg" && contentType != "image/png" && contentType != "image/webp") {
		return domain.ErrUnsafeImage
	}
	result, err := imagemoderation.ModerateStoredImages(ctx, s.imageModerator, s.storage, []string{key}, "avatar", 5*1024*1024)
	if err != nil {
		log.Printf("auth avatar moderation: check failed for user %d: %v", userID, err)
		return err
	}
	if result.Decision != domain.ImageModerationApprove {
		log.Printf("auth avatar moderation: rejected avatar for user %d (category=%s)", userID, result.Category)
		return &domain.UnsafeImageError{
			Decision: result.Decision,
			Category: result.Category,
			Reason:   result.Reason,
		}
	}
	return nil
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

	rec, err := s.codes.ConsumeAttempt(ctx, "email", email, maxAttempts)
	if err != nil {
		if errors.Is(err, domain.ErrNotFound) {
			return domain.ErrCodeInvalid
		}
		return err
	}
	if s.now().After(rec.ExpiresAt) {
		_ = s.codes.Delete(ctx, "email", email)
		return domain.ErrCodeExpired
	}
	if bcrypt.CompareHashAndPassword([]byte(rec.CodeHash), []byte(code)) != nil {
		return domain.ErrCodeInvalid
	}

	_ = s.codes.Delete(ctx, "email", email)

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

// NormalizeEmail exposes the address normalization the service uses for
// auth-code lookups. Callers outside the package (rate limiters above all) must
// key on exactly the value the service stores: `"Name" <a@b.com>` and
// `a@b.com` hit one auth_code row, so keying a limiter on the raw input would
// hand out a fresh budget per spelling.
func NormalizeEmail(raw string) (string, error) {
	return normalizeEmail(raw)
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

func (s *Service) RequestNewEmailCode(ctx context.Context, userID int32, oldToken, newEmailRaw string) (RequestCodeResult, error) {
	if _, err := s.users.GetByID(ctx, userID); err != nil {
		return RequestCodeResult{}, err
	}

	// Unconditional. This check used to be skipped when user.Email was empty,
	// which handed every phone-only account a free email rebind to anyone
	// holding an access token — and made the "request-old / verify-old" pair
	// decorative for exactly the accounts that had no second factor to fall
	// back on.
	if err := s.requireReauth(ctx, userID, domain.ReauthPurposeChangeEmail, oldToken); err != nil {
		return RequestCodeResult{}, err
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

func (s *Service) ConfirmEmailChange(ctx context.Context, userID int32, sessionID int64, newEmailRaw, code, reauthTok string) (domain.User, error) {
	user, err := s.users.GetByID(ctx, userID)
	if err != nil {
		return domain.User{}, err
	}

	// Unconditional, and re-checked here rather than only at request time: the
	// proof must still be live at the moment the account actually changes
	// hands, not merely when the flow started.
	if err := s.requireReauth(ctx, userID, domain.ReauthPurposeChangeEmail, reauthTok); err != nil {
		return domain.User{}, err
	}

	newEmail, err := normalizeEmail(newEmailRaw)
	if err != nil {
		return domain.User{}, err
	}

	if err := s.consumeEmailCode(ctx, newEmail, code); err != nil {
		return domain.User{}, err
	}

	previousEmail := user.Email
	// Snapshot before the rebind: afterwards these rows are revoked and would no
	// longer be listed.
	priorSessions, err := s.refresh.ListActive(ctx, userID)
	if err != nil {
		log.Printf("auth: failed to snapshot sessions for user %d before email change: %v", userID, err)
	}

	// One transaction: lock the account, re-check the factor, spend the proof,
	// rebind, revoke other sessions. Spending the proof in its own statement and
	// updating separately would mean a failed update leaves the proof burned and
	// the email unchanged.
	if err := s.rebindWithProof(ctx, domain.ReauthRebind{
		UserID:           userID,
		Purpose:          domain.ReauthPurposeChangeEmail,
		Now:              s.now(),
		CurrentSessionID: sessionID,
		Email:            &newEmail,
	}, reauthTok); err != nil {
		return domain.User{}, err
	}

	// The change has committed. A failure re-reading the account is a display
	// problem, not a failed change — returning an error here would tell the user
	// their email did not change when it did, and would skip the notification.
	u, err := s.users.GetByID(ctx, userID)
	if err != nil {
		log.Printf("auth: failed to reload user %d after email change: %v", userID, err)
		u = user
		u.Email = newEmail
	}

	s.afterFactorChange(ctx, userID, sessionID, priorSessions, ReauthFactorEmail, previousEmail)
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

// InvalidateSessions mirrors session revocation already committed by another
// use case into this API process' in-memory validator. The database remains
// authoritative; this prevents a cached access token from surviving an
// operator account suspension until its normal cache expiry.
func (s *Service) InvalidateSessions(sessionIDs []int64) {
	for _, sessionID := range sessionIDs {
		if sessionID > 0 {
			s.blacklistSession(sessionID)
		}
	}
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

func generateUUID() (string, error) {
	b := make([]byte, 16)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	b[6] = (b[6] & 0x0f) | 0x40
	b[8] = (b[8] & 0x3f) | 0x80
	return fmt.Sprintf("%x-%x-%x-%x-%x", b[0:4], b[4:6], b[6:8], b[8:10], b[10:16]), nil
}

func generateNumericCode(length int) (string, error) {
	limit := new(big.Int).Exp(big.NewInt(10), big.NewInt(int64(length)), nil)
	n, err := rand.Int(rand.Reader, limit)
	if err != nil {
		return "", err
	}
	return fmt.Sprintf("%0*d", length, n.Int64()), nil
}

func phoneChallengeResult(c domain.PhoneChallenge, reused bool) RequestCodeResult {
	retry := int64(time.Until(c.UpdatedAt.Add(resendCooldown)).Seconds())
	if retry < 0 {
		retry = 0
	}
	return RequestCodeResult{ExpiresIn: int64(time.Until(c.ExpiresAt).Seconds()), ChallengeID: c.ID,
		DeliveryMode: c.DeliveryMode, CodeLength: c.CodeLength, RetryAfter: retry,
		FallbackAvailable: c.DeliveryMode == domain.PhoneDeliveryModeFlashCall, Reused: reused}
}

// StartPhoneChallengeReaper releases provider calls that never produced a
// response. ReapStale is also called synchronously before every request.
func (s *Service) StartPhoneChallengeReaper(ctx context.Context, interval time.Duration) {
	if s.phoneChallenges == nil {
		return
	}
	go func() {
		defer observability.RecoverAndRepanic(ctx)
		ticker := time.NewTicker(interval)
		defer ticker.Stop()
		for {
			select {
			case <-ctx.Done():
				return
			case now := <-ticker.C:
				if err := s.phoneChallenges.ReapStale(context.Background(), now); err != nil {
					log.Printf("phone challenge reaper: %v", err)
					observability.CaptureException(ctx, err)
				}
				if s.reauthChallenges == nil {
					continue
				}
				// Spent and expired proofs are kept for a grace period so an
				// operator investigating a takeover still has the trail, then
				// dropped — otherwise the table only ever grows.
				if err := s.reauthChallenges.DeleteExpired(context.Background(), now.Add(-reauthRetention)); err != nil {
					log.Printf("reauth challenge reaper: %v", err)
					observability.CaptureException(ctx, err)
				}
			}
		}
	}()
}

// reauthRetention is how long an unusable proof row survives past its expiry,
// purely so a takeover investigation can see it.
const reauthRetention = 7 * 24 * time.Hour

// RequestPhoneCode starts Flash Call by default. Legacy voice channel values
// are accepted but mapped to Flash Call.
func (s *Service) RequestPhoneCode(ctx context.Context, rawPhone, channel string) (RequestCodeResult, error) {
	phone, err := NormalizePhone(rawPhone)
	if err != nil {
		return RequestCodeResult{}, err
	}
	return s.requestPhoneChallenge(ctx, phone, domain.PhoneChallengePurposeLogin, nil)
}

func (s *Service) requestPhoneChallenge(ctx context.Context, phone, purpose string, userID *int32) (RequestCodeResult, error) {
	if s.phoneChallenges == nil || s.phoneCaller == nil {
		return RequestCodeResult{}, errors.New("phone verification is not configured")
	}
	now := s.now()
	if err := s.phoneChallenges.ReapStale(ctx, now); err != nil {
		return RequestCodeResult{}, err
	}

	active, err := s.phoneChallenges.GetActive(ctx, phone, purpose)
	if err == nil {
		if active.Status == domain.PhoneChallengeStatusReady {
			if now.Before(active.UpdatedAt.Add(resendCooldown)) {
				return phoneChallengeResult(active, true), nil
			}
			idempotencyID, err := generateUUID()
			if err != nil {
				return RequestCodeResult{}, err
			}
			pendingUntil := now.Add(phonePendingTTL)
			delivery, err := s.phoneChallenges.BeginDelivery(ctx, active.ID, "ucaller", domain.PhoneDeliveryModeFlashCall, idempotencyID, pendingUntil)
			if err != nil {
				return RequestCodeResult{}, err
			}
			return s.completePhoneCall(ctx, active, delivery, false)
		}
		delivery, err := s.phoneChallenges.GetPendingDelivery(ctx, active.ID)
		if err != nil {
			return RequestCodeResult{}, err
		}
		return s.completePhoneCall(ctx, active, delivery, true)
	}
	if !errors.Is(err, domain.ErrNotFound) {
		return RequestCodeResult{}, err
	}

	challengeID, err := generateUUID()
	if err != nil {
		return RequestCodeResult{}, err
	}
	idempotencyID, err := generateUUID()
	if err != nil {
		return RequestCodeResult{}, err
	}
	pendingUntil := now.Add(phonePendingTTL)
	c := domain.PhoneChallenge{ID: challengeID, PhoneNormalized: phone, Purpose: purpose, UserID: userID,
		CodeLength: 4, Status: domain.PhoneChallengeStatusDeliveryPending, DeliveryMode: domain.PhoneDeliveryModeFlashCall,
		PendingUntil: &pendingUntil, ExpiresAt: now.Add(codeTTL), CreatedAt: now, UpdatedAt: now}
	d := domain.PhoneChallengeDelivery{ChallengeID: challengeID, Provider: "ucaller", Mode: domain.PhoneDeliveryModeFlashCall, IdempotencyID: idempotencyID, Status: "pending"}
	if err := s.phoneChallenges.CreatePending(ctx, c, d); err != nil {
		if errors.Is(err, domain.ErrPhoneChallengeActive) {
			active, getErr := s.phoneChallenges.GetActive(ctx, phone, purpose)
			if getErr != nil {
				return RequestCodeResult{}, getErr
			}
			return phoneChallengeResult(active, true), nil
		}
		return RequestCodeResult{}, err
	}
	return s.completePhoneCall(ctx, c, d, false)
}

func (s *Service) completePhoneCall(ctx context.Context, c domain.PhoneChallenge, d domain.PhoneChallengeDelivery, reused bool) (RequestCodeResult, error) {
	requestedCode, err := generateNumericCode(4)
	if err != nil {
		return RequestCodeResult{}, err
	}
	delivery, err := s.phoneCaller.StartCall(ctx, domain.PhoneCallRequest{Phone: c.PhoneNormalized, Code: requestedCode,
		Mode: d.Mode, IdempotencyID: d.IdempotencyID, Client: "wigaj-auth"})
	if err != nil {
		var netErr net.Error
		if !errors.As(err, &netErr) || !netErr.Timeout() {
			message := err.Error()
			_ = s.phoneChallenges.MarkDeliveryFailed(ctx, c.ID, nil, &message)
		}
		return RequestCodeResult{}, fmt.Errorf("start phone call: %w", err)
	}
	// Hash the effective code returned by uCaller, never the requested value.
	hash, err := bcrypt.GenerateFromPassword([]byte(delivery.Code), bcrypt.DefaultCost)
	if err != nil {
		return RequestCodeResult{}, err
	}
	if err := s.phoneChallenges.MarkReady(ctx, c.ID, string(hash), int32(len(delivery.Code)), delivery.Mode, delivery.ProviderDeliveryID, s.now().Add(codeTTL)); err != nil {
		return RequestCodeResult{}, err
	}
	c.CodeHash = nil
	c.CodeLength = int32(len(delivery.Code))
	c.Status = domain.PhoneChallengeStatusReady
	c.DeliveryMode = delivery.Mode
	c.ExpiresAt = s.now().Add(codeTTL)
	res := phoneChallengeResult(c, reused || delivery.Reused)
	if s.exposeCode {
		res.Code, res.Exposed = delivery.Code, true
	}
	return res, nil
}

func (s *Service) RequestPhoneVoiceFallback(ctx context.Context, rawPhone, challengeID, purpose string, userID *int32) (RequestCodeResult, error) {
	phone, err := NormalizePhone(rawPhone)
	if err != nil {
		return RequestCodeResult{}, err
	}
	if s.phoneCaller == nil {
		return RequestCodeResult{}, errors.New("phone verification is not configured")
	}
	if err := s.phoneChallenges.ReapStale(ctx, s.now()); err != nil {
		return RequestCodeResult{}, err
	}
	c, err := s.phoneChallenges.GetByID(ctx, challengeID)
	if err != nil || c.PhoneNormalized != phone || c.Purpose != purpose || c.Status != domain.PhoneChallengeStatusReady {
		return RequestCodeResult{}, domain.ErrCodeInvalid
	}
	if userID != nil && (c.UserID == nil || *c.UserID != *userID) {
		return RequestCodeResult{}, domain.ErrCodeInvalid
	}
	if s.now().Before(c.UpdatedAt.Add(resendCooldown)) && !s.exposeCode {
		return RequestCodeResult{}, domain.ErrCodeRequestTooSoon
	}
	idempotencyID, err := generateUUID()
	if err != nil {
		return RequestCodeResult{}, err
	}
	pendingUntil := s.now().Add(phonePendingTTL)
	d, err := s.phoneChallenges.BeginDelivery(ctx, c.ID, "ucaller", domain.PhoneDeliveryModeVoice, idempotencyID, pendingUntil)
	if err != nil {
		return RequestCodeResult{}, err
	}
	return s.completePhoneCall(ctx, c, d, false)
}

func (s *Service) resolvePhoneChallenge(ctx context.Context, phone, purpose, challengeID string) (domain.PhoneChallenge, error) {
	var c domain.PhoneChallenge
	var err error
	if challengeID == "" || strings.HasPrefix(challengeID, "phone_") {
		c, err = s.phoneChallenges.GetActive(ctx, phone, purpose)
	} else {
		c, err = s.phoneChallenges.GetByID(ctx, challengeID)
	}
	if err != nil || c.PhoneNormalized != phone || c.Purpose != purpose {
		return domain.PhoneChallenge{}, domain.ErrCodeInvalid
	}
	return c, nil
}

func (s *Service) verifyPhoneChallenge(ctx context.Context, phone, code, purpose, challengeID string, userID *int32) (domain.PhoneChallenge, error) {
	c, err := s.resolvePhoneChallenge(ctx, phone, purpose, challengeID)
	if err != nil {
		return domain.PhoneChallenge{}, err
	}
	if userID != nil && (c.UserID == nil || *c.UserID != *userID) {
		return domain.PhoneChallenge{}, domain.ErrCodeInvalid
	}
	// Spend the attempt BEFORE comparing, in one atomic statement. Everything
	// below this line — the length check, the bcrypt compare — is reachable at
	// most maxAttempts times per challenge no matter how many requests arrive
	// in parallel.
	//
	// Status, code presence and expiry are deliberately NOT re-checked here
	// against the snapshot read above: ConsumeAttempt evaluates all of them
	// against the stored row inside the same statement, so there is one place
	// that decides whether a try is allowed and one set of errors it can
	// produce. Re-checking here would reintroduce a read-then-act window and
	// make the reported error depend on which goroutine won the race.
	challengeRowID := c.ID
	c, err = s.phoneChallenges.ConsumeAttempt(ctx, challengeRowID, maxAttempts, s.now())
	if err != nil {
		if errors.Is(err, domain.ErrCodeExpired) {
			_ = s.phoneChallenges.MarkExpired(ctx, challengeRowID)
		}
		return domain.PhoneChallenge{}, err
	}

	code = strings.TrimSpace(code)
	if c.CodeHash == nil || len(code) != int(c.CodeLength) || bcrypt.CompareHashAndPassword([]byte(*c.CodeHash), []byte(code)) != nil {
		// c.Attempts already includes the attempt just spent.
		if c.Attempts >= maxAttempts {
			_ = s.phoneChallenges.MarkExpired(ctx, c.ID)
		}
		return domain.PhoneChallenge{}, domain.ErrCodeInvalid
	}
	return c, nil
}

func (s *Service) VerifyPhoneCode(ctx context.Context, rawPhone, code, challengeID string, info domain.DeviceInfo) (AuthResult, error) {
	phone, err := NormalizePhone(rawPhone)
	if err != nil {
		return AuthResult{}, err
	}
	c, err := s.verifyPhoneChallenge(ctx, phone, code, domain.PhoneChallengePurposeLogin, challengeID, nil)
	if err != nil {
		return AuthResult{}, err
	}
	user, err := s.users.GetByPhone(ctx, phone)
	if errors.Is(err, domain.ErrNotFound) {
		user, err = s.users.CreateWithPhone(ctx, phone)
	}
	if err != nil {
		return AuthResult{}, err
	}
	if err = s.phoneChallenges.MarkVerified(ctx, c.ID); err != nil {
		return AuthResult{}, err
	}
	linkedIDs, linkErr := s.users.LinkGuestRequestsByPhone(ctx, user.ID, phone)
	if linkErr == nil && len(linkedIDs) > 0 && s.onGuestRequestsLinked != nil {
		go s.onGuestRequestsLinked(context.Background(), linkedIDs)
	}
	return s.issueTokens(ctx, user, info)
}

func (s *Service) RequestChangePhoneCode(ctx context.Context, userID int32, rawPhone, channel, reauthTok string) (RequestCodeResult, error) {
	if _, err := s.users.GetByID(ctx, userID); err != nil {
		return RequestCodeResult{}, err
	}

	// The gate. Previously the only check on this path was "is the access
	// token valid", so a single stolen token bought a permanent, irreversible
	// takeover: rebind the phone, then log in forever through the
	// unauthenticated /auth/phone/verify, surviving token expiry, refresh
	// rotation and "log out everywhere". For a phone-only account the real
	// owner never gets back in.
	if err := s.requireReauth(ctx, userID, domain.ReauthPurposeChangePhone, reauthTok); err != nil {
		return RequestCodeResult{}, err
	}

	phone, err := NormalizePhone(rawPhone)
	if err != nil {
		return RequestCodeResult{}, err
	}
	existing, err := s.users.GetByPhone(ctx, phone)
	if err == nil && existing.ID != userID {
		return RequestCodeResult{}, domain.ErrPhoneTaken
	}
	if err == nil && existing.PhoneVerifiedAt != nil {
		return RequestCodeResult{}, domain.ErrPhoneAlreadyLinked
	}
	if err != nil && !errors.Is(err, domain.ErrNotFound) {
		return RequestCodeResult{}, err
	}
	return s.requestPhoneChallenge(ctx, phone, domain.PhoneChallengePurposeChangePhone, &userID)
}

func (s *Service) ConfirmPhoneChange(ctx context.Context, userID int32, sessionID int64, rawPhone, code, challengeID, reauthTok string) (domain.User, error) {
	// Re-checked at confirm as well as at request: the proof must still be
	// live when the account actually changes hands.
	if err := s.requireReauth(ctx, userID, domain.ReauthPurposeChangePhone, reauthTok); err != nil {
		return domain.User{}, err
	}
	previous, err := s.users.GetByID(ctx, userID)
	if err != nil {
		return domain.User{}, err
	}
	phone, err := NormalizePhone(rawPhone)
	if err != nil {
		return domain.User{}, err
	}
	c, err := s.verifyPhoneChallenge(ctx, phone, code, domain.PhoneChallengePurposeChangePhone, challengeID, &userID)
	if err != nil {
		return domain.User{}, err
	}
	existing, err := s.users.GetByPhone(ctx, phone)
	if err == nil && existing.ID != userID {
		return domain.User{}, domain.ErrPhoneTaken
	}
	// Snapshot before the rebind: afterwards these rows are revoked and would no
	// longer be listed.
	priorSessions, listErr := s.refresh.ListActive(ctx, userID)
	if listErr != nil {
		log.Printf("auth: failed to snapshot sessions for user %d before phone change: %v", userID, listErr)
	}

	// One transaction: lock the account, re-check the factor, spend the proof,
	// rebind, revoke other sessions.
	//
	// Spending here rather than at the top of the function matters too:
	// everything above can legitimately fail (a mistyped code, a number taken in
	// the meantime), and burning the proof on those would cost the user a whole
	// re-authentication — another billable call — for one typo.
	now := s.now()
	if err := s.rebindWithProof(ctx, domain.ReauthRebind{
		UserID:           userID,
		Purpose:          domain.ReauthPurposeChangePhone,
		Now:              now,
		CurrentSessionID: sessionID,
		Phone: &domain.ReauthRebindPhone{
			Raw:        rawPhone,
			Normalized: phone,
			VerifiedAt: now,
		},
	}, reauthTok); err != nil {
		return domain.User{}, err
	}
	// Committed. A failed re-read is a display problem, not a failed change.
	updatedUser, err := s.users.GetByID(ctx, userID)
	if err != nil {
		log.Printf("auth: failed to reload user %d after phone change: %v", userID, err)
		updatedUser = previous
		updatedUser.Phone, updatedUser.PhoneNormalized = rawPhone, phone
		updatedUser.PhoneVerifiedAt = &now
	}
	// Past this point the rebind has landed. Burning the challenge is
	// bookkeeping — the code was already consumed and cannot be replayed — so a
	// failure here is logged, not returned: telling the user their change failed
	// when their phone has in fact changed is the worse outcome.
	if err = s.phoneChallenges.MarkVerified(ctx, c.ID); err != nil {
		log.Printf("auth: failed to mark phone challenge %s verified after rebind for user %d: %v", c.ID, userID, err)
	}
	s.afterFactorChange(ctx, userID, sessionID, priorSessions, ReauthFactorPhone, previous.Email)
	linkedIDs, linkErr := s.users.LinkGuestRequestsByPhone(ctx, userID, phone)
	if linkErr == nil && len(linkedIDs) > 0 && s.onGuestRequestsLinked != nil {
		go s.onGuestRequestsLinked(context.Background(), linkedIDs)
	}
	return updatedUser, nil
}
