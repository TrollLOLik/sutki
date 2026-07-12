package domain

import "time"

const (
	PromotionTypeBoost      = "boost"
	PromotionTypeHighlight  = "highlight"
	PromotionPendingPayment = "pending_payment"
	PromotionActive         = "active"
	PromotionPaused         = "paused"
	PromotionExpired        = "expired"
	PromotionPaymentFailed  = "payment_failed"
	PromotionCancelled      = "cancelled"
)

type ListingPromotion struct {
	ID               int64      `json:"id"`
	HouseID          int32      `json:"house_id"`
	PurchasedBy      int32      `json:"purchased_by"`
	PaymentID        *int64     `json:"payment_id"`
	Type             string     `json:"type"`
	Status           string     `json:"status"`
	DurationSeconds  int32      `json:"duration_seconds"`
	RemainingSeconds int32      `json:"remaining_seconds"`
	StartsAt         *time.Time `json:"starts_at"`
	ExpiresAt        *time.Time `json:"expires_at"`
	ActivatedAt      *time.Time `json:"activated_at"`
	PauseReason      string     `json:"pause_reason,omitempty"`
	Version          int64      `json:"version"`
	CheckoutKey      string     `json:"-"`
	ProductCode      string     `json:"-"`
}

type PromotionExpiryJob struct {
	PromotionID int64
	Version     int64
	Attempts    int32
}
