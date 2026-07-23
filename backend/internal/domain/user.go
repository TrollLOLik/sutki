package domain

import (
	"context"
	"time"
)

// User is an application account. It maps onto the legacy `user` table;
// nullable legacy columns are flattened to empty strings here.
type User struct {
	ID              int32
	Email           string
	Name            string
	Surname         string
	Patronymic      string
	Phone           string
	PhoneNormalized string
	PhoneVerifiedAt *time.Time
	City            string
	AvatarURL       string
	IsVerified      bool
	Birthday        *time.Time
	CreatedAt       time.Time
	ListingsCount   int32
	Rating          float64
	VKID            string
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
