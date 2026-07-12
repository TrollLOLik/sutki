package domain

import (
	"context"
	"encoding/json"
	"errors"
	"time"
)

const (
	PaymentStatusPending           = "pending"
	PaymentStatusWaitingForCapture = "waiting_for_capture"
	PaymentStatusSucceeded         = "succeeded"
	PaymentStatusCanceled          = "canceled"

	RefundStatusPending   = "pending"
	RefundStatusSucceeded = "succeeded"
	RefundStatusCanceled  = "canceled"
)

var (
	ErrPaymentNotFound       = errors.New("payment not found")
	ErrPaymentConflict       = errors.New("payment conflict")
	ErrPaymentNotRefundable  = errors.New("payment is not refundable")
	ErrInvalidWebhook        = errors.New("invalid payment webhook")
	ErrPaymentProviderFailed = errors.New("payment provider failed")
	ErrWebhookStateMismatch  = errors.New("payment webhook state mismatch")
)

type Money struct {
	AmountKopecks int32
	Currency      string
}

type ReceiptCustomer struct {
	Email string `json:"email,omitempty"`
	Phone string `json:"phone,omitempty"`
}

type ReceiptItem struct {
	Description    string `json:"description"`
	Quantity       string `json:"quantity"`
	AmountKopecks  int32  `json:"amount_kopecks"`
	Currency       string `json:"currency"`
	VATCode        int16  `json:"vat_code"`
	PaymentSubject string `json:"payment_subject"`
	PaymentMode    string `json:"payment_mode"`
}

type Receipt struct {
	Customer ReceiptCustomer `json:"customer"`
	Items    []ReceiptItem   `json:"items"`
}

type ProviderCreatePayment struct {
	IdempotencyKey string
	Money          Money
	Capture        bool
	ReturnURL      string
	Description    string
	Metadata       map[string]string
	Receipt        *Receipt
}

type ProviderPayment struct {
	ID                  string
	Status              string
	Paid                bool
	Money               Money
	ConfirmationURL     string
	Metadata            map[string]string
	ReceiptRegistration string
}

type ProviderCreateRefund struct {
	IdempotencyKey string
	PaymentID      string
	Money          Money
	Description    string
	Receipt        *Receipt
}

type ProviderRefund struct {
	ID                  string
	PaymentID           string
	Status              string
	Money               Money
	ReceiptRegistration string
}

type ProviderWebhook struct {
	Event    string
	ObjectID string
	Raw      json.RawMessage
}

// PaymentProvider isolates provider-specific HTTP contracts. Business state
// is always driven by a server-to-server GetPayment/GetRefund result.
type PaymentProvider interface {
	Name() string
	CreatePayment(context.Context, ProviderCreatePayment) (ProviderPayment, error)
	GetPayment(context.Context, string) (ProviderPayment, error)
	CreateRefund(context.Context, ProviderCreateRefund) (ProviderRefund, error)
	GetRefund(context.Context, string) (ProviderRefund, error)
	ParseWebhook([]byte) (ProviderWebhook, error)
}

type PaymentProduct struct {
	Code            string
	Title           string
	Purpose         string
	AmountKopecks   int32
	Currency        string
	VATCode         int16
	PaymentSubject  string
	PaymentMode     string
	ServiceType     string
	DurationSeconds int32
}

type Payment struct {
	ID                    int64
	UserID                int32
	Provider              string
	ProviderPaymentID     string
	Purpose               string
	ProductCode           string
	AmountKopecks         int32
	Currency              string
	Status                string
	ConfirmationURL       string
	Description           string
	IdempotencyKey        string
	Metadata              map[string]string
	RefundedAmountKopecks int32
	CreatedAt             time.Time
	UpdatedAt             time.Time
	PaidAt                *time.Time
	CanceledAt            *time.Time
	BusinessRefType       string
	BusinessRefID         int64
}

type PaymentRefund struct {
	ID               int64
	PaymentID        int64
	ProviderRefundID string
	IdempotencyKey   string
	AmountKopecks    int32
	Currency         string
	Status           string
	Reason           string
	InitiatedBy      int32
}

type PaymentWebhookEvent struct {
	ID               int64
	Provider         string
	EventType        string
	ProviderObjectID string
	Payload          []byte
	Attempts         int32
}
