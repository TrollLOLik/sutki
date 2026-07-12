package payment

import (
	"context"
	"crypto/subtle"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"net/mail"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/TrollLOLik/sutki/backend/internal/domain"
)

const (
	webhookBatchSize    int32 = 20
	webhookMaxAttempts        = 8
	webhookPollInterval       = 10 * time.Second
)

var uuidPattern = regexp.MustCompile(`^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$`)

func ValidIdempotencyKey(value string) bool { return uuidPattern.MatchString(value) }

type Repository interface {
	ListProducts(context.Context) ([]domain.PaymentProduct, error)
	GetProduct(context.Context, string) (domain.PaymentProduct, error)
	ReservePayment(context.Context, int32, domain.PaymentProduct, string, string, map[string]string, domain.Receipt) (domain.Payment, error)
	AttachProviderPayment(context.Context, int64, domain.ProviderPayment) (domain.Payment, error)
	GetPaymentForUser(context.Context, int64, int32) (domain.Payment, error)
	GetPaymentByProviderID(context.Context, string) (domain.Payment, error)
	ApplyVerifiedPayment(context.Context, domain.ProviderPayment) (domain.Payment, bool, error)
	GetPaymentReceipt(context.Context, int64) (domain.Receipt, error)
	EnqueueWebhook(context.Context, string, domain.ProviderWebhook) (bool, error)
	DueWebhookBatch(context.Context, int32) ([]domain.PaymentWebhookEvent, error)
	MarkWebhookDone(context.Context, int64) error
	MarkWebhookRetry(context.Context, int64, string, time.Time) error
	MarkWebhookFailed(context.Context, int64, string) error
	ReserveRefund(context.Context, domain.Payment, int32, string, int32, string, domain.Receipt) (domain.PaymentRefund, error)
	AttachProviderRefund(context.Context, int64, domain.ProviderRefund) (domain.PaymentRefund, error)
	ApplyVerifiedRefund(context.Context, domain.ProviderRefund) (domain.PaymentRefund, bool, error)
}

type UserReader interface {
	GetByID(context.Context, int32) (domain.User, error)
}

type ActivationHandler interface {
	PaymentStatusChanged(context.Context, domain.Payment) error
}

type Config struct {
	ReturnURL          string
	AdminToken         string
	AdminTokenPrevious string
	Capture            bool
}

type Service struct {
	repo        Repository
	users       UserReader
	provider    domain.PaymentProvider
	activator   ActivationHandler
	returnURL   string
	adminTokens []string
	capture     bool
	wake        chan struct{}
}

func New(repo Repository, users UserReader, provider domain.PaymentProvider, activator ActivationHandler, cfg Config) *Service {
	return &Service{
		repo: repo, users: users, provider: provider, activator: activator,
		returnURL: cfg.ReturnURL, adminTokens: nonEmptyTokens(cfg.AdminToken, cfg.AdminTokenPrevious), capture: cfg.Capture,
		wake: make(chan struct{}, 1),
	}
}

type CheckoutResult struct {
	PaymentID       int64  `json:"payment_id"`
	Status          string `json:"status"`
	ConfirmationURL string `json:"confirmation_url"`
	Provider        string `json:"provider"`
}

func (s *Service) Products(ctx context.Context) ([]domain.PaymentProduct, error) {
	return s.repo.ListProducts(ctx)
}
func (s *Service) Product(ctx context.Context, code string) (domain.PaymentProduct, error) {
	return s.repo.GetProduct(ctx, code)
}

func (s *Service) SetActivationHandler(handler ActivationHandler) { s.activator = handler }

func (s *Service) Checkout(ctx context.Context, userID int32, productCode, idempotencyKey string) (CheckoutResult, error) {
	return s.checkout(ctx, userID, productCode, idempotencyKey, nil, false)
}

