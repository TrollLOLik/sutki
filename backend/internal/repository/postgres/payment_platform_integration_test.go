package postgres_test

import (
	"context"
	"crypto/rand"
	"errors"
	"fmt"
	"os"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/TrollLOLik/sutki/backend/internal/domain"
	provider "github.com/TrollLOLik/sutki/backend/internal/infrastructure/payment"
	"github.com/TrollLOLik/sutki/backend/internal/repository/postgres"
	paymentuc "github.com/TrollLOLik/sutki/backend/internal/usecase/payment"
)

type fixedPaymentUser struct{ user domain.User }

func (f fixedPaymentUser) GetByID(context.Context, int32) (domain.User, error) { return f.user, nil }

func TestPaymentPlatformMockRoundTrip(t *testing.T) {
	dbURL := os.Getenv("PAYMENT_TEST_DATABASE_URL")
	if dbURL == "" {
		t.Skip("PAYMENT_TEST_DATABASE_URL is not set")
	}
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	pool, err := pgxpool.New(ctx, dbURL)
	if err != nil {
		t.Fatal(err)
	}
	defer pool.Close()
	var userID int32
	var email, phone string
	if err := pool.QueryRow(ctx, `SELECT id,COALESCE(email,''),COALESCE(phone,'') FROM "user" ORDER BY id LIMIT 1`).Scan(&userID, &email, &phone); err != nil {
		t.Fatal(err)
	}
	if email == "" && phone == "" {
		t.Skip("test user has no receipt contact")
	}

	repo := postgres.NewPaymentRepo(pool)
	mock := provider.NewMockProvider()
	svc := paymentuc.New(repo, fixedPaymentUser{domain.User{ID: userID, Email: email, Phone: phone}}, mock, nil, paymentuc.Config{ReturnURL: "sutki://payments/return", Capture: true})
	svc.StartWebhookWorker(ctx)
	result, err := svc.Checkout(ctx, userID, "listing_publication", testUUID(t))
	if err != nil {
		t.Fatal(err)
	}
	var providerPaymentID string
	if err := pool.QueryRow(ctx, `SELECT provider_payment_id FROM payment WHERE id=$1`, result.PaymentID).Scan(&providerPaymentID); err != nil {
		t.Fatal(err)
	}
	defer func() {
		_, _ = pool.Exec(context.Background(), `DELETE FROM payment_webhook_event WHERE provider_object_id=$1`, providerPaymentID)
		_, _ = pool.Exec(context.Background(), `DELETE FROM payment_receipt WHERE payment_id=$1`, result.PaymentID)
		_, _ = pool.Exec(context.Background(), `DELETE FROM payment_refund WHERE payment_id=$1`, result.PaymentID)
		_, _ = pool.Exec(context.Background(), `DELETE FROM payment WHERE id=$1`, result.PaymentID)
	}()
	if result.Status != domain.PaymentStatusPending || result.ConfirmationURL == "" {
		t.Fatalf("unexpected checkout: %+v", result)
	}
	if err := svc.MockConfirm(ctx, result.PaymentID, userID); err != nil {
		t.Fatal(err)
	}
	deadline := time.Now().Add(3 * time.Second)
	for time.Now().Before(deadline) {
		p, err := svc.Get(ctx, result.PaymentID, userID)
		if err != nil {
			t.Fatal(err)
		}
		if p.Status == domain.PaymentStatusSucceeded {
			refundKey := testUUID(t)
			refund, err := svc.Refund(ctx, result.PaymentID, p.AmountKopecks, "integration test", refundKey, 0)
			if err != nil {
				t.Fatal(err)
			}
			if refund.Status != domain.RefundStatusSucceeded {
				t.Fatalf("refund status=%s", refund.Status)
			}
			replayed, err := svc.Refund(ctx, result.PaymentID, p.AmountKopecks, "integration test", refundKey, 0)
			if err != nil {
				t.Fatal(err)
			}
			if replayed.ID != refund.ID {
				t.Fatalf("refund replay created duplicate %d != %d", replayed.ID, refund.ID)
			}
			if _, err = svc.Refund(ctx, result.PaymentID, 1, "second refund", testUUID(t), 0); !errors.Is(err, domain.ErrPaymentNotRefundable) {
				t.Fatalf("expected over-refund rejection, got %v", err)
			}
			var receiptStatus string
			if err = pool.QueryRow(ctx, `SELECT status FROM payment_receipt WHERE refund_id=$1`, refund.ID).Scan(&receiptStatus); err != nil {
				t.Fatal(err)
			}
			if receiptStatus != "succeeded" {
				t.Fatalf("refund receipt status=%s", receiptStatus)
			}
			return
		}
		time.Sleep(25 * time.Millisecond)
	}
	var eventStatus, lastError string
	_ = pool.QueryRow(ctx, `SELECT status,COALESCE(last_error,'') FROM payment_webhook_event WHERE provider_object_id=$1 ORDER BY id DESC LIMIT 1`, providerPaymentID).Scan(&eventStatus, &lastError)
	t.Fatalf("mock webhook did not activate payment: event=%s error=%s", eventStatus, lastError)
}

func testUUID(t *testing.T) string {
	t.Helper()
	b := make([]byte, 16)
	if _, err := rand.Read(b); err != nil {
		t.Fatal(err)
	}
	b[6] = (b[6] & 0x0f) | 0x40
	b[8] = (b[8] & 0x3f) | 0x80
	return fmt.Sprintf("%08x-%04x-%04x-%04x-%012x", b[0:4], b[4:6], b[6:8], b[8:10], b[10:16])
}
