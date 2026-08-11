package domain

import (
	"context"
	"time"
)

// User is an application account. It maps onto the legacy `user` table;
// nullable legacy columns are flattened to empty strings here.
type User struct {
	ID                   int32
	Email                string
	Name                 string
	Surname              string
	Patronymic           string
	Phone                string
	PhoneNormalized      string
	PhoneVerifiedAt      *time.Time
	City                 string
	AvatarURL            string
	IsVerified           bool
	Birthday             *time.Time
	CreatedAt            time.Time
	ListingsCount        int32
	Rating               float64
	ReviewsCount         int32
	VKID                 string
	PublicProfileVisible bool
}

// AuthCode is a short-lived, hashed passwordless code for authentication channels.
type AuthCode struct {
	Channel          string
	Target           string
	CodeHash         string
	ExpiresAt        time.Time
	Attempts         int32
	CreatedAt        time.Time
	DeliveryProvider *string
	DeliveryID       *string
	DeliveryCost     *string
}

// ReauthChallenge is a stored re-authentication attempt.
//
// The row exists from the moment the user asks for a code, not from the moment
// they enter it: Purpose and Factor are decided server-side at that point and
// read back here at verification, so the operation a code authorizes cannot be
// switched by the client between the two calls. TokenHash is set only once the
// code is verified — the proof token itself is never stored.
type ReauthChallenge struct {
	ID      int64
	UserID  int32
	Purpose string
	Factor  string
	// PhoneChallengeID pins which flash-call challenge the code must answer.
	// Nil for an email re-authentication.
	PhoneChallengeID *string
	TokenHash        *string
	VerifiedAt       *time.Time
	ExpiresAt        time.Time
	ConsumedAt       *time.Time
	CreatedAt        time.Time
}

// ReauthAttempt is the request to start re-authenticating.
type ReauthAttempt struct {
	UserID           int32
	Purpose          string
	Factor           string
	PhoneChallengeID *string
	ExpiresAt        time.Time
	Now              time.Time
}

// ReauthRebind is a factor change to apply atomically with spending its proof.
// Exactly one of Phone and Email is set.
type ReauthRebind struct {
	TokenHash        string
	UserID           int32
	Purpose          string
	Now              time.Time
	CurrentSessionID int64
	Phone            *ReauthRebindPhone
	Email            *string
}

// ReauthRebindPhone carries the new number in both the stored forms.
type ReauthRebindPhone struct {
	Raw        string
	Normalized string
	VerifiedAt time.Time
}

// What a re-authentication proof authorizes. Scoping matters: a proof minted to
// change the email must not be spendable on the phone, which is the credential
// that grants passwordless login.
const (
	ReauthPurposeChangePhone = "change_phone"
	ReauthPurposeChangeEmail = "change_email"
)

// RefreshToken is a persisted (hashed) refresh token for JWT rotation.
type RefreshToken struct {
	ID           int64
	UserID       int32
	TokenHash    string
	ExpiresAt    time.Time
	RevokedAt    *time.Time
	DeviceName   *string
	DeviceOS     *string
	AppVersion   *string
	IPAddress    *string
	Location     *string
	LastActiveAt time.Time
}

type DeviceInfo struct {
	DeviceName *string
	DeviceOS   *string
	AppVersion *string
	IPAddress  *string
	Location   *string
}

const (
	PhoneChallengePurposeLogin       = "login"
	PhoneChallengePurposeChangePhone = "change_phone"
	// PhoneChallengePurposeReauth proves the caller still controls the phone
	// already on the account, before they are allowed to rebind a login
	// factor. Kept separate from 'login' so a code minted for one purpose
	// cannot be replayed against the other, and so the partial unique index
	// on (phone_normalized, purpose) does not collide the two flows.
	PhoneChallengePurposeReauth = "reauth"

	PhoneChallengeStatusDeliveryPending = "delivery_pending"
	PhoneChallengeStatusReady           = "ready_for_verification"
	PhoneChallengeStatusVerified        = "verified"
	PhoneChallengeStatusDeliveryFailed  = "delivery_failed"
	PhoneChallengeStatusExpired         = "expired"

	PhoneDeliveryModeFlashCall = "flash_call"
	PhoneDeliveryModeVoice     = "voice"
)

// PhoneCallProvider starts a phone call and returns the code actually used by
// the provider. Callers must verify Result.Code rather than the requested code.
type PhoneCallProvider interface {
	StartCall(ctx context.Context, req PhoneCallRequest) (PhoneCallResult, error)
}

type PhoneCallRequest struct {
	Phone         string
	Code          string
	Mode          string
	IdempotencyID string
	Client        string
}

type PhoneCallResult struct {
	Provider           string
	ProviderDeliveryID string
	Code               string
	Mode               string
	Reused             bool
}

type PhoneChallenge struct {
	ID              string
	PhoneNormalized string
	Purpose         string
	UserID          *int32
	CodeHash        *string
	CodeLength      int32
	Status          string
	DeliveryMode    string
	PendingUntil    *time.Time
	ExpiresAt       time.Time
	Attempts        int32
	CreatedAt       time.Time
	UpdatedAt       time.Time
}

type PhoneChallengeDelivery struct {
	ID                 int64
	ChallengeID        string
	Provider           string
	Mode               string
	IdempotencyID      string
	ProviderDeliveryID *string
	Status             string
	ErrorCode          *string
	ErrorMessage       *string
	CreatedAt          time.Time
	UpdatedAt          time.Time
}