func (s *Service) CheckoutReferenced(ctx context.Context, userID int32, productCode, idempotencyKey string, metadata map[string]string) (CheckoutResult, error) {
	return s.checkout(ctx, userID, productCode, idempotencyKey, metadata, true)
}

func (s *Service) checkout(ctx context.Context, userID int32, productCode, idempotencyKey string, extraMetadata map[string]string, allowReferenced bool) (CheckoutResult, error) {
	if !ValidIdempotencyKey(idempotencyKey) {
		return CheckoutResult{}, fmt.Errorf("invalid idempotency key")
	}
	product, err := s.repo.GetProduct(ctx, strings.TrimSpace(productCode))
	if err != nil {
		return CheckoutResult{}, err
	}
	if product.Purpose == "listing_promotion" && !allowReferenced {
		return CheckoutResult{}, domain.ErrPaymentConflict
	}
	user, err := s.users.GetByID(ctx, userID)
	if err != nil {
		return CheckoutResult{}, err
	}
	customer, err := receiptCustomer(user)
	if err != nil {
		return CheckoutResult{}, err
	}
	receipt := domain.Receipt{Customer: customer, Items: []domain.ReceiptItem{{
		Description: product.Title, Quantity: "1.00", AmountKopecks: product.AmountKopecks,
		Currency: product.Currency, VATCode: product.VATCode,
		PaymentSubject: product.PaymentSubject, PaymentMode: product.PaymentMode,
	}}}
	metadata := map[string]string{"product_code": product.Code, "purpose": product.Purpose}
	for key, value := range extraMetadata {
		metadata[key] = value
	}
	local, err := s.repo.ReservePayment(ctx, userID, product, s.provider.Name(), idempotencyKey, metadata, receipt)
	if err != nil {
		return CheckoutResult{}, err
	}
	if local.ProviderPaymentID != "" {
		if restorer, ok := s.provider.(interface{ RestorePayment(domain.Payment) }); ok {
			restorer.RestorePayment(local)
		}
		return checkoutResult(local), nil
	}
	metadata["local_payment_id"] = strconv.FormatInt(local.ID, 10)
	providerPayment, err := s.provider.CreatePayment(ctx, domain.ProviderCreatePayment{
		IdempotencyKey: idempotencyKey,
		Money:          domain.Money{AmountKopecks: product.AmountKopecks, Currency: product.Currency},
		Capture:        s.capture, ReturnURL: s.returnURL, Description: product.Title,
		Metadata: metadata, Receipt: &receipt,
	})
	if err != nil {
		return CheckoutResult{}, err
	}
	local, err = s.repo.AttachProviderPayment(ctx, local.ID, providerPayment)
	if err != nil {
		return CheckoutResult{}, err
	}
	return checkoutResult(local), nil
}

func (s *Service) Get(ctx context.Context, paymentID int64, userID int32) (domain.Payment, error) {
	return s.repo.GetPaymentForUser(ctx, paymentID, userID)
}

func (s *Service) AcceptWebhook(ctx context.Context, body []byte) (bool, error) {
	event, err := s.provider.ParseWebhook(body)
	if err != nil {
		return false, err
	}
	// Persist only the routing fields used by the worker. Full provider objects
	// may contain payment method or customer data that the inbox does not need.
	event.Raw, _ = json.Marshal(map[string]any{
		"type": "notification", "event": event.Event,
		"object": map[string]string{"id": event.ObjectID},
	})
	inserted, err := s.repo.EnqueueWebhook(ctx, s.provider.Name(), event)
	if inserted {
		select {
		case s.wake <- struct{}{}:
		default:
		}
	}
	return inserted, err
}

