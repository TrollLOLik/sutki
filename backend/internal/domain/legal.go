package domain

import (
	"context"
	"time"
)

const (
	LegalDocumentUserAgreement     = "user_agreement"
	LegalDocumentPersonalData      = "personal_data"
	LegalDocumentDataDissemination = "personal_data_dissemination"
	LegalConsentSourceWeb          = "web"
	LegalConsentSourceAndroid      = "android"
)

type LegalDocument struct {
	Type    string `json:"type"`
	Version string `json:"version"`
	SHA256  string `json:"sha256"`
}

type LegalConsent struct {
	UserID         *int32
	RegistrationID string
	Document       LegalDocument
	AcceptedAt     time.Time
	IPAddress      *string
	UserAgent      *string
	AppVersion     *string
	Source         string
}

type LegalConsentRepository interface {
	AcceptRegistration(ctx context.Context, consents []LegalConsent) error
	BindRegistration(ctx context.Context, registrationID string, userID int32) error
	AcceptForUser(ctx context.Context, consent LegalConsent) error
	HasActive(ctx context.Context, userID int32, document LegalDocument) (bool, error)
	PublicProfileVisible(ctx context.Context, userID int32) (bool, error)
	Revoke(ctx context.Context, userID int32, documentType, reason string, at time.Time) error
}

type RetentionRepository interface {
	ExpiredChatObjectKeys(ctx context.Context, cutoff time.Time) ([]string, error)
	ExpiredListingObjectKeys(ctx context.Context, cutoff time.Time) ([]string, error)
	RunRetention(ctx context.Context, now time.Time, deletedChatObjectKeys, deletedListingObjectKeys []string) (RetentionResult, error)
}

type RetentionResult struct {
	Counts map[string]int64
}
