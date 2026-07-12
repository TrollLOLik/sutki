package payment

import (
	"context"
	"crypto/sha256"
	"encoding/json"
	"fmt"
	"sync"

	"github.com/TrollLOLik/sutki/backend/internal/domain"
)

// MockProvider is deterministic and concurrency-safe. It deliberately keeps
// provider state separate from the application database, just like YooKassa.
type MockProvider struct {
	mu                      sync.Mutex
	payments                map[string]domain.ProviderPayment
	paymentIdempotency      map[string]string
	refunds                 map[string]domain.ProviderRefund
	refundIdempotency       map[string]string
	failNextCreateAfterSave bool
}

func NewMockProvider() *MockProvider {
	return &MockProvider{
		payments:           make(map[string]domain.ProviderPayment),
		paymentIdempotency: make(map[string]string),
		refunds:            make(map[string]domain.ProviderRefund),
		refundIdempotency:  make(map[string]string),
	}
}

func (m *MockProvider) Name() string { return "mock" }

func (m *MockProvider) CreatePayment(_ context.Context, in domain.ProviderCreatePayment) (domain.ProviderPayment, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	if id := m.paymentIdempotency[in.IdempotencyKey]; id != "" {
		return m.payments[id], nil
	}
	id := stableMockID("mock-payment", in.IdempotencyKey)
	p := domain.ProviderPayment{
		ID: id, Status: domain.PaymentStatusPending, Money: in.Money,
		ConfirmationURL: "https://mock-payments.local/confirm/" + id,
		Metadata:        cloneMetadata(in.Metadata),
	}
	m.payments[id] = p
	m.paymentIdempotency[in.IdempotencyKey] = id
	if m.failNextCreateAfterSave {
		m.failNextCreateAfterSave = false
		return domain.ProviderPayment{}, fmt.Errorf("mock: response lost after payment creation")
	}
	return p, nil
}

func (m *MockProvider) GetPayment(_ context.Context, id string) (domain.ProviderPayment, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	p, ok := m.payments[id]
	if !ok {
		return domain.ProviderPayment{}, domain.ErrPaymentNotFound
	}
	return p, nil
}

func (m *MockProvider) CreateRefund(_ context.Context, in domain.ProviderCreateRefund) (domain.ProviderRefund, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	if id := m.refundIdempotency[in.IdempotencyKey]; id != "" {
		return m.refunds[id], nil
	}
	p, ok := m.payments[in.PaymentID]
	if !ok || p.Status != domain.PaymentStatusSucceeded {
		return domain.ProviderRefund{}, domain.ErrPaymentNotRefundable
	}
	id := stableMockID("mock-refund", in.IdempotencyKey)
	r := domain.ProviderRefund{ID: id, PaymentID: in.PaymentID, Status: domain.RefundStatusSucceeded, Money: in.Money, ReceiptRegistration: "succeeded"}
	m.refunds[id] = r
	m.refundIdempotency[in.IdempotencyKey] = id
	return r, nil
}

func (m *MockProvider) GetRefund(_ context.Context, id string) (domain.ProviderRefund, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	r, ok := m.refunds[id]
	if !ok {
		return domain.ProviderRefund{}, domain.ErrPaymentNotFound
	}
	return r, nil
}

func (m *MockProvider) ParseWebhook(body []byte) (domain.ProviderWebhook, error) {
	var payload struct {
		Type   string `json:"type"`
		Event  string `json:"event"`
		Object struct {
			ID string `json:"id"`
		} `json:"object"`
	}
	if err := json.Unmarshal(body, &payload); err != nil || payload.Type != "notification" || payload.Event == "" || payload.Object.ID == "" {
		return domain.ProviderWebhook{}, domain.ErrInvalidWebhook
	}
	return domain.ProviderWebhook{Event: payload.Event, ObjectID: payload.Object.ID, Raw: append([]byte(nil), body...)}, nil
}

func (m *MockProvider) SetPaymentStatus(id, status string) ([]byte, error) {
	m.mu.Lock()
	p, ok := m.payments[id]
	if !ok {
		m.mu.Unlock()
		return nil, domain.ErrPaymentNotFound
	}
	if status != domain.PaymentStatusSucceeded && status != domain.PaymentStatusCanceled && status != domain.PaymentStatusWaitingForCapture {
		m.mu.Unlock()
		return nil, fmt.Errorf("unsupported mock status")
	}
	p.Status = status
	p.Paid = status == domain.PaymentStatusSucceeded
	if p.Paid {
		p.ReceiptRegistration = "succeeded"
	}
	m.payments[id] = p
	m.mu.Unlock()
	return json.Marshal(map[string]any{
		"type": "notification", "event": "payment." + status,
		"object": map[string]any{"id": id, "status": status, "paid": p.Paid},
	})
}

func (m *MockProvider) FailNextCreateAfterSave() {
	m.mu.Lock()
	m.failNextCreateAfterSave = true
	m.mu.Unlock()
}

// RestorePayment rebuilds volatile mock state from the durable local payment
// after an API process restart. Real providers keep this state remotely.
func (m *MockProvider) RestorePayment(payment domain.Payment) {
	if payment.ProviderPaymentID == "" || payment.IdempotencyKey == "" {
		return
	}
	m.mu.Lock()
	defer m.mu.Unlock()
	if _, exists := m.payments[payment.ProviderPaymentID]; exists {
		return
	}
	m.payments[payment.ProviderPaymentID] = domain.ProviderPayment{
		ID:              payment.ProviderPaymentID,
		Status:          payment.Status,
		Money:           domain.Money{AmountKopecks: payment.AmountKopecks, Currency: payment.Currency},
		ConfirmationURL: payment.ConfirmationURL,
		Metadata:        cloneMetadata(payment.Metadata),
		Paid:            payment.Status == domain.PaymentStatusSucceeded,
	}
	m.paymentIdempotency[payment.IdempotencyKey] = payment.ProviderPaymentID
}

func stableMockID(prefix, idempotencyKey string) string {
	sum := sha256.Sum256([]byte(idempotencyKey))
	return fmt.Sprintf("%s-%x", prefix, sum[:12])
}

func cloneMetadata(src map[string]string) map[string]string {
	dst := make(map[string]string, len(src))
	for k, v := range src {
		dst[k] = v
	}
	return dst
}