func (s *Service) Refund(ctx context.Context, paymentID int64, amountKopecks int32, reason, idempotencyKey string, initiatedBy int32) (domain.PaymentRefund, error) {
	if !ValidIdempotencyKey(idempotencyKey) {
		return domain.PaymentRefund{}, fmt.Errorf("invalid idempotency key")
	}
	payment, err := s.repo.GetPaymentForUser(ctx, paymentID, 0)
	if err != nil {
		return domain.PaymentRefund{}, err
	}
	if payment.Status != domain.PaymentStatusSucceeded || amountKopecks <= 0 {
		return domain.PaymentRefund{}, domain.ErrPaymentNotRefundable
	}
	receipt, err := s.repo.GetPaymentReceipt(ctx, payment.ID)
	if err != nil {
		return domain.PaymentRefund{}, err
	}
	if len(receipt.Items) != 1 {
		return domain.PaymentRefund{}, fmt.Errorf("refund receipt allocation requires manual review")
	}
	receipt.Items[0].AmountKopecks = amountKopecks
	refund, err := s.repo.ReserveRefund(ctx, payment, amountKopecks, idempotencyKey, initiatedBy, strings.TrimSpace(reason), receipt)
	if err != nil || refund.ProviderRefundID != "" {
		return refund, err
	}
	providerRefund, err := s.provider.CreateRefund(ctx, domain.ProviderCreateRefund{
		IdempotencyKey: idempotencyKey, PaymentID: payment.ProviderPaymentID,
		Money:       domain.Money{AmountKopecks: amountKopecks, Currency: payment.Currency},
		Description: reason, Receipt: &receipt,
	})
	if err != nil {
		return domain.PaymentRefund{}, err
	}
	refund, err = s.repo.AttachProviderRefund(ctx, refund.ID, providerRefund)
	if err != nil {
		return domain.PaymentRefund{}, err
	}
	if providerRefund.Status == domain.RefundStatusSucceeded || providerRefund.Status == domain.RefundStatusCanceled {
		refund, _, err = s.repo.ApplyVerifiedRefund(ctx, providerRefund)
	}
	return refund, err
}

func (s *Service) AdminAuthorized(token string) bool {
	for _, candidate := range s.adminTokens {
		if len(token) == len(candidate) && subtle.ConstantTimeCompare([]byte(token), []byte(candidate)) == 1 {
			return true
		}
	}
	return false
}

func (s *Service) MockSetStatus(ctx context.Context, providerPaymentID, status string) error {
	mock, ok := s.provider.(interface {
		SetPaymentStatus(string, string) ([]byte, error)
	})
	if !ok {
		return domain.ErrNotFound
	}
	body, err := mock.SetPaymentStatus(providerPaymentID, status)
	if err != nil {
		return err
	}
	_, err = s.AcceptWebhook(ctx, body)
	return err
}

func (s *Service) MockConfirm(ctx context.Context, paymentID int64, userID int32) error {
	payment, err := s.repo.GetPaymentForUser(ctx, paymentID, userID)
	if err != nil {
		return err
	}
	if payment.Provider != "mock" || payment.ProviderPaymentID == "" {
		return domain.ErrNotFound
	}
	return s.MockSetStatus(ctx, payment.ProviderPaymentID, domain.PaymentStatusSucceeded)
}

func (s *Service) StartWebhookWorker(ctx context.Context) {
	go func() {
		ticker := time.NewTicker(webhookPollInterval)
		defer ticker.Stop()
		s.processDue(ctx)
		for {
			select {
			case <-ctx.Done():
				return
			case <-ticker.C:
				s.processDue(ctx)
			case <-s.wake:
				s.processDue(ctx)
			}
		}
	}()
	log.Printf("payment webhook worker: started (provider=%s)", s.provider.Name())
}

func (s *Service) processDue(ctx context.Context) {
	for {
		events, err := s.repo.DueWebhookBatch(ctx, webhookBatchSize)
		if err != nil {
			log.Printf("payment webhook worker: claim: %v", err)
			return
		}
		if len(events) == 0 {
			return
		}
		for _, event := range events {
			if err := s.processEvent(ctx, event); err != nil {
				s.failEvent(ctx, event, err)
			}
		}
	}
}

