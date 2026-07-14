package promotion

import (
	"context"
	"fmt"
	"log"
	"strconv"
	"time"

	"github.com/TrollLOLik/sutki/backend/internal/domain"
	"github.com/TrollLOLik/sutki/backend/internal/observability"
	paymentuc "github.com/TrollLOLik/sutki/backend/internal/usecase/payment"
)

type Repository interface {
	Reserve(context.Context, int32, int32, string, int32, string) (domain.ListingPromotion, error)
	AttachPayment(context.Context, int64, int64) (domain.ListingPromotion, error)
	ApplyPayment(context.Context, int64, domain.Payment) (domain.ListingPromotion, error)
	ListForOwner(context.Context, int32, int32) ([]domain.ListingPromotion, error)
	DueExpiry(context.Context, int32) ([]domain.PromotionExpiryJob, error)
	Expire(context.Context, domain.PromotionExpiryJob) error
	RetryExpiry(context.Context, domain.PromotionExpiryJob, string, time.Time) error
}

type PaymentGateway interface {
	Product(context.Context, string) (domain.PaymentProduct, error)
	CheckoutReferenced(context.Context, int32, string, string, map[string]string) (paymentuc.CheckoutResult, error)
}

type Service struct {
	repo     Repository
	payments PaymentGateway
	wake     chan struct{}
}

func New(repo Repository, payments PaymentGateway) *Service {
	return &Service{repo: repo, payments: payments, wake: make(chan struct{}, 1)}
}

type CheckoutResult struct {
	Promotion domain.ListingPromotion  `json:"promotion"`
	Payment   paymentuc.CheckoutResult `json:"payment"`
}

func (s *Service) Checkout(ctx context.Context, userID, houseID int32, productCode, key string) (CheckoutResult, error) {
	if !paymentuc.ValidIdempotencyKey(key) {
		return CheckoutResult{}, fmt.Errorf("invalid idempotency key")
	}
	product, err := s.payments.Product(ctx, productCode)
	if err != nil {
		return CheckoutResult{}, err
	}
	if product.Purpose != "listing_promotion" || (product.ServiceType != domain.PromotionTypeBoost && product.ServiceType != domain.PromotionTypeHighlight) || product.DurationSeconds <= 0 {
		return CheckoutResult{}, domain.ErrPaymentConflict
	}
	promo, err := s.repo.Reserve(ctx, houseID, userID, product.ServiceType, product.DurationSeconds, key)
	if err != nil {
		return CheckoutResult{}, err
	}
	effectiveKey := promo.CheckoutKey
	if effectiveKey == "" {
		effectiveKey = key
	}
	effectiveProductCode := promo.ProductCode
	if effectiveProductCode == "" {
		effectiveProductCode = productCode
	}
	payment, err := s.payments.CheckoutReferenced(ctx, userID, effectiveProductCode, effectiveKey, map[string]string{
		"promotion_id": strconv.FormatInt(promo.ID, 10), "house_id": strconv.FormatInt(int64(houseID), 10), "promotion_type": promo.Type,
	})
	if err != nil {
		return CheckoutResult{}, err
	}
	promo, err = s.repo.AttachPayment(ctx, promo.ID, payment.PaymentID)
	if err != nil {
		return CheckoutResult{}, err
	}
	return CheckoutResult{Promotion: promo, Payment: payment}, nil
}

func (s *Service) List(ctx context.Context, userID, houseID int32) ([]domain.ListingPromotion, error) {
	return s.repo.ListForOwner(ctx, houseID, userID)
}

func (s *Service) PaymentStatusChanged(ctx context.Context, payment domain.Payment) error {
	if payment.Purpose != "listing_promotion" {
		return nil
	}
	id, err := strconv.ParseInt(payment.Metadata["promotion_id"], 10, 64)
	if err != nil || id <= 0 {
		return fmt.Errorf("promotion payment metadata is invalid")
	}
	_, err = s.repo.ApplyPayment(ctx, id, payment)
	if err == nil {
		select {
		case s.wake <- struct{}{}:
		default:
		}
	}
	return err
}

func (s *Service) StartExpiryWorker(ctx context.Context) {
	go func() {
		defer observability.RecoverAndRepanic(ctx)
		ticker := time.NewTicker(30 * time.Second)
		defer ticker.Stop()
		s.processExpiry(ctx)
		for {
			select {
			case <-ctx.Done():
				return
			case <-ticker.C:
				s.processExpiry(ctx)
			case <-s.wake:
				s.processExpiry(ctx)
			}
		}
	}()
	log.Println("promotion expiry worker: started")
}
func (s *Service) processExpiry(ctx context.Context) {
	for {
		jobs, err := s.repo.DueExpiry(ctx, 20)
		if err != nil {
			log.Printf("promotion expiry: claim: %v", err)
			observability.CaptureException(ctx, err)
			return
		}
		if len(jobs) == 0 {
			return
		}
		for _, job := range jobs {
			if err := s.repo.Expire(ctx, job); err != nil {
				if retryErr := s.repo.RetryExpiry(ctx, job, err.Error(), time.Now().Add(time.Minute)); retryErr != nil {
					observability.CaptureException(ctx, fmt.Errorf("promotion expiry retry job %d: %w", job.PromotionID, retryErr))
				} else if job.Attempts >= 5 {
					observability.CaptureException(ctx, fmt.Errorf("promotion expiry job %d exhausted attempts: %w", job.PromotionID, err))
				}
			}
		}
	}
}

var _ paymentuc.ActivationHandler = (*Service)(nil)
