package payment

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/TrollLOLik/sutki/backend/internal/domain"
	provider "github.com/TrollLOLik/sutki/backend/internal/infrastructure/payment"
)

type webhookRepoStub struct {
	appliedStatus string
	enqueued      map[string]bool
	changed       bool
}

func (r *webhookRepoStub) ListProducts(context.Context) ([]domain.PaymentProduct, error) {
	panic("unused")
}
func (r *webhookRepoStub) GetProduct(context.Context, string) (domain.PaymentProduct, error) {
	panic("unused")
}
func (r *webhookRepoStub) ReservePayment(context.Context, int32, domain.PaymentProduct, string, string, map[string]string, domain.Receipt) (domain.Payment, error) {
	panic("unused")
}
func (r *webhookRepoStub) AttachProviderPayment(context.Context, int64, domain.ProviderPayment) (domain.Payment, error) {
	panic("unused")
}
func (r *webhookRepoStub) GetPaymentForUser(context.Context, int64, int32) (domain.Payment, error) {
	panic("unused")
}
func (r *webhookRepoStub) GetPaymentByProviderID(context.Context, string) (domain.Payment, error) {
	panic("unused")
}
func (r *webhookRepoStub) ApplyVerifiedPayment(_ context.Context, p domain.ProviderPayment) (domain.Payment, bool, error) {
	r.appliedStatus = p.Status
	return domain.Payment{ID: 1, Status: p.Status}, r.changed, nil
}

type activationStub struct{ calls int }

func (a *activationStub) PaymentStatusChanged(context.Context, domain.Payment) error {
	a.calls++
	return nil
}
func (r *webhookRepoStub) GetPaymentReceipt(context.Context, int64) (domain.Receipt, error) {
	panic("unused")
}
func (r *webhookRepoStub) EnqueueWebhook(_ context.Context, provider string, e domain.ProviderWebhook) (bool, error) {
	if r.enqueued == nil {
		r.enqueued = map[string]bool{}
	}
	k := provider + e.Event + e.ObjectID
	if r.enqueued[k] {
		return false, nil
	}
	r.enqueued[k] = true
	return true, nil
}
func (r *webhookRepoStub) DueWebhookBatch(context.Context, int32) ([]domain.PaymentWebhookEvent, error) {
	panic("unused")
}
func (r *webhookRepoStub) MarkWebhookDone(context.Context, int64) error { return nil }
func (r *webhookRepoStub) MarkWebhookRetry(context.Context, int64, string, time.Time) error {
	return nil
}
func (r *webhookRepoStub) MarkWebhookFailed(context.Context, int64, string) error { return nil }
func (r *webhookRepoStub) ReserveRefund(context.Context, domain.Payment, int32, string, int32, string, domain.Receipt) (domain.PaymentRefund, error) {
	panic("unused")
}
func (r *webhookRepoStub) AttachProviderRefund(context.Context, int64, domain.ProviderRefund) (domain.PaymentRefund, error) {
	panic("unused")
}
func (r *webhookRepoStub) ApplyVerifiedRefund(context.Context, domain.ProviderRefund) (domain.PaymentRefund, bool, error) {
	panic("unused")
}

func TestWebhookUsesServerStateNotClaimedPayload(t *testing.T) {
	p := provider.NewMockProvider()
	created, err := p.CreatePayment(context.Background(), domain.ProviderCreatePayment{IdempotencyKey: "x", Money: domain.Money{AmountKopecks: 100, Currency: "RUB"}})
	if err != nil {
		t.Fatal(err)
	}
	repo := &webhookRepoStub{changed: true}
	svc := New(repo, nil, p, nil, Config{})
	forged := []byte(`{"type":"notification","event":"payment.succeeded","object":{"id":"` + created.ID + `","status":"succeeded","paid":true}}`)
	event, _ := p.ParseWebhook(forged)
	err = svc.processEvent(context.Background(), domain.PaymentWebhookEvent{ID: 1, Provider: "mock", EventType: event.Event, ProviderObjectID: event.ObjectID, Payload: forged})
	if !errors.Is(err, domain.ErrWebhookStateMismatch) {
		t.Fatalf("expected state mismatch, got %v", err)
	}
	if repo.appliedStatus != "" {
		t.Fatalf("forged webhook reached local payment update: %s", repo.appliedStatus)
	}
}

func TestTerminalWebhookRetriesBusinessActivationAfterPaymentWasAlreadyApplied(t *testing.T) {
	p := provider.NewMockProvider()
	created, err := p.CreatePayment(context.Background(), domain.ProviderCreatePayment{IdempotencyKey: "activation-retry", Money: domain.Money{AmountKopecks: 100, Currency: "RUB"}})
	if err != nil {
		t.Fatal(err)
	}
	body, err := p.SetPaymentStatus(created.ID, domain.PaymentStatusSucceeded)
	if err != nil {
		t.Fatal(err)
	}
	event, err := p.ParseWebhook(body)
	if err != nil {
		t.Fatal(err)
	}
	repo := &webhookRepoStub{changed: false}
	activator := &activationStub{}
	svc := New(repo, nil, p, activator, Config{})
	err = svc.processEvent(context.Background(), domain.PaymentWebhookEvent{ID: 2, Provider: "mock", EventType: event.Event, ProviderObjectID: event.ObjectID, Payload: body})
	if err != nil {
		t.Fatal(err)
	}
	if activator.calls != 1 {
		t.Fatalf("expected activation retry, got %d calls", activator.calls)
	}
}

func TestWebhookReplayIsDeduplicated(t *testing.T) {
	p := provider.NewMockProvider()
	repo := &webhookRepoStub{}
	svc := New(repo, nil, p, nil, Config{})
	body := []byte(`{"type":"notification","event":"payment.succeeded","object":{"id":"p1"}}`)
	first, err := svc.AcceptWebhook(context.Background(), body)
	if err != nil {
		t.Fatal(err)
	}
	second, err := svc.AcceptWebhook(context.Background(), body)
	if err != nil {
		t.Fatal(err)
	}
	if !first || second {
		t.Fatalf("replay result first=%v second=%v", first, second)
	}
}

func TestReceiptCustomerUsesNormalizedPhoneForPhoneOnlyUser(t *testing.T) {
	customer, err := receiptCustomer(domain.User{PhoneNormalized: "+7 999 123-45-67"})
	if err != nil {
		t.Fatal(err)
	}
	if customer.Email != "" || customer.Phone != "79991234567" {
		t.Fatalf("unexpected receipt customer: %+v", customer)
	}
}

func TestReceiptCustomerRejectsInvalidPhoneWithoutEmail(t *testing.T) {
	if _, err := receiptCustomer(domain.User{PhoneNormalized: "+7999"}); err == nil {
		t.Fatal("expected invalid fiscal contact error")
	}
}

func TestAdminTokenRotationAcceptsActiveAndPrevious(t *testing.T) {
	svc := New(&webhookRepoStub{}, nil, provider.NewMockProvider(), nil, Config{AdminToken: "new-token", AdminTokenPrevious: "old-token"})
	if !svc.AdminAuthorized("new-token") || !svc.AdminAuthorized("old-token") || svc.AdminAuthorized("wrong") {
		t.Fatal("admin token rotation window is incorrect")
	}
}