func (s *Service) processEvent(ctx context.Context, event domain.PaymentWebhookEvent) error {
	parsed, err := s.provider.ParseWebhook(event.Payload)
	if err != nil || parsed.Event != event.EventType || parsed.ObjectID != event.ProviderObjectID {
		return domain.ErrInvalidWebhook
	}
	switch parsed.Event {
	case "payment.succeeded", "payment.canceled", "payment.waiting_for_capture":
		verified, err := s.provider.GetPayment(ctx, parsed.ObjectID)
		if err != nil {
			return err
		}
		if parsed.Event != "payment."+verified.Status {
			return domain.ErrWebhookStateMismatch
		}
		payment, _, err := s.repo.ApplyVerifiedPayment(ctx, verified)
		if err != nil {
			return err
		}
		// Activation is intentionally retried for terminal events. The provider
		// webhook may be replayed after the payment was committed but the
		// business-side activation failed.
		if s.activator != nil && (payment.Status == domain.PaymentStatusSucceeded || payment.Status == domain.PaymentStatusCanceled) {
			if err := s.activator.PaymentStatusChanged(ctx, payment); err != nil {
				return err
			}
		}
	case "refund.succeeded", "refund.canceled":
		verified, err := s.provider.GetRefund(ctx, parsed.ObjectID)
		if err != nil {
			return err
		}
		if parsed.Event != "refund."+verified.Status {
			return domain.ErrWebhookStateMismatch
		}
		if _, _, err := s.repo.ApplyVerifiedRefund(ctx, verified); err != nil {
			return err
		}
	default:
		return fmt.Errorf("unsupported payment event %q", parsed.Event)
	}
	return s.repo.MarkWebhookDone(ctx, event.ID)
}

func (s *Service) failEvent(ctx context.Context, event domain.PaymentWebhookEvent, err error) {
	if errors.Is(err, domain.ErrInvalidWebhook) || event.Attempts >= webhookMaxAttempts {
		_ = s.repo.MarkWebhookFailed(ctx, event.ID, err.Error())
		return
	}
	delay := time.Duration(1<<min(int(event.Attempts), 6)) * 10 * time.Second
	_ = s.repo.MarkWebhookRetry(ctx, event.ID, err.Error(), time.Now().Add(delay))
}

func checkoutResult(p domain.Payment) CheckoutResult {
	return CheckoutResult{PaymentID: p.ID, Status: p.Status, ConfirmationURL: p.ConfirmationURL, Provider: p.Provider}
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}

func receiptCustomer(user domain.User) (domain.ReceiptCustomer, error) {
	if email := strings.TrimSpace(user.Email); email != "" {
		if parsed, err := mail.ParseAddress(email); err == nil && parsed.Address == email {
			return domain.ReceiptCustomer{Email: email}, nil
		}
	}
	phone, err := normalizeReceiptPhone(user.PhoneNormalized)
	if err != nil {
		return domain.ReceiptCustomer{}, fmt.Errorf("receipt contact is invalid")
	}
	return domain.ReceiptCustomer{Phone: phone}, nil
}

func normalizeReceiptPhone(raw string) (string, error) {
	var digits strings.Builder
	for _, r := range raw {
		if r >= '0' && r <= '9' {
			digits.WriteRune(r)
		}
	}
	value := digits.String()
	if len(value) == 11 && value[0] == '8' {
		value = "7" + value[1:]
	}
	// Current phone authentication is Russian-only and stores +7 E.164.
	// YooKassa receipt examples use the same country code without '+'.
	if len(value) != 11 || value[0] != '7' {
		return "", fmt.Errorf("invalid receipt phone")
	}
	return value, nil
}

func nonEmptyTokens(values ...string) []string {
	out := make([]string, 0, len(values))
	for _, value := range values {
		if value = strings.TrimSpace(value); value != "" {
			out = append(out, value)
		}
	}
	return out
}
