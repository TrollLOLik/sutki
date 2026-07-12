package payment

import (
	"context"
	"errors"
	"testing"

	"github.com/TrollLOLik/sutki/backend/internal/domain"
)

func TestMockCreateIsIdempotentAfterLostResponse(t *testing.T) {
	p := NewMockProvider()
	p.FailNextCreateAfterSave()
	in := domain.ProviderCreatePayment{
		IdempotencyKey: "same-key",
		Money:          domain.Money{AmountKopecks: 19900, Currency: "RUB"},
		Metadata:       map[string]string{"local_payment_id": "42"},
	}
	if _, err := p.CreatePayment(context.Background(), in); err == nil {
		t.Fatal("expected simulated lost response")
	}
	first, err := p.CreatePayment(context.Background(), in)
	if err != nil {
		t.Fatal(err)
	}
	second, err := p.CreatePayment(context.Background(), in)
	if err != nil {
		t.Fatal(err)
	}
	if first.ID != second.ID {
		t.Fatalf("idempotency created two payments: %s != %s", first.ID, second.ID)
	}
}

func TestMockPaymentIDIsStableAcrossProviderRestart(t *testing.T) {
	in := domain.ProviderCreatePayment{
		IdempotencyKey: "restart-safe-key",
		Money:          domain.Money{AmountKopecks: 14900, Currency: "RUB"},
	}
	first, err := NewMockProvider().CreatePayment(context.Background(), in)
	if err != nil {
		t.Fatal(err)
	}
	second, err := NewMockProvider().CreatePayment(context.Background(), in)
	if err != nil {
		t.Fatal(err)
	}
	if first.ID != second.ID {
		t.Fatalf("provider restart changed payment id: %s != %s", first.ID, second.ID)
	}
}

func TestMockRestoresPendingPaymentAfterProviderRestart(t *testing.T) {
	p := NewMockProvider()
	p.RestorePayment(domain.Payment{
		ProviderPaymentID: "mock-payment-restored",
		IdempotencyKey:    "restore-key",
		Status:            domain.PaymentStatusPending,
		AmountKopecks:     14900,
		Currency:          "RUB",
	})
	if _, err := p.SetPaymentStatus("mock-payment-restored", domain.PaymentStatusSucceeded); err != nil {
		t.Fatal(err)
	}
}

func TestMockRefundIsIdempotent(t *testing.T) {
	p := NewMockProvider()
	created, err := p.CreatePayment(context.Background(), domain.ProviderCreatePayment{
		IdempotencyKey: "payment", Money: domain.Money{AmountKopecks: 10000, Currency: "RUB"},
	})
	if err != nil {
		t.Fatal(err)
	}
	if _, err = p.SetPaymentStatus(created.ID, domain.PaymentStatusSucceeded); err != nil {
		t.Fatal(err)
	}
	in := domain.ProviderCreateRefund{IdempotencyKey: "refund", PaymentID: created.ID, Money: created.Money}
	first, err := p.CreateRefund(context.Background(), in)
	if err != nil {
		t.Fatal(err)
	}
	second, err := p.CreateRefund(context.Background(), in)
	if err != nil {
		t.Fatal(err)
	}
	if first.ID != second.ID {
		t.Fatalf("duplicate refund: %s != %s", first.ID, second.ID)
	}
}

func TestMockForgedWebhookCannotCreateProviderPayment(t *testing.T) {
	p := NewMockProvider()
	event, err := p.ParseWebhook([]byte(`{"type":"notification","event":"payment.succeeded","object":{"id":"forged"}}`))
	if err != nil {
		t.Fatal(err)
	}
	if _, err := p.GetPayment(context.Background(), event.ObjectID); !errors.Is(err, domain.ErrPaymentNotFound) {
		t.Fatalf("forged object unexpectedly exists: %v", err)
	}
}
