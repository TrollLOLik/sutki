package postgres

import (
	"context"
	"errors"
	"github.com/TrollLOLik/sutki/backend/internal/domain"
	promotionuc "github.com/TrollLOLik/sutki/backend/internal/usecase/promotion"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
	"time"
)

type PromotionRepo struct{ pool *pgxpool.Pool }

func NewPromotionRepo(pool *pgxpool.Pool) *PromotionRepo { return &PromotionRepo{pool: pool} }

var _ promotionuc.Repository = (*PromotionRepo)(nil)

func (r *PromotionRepo) Reserve(ctx context.Context, houseID, userID int32, kind string, duration int32, key string) (domain.ListingPromotion, error) {
	if existing, err := r.findOpenForOwner(ctx, houseID, userID, kind); err == nil {
		return existing, nil
	} else if !errors.Is(err, domain.ErrNotFound) {
		return domain.ListingPromotion{}, err
	}
	var p domain.ListingPromotion
	err := r.pool.QueryRow(ctx, `INSERT INTO listing_promotion(house_id,purchased_by,type,status,duration_seconds,remaining_seconds,checkout_key)
 SELECT id,$2,$3,'pending_payment',$4,$4,$5::uuid FROM house WHERE id=$1 AND owner_id=$2 AND deleted=false
 ON CONFLICT(checkout_key) DO UPDATE SET checkout_key=EXCLUDED.checkout_key
 RETURNING id,house_id,COALESCE(purchased_by,0),payment_id,type,status,duration_seconds,remaining_seconds,starts_at,expires_at,activated_at,COALESCE(pause_reason,''),version,checkout_key::text`, houseID, userID, kind, duration, key).Scan(&p.ID, &p.HouseID, &p.PurchasedBy, &p.PaymentID, &p.Type, &p.Status, &p.DurationSeconds, &p.RemainingSeconds, &p.StartsAt, &p.ExpiresAt, &p.ActivatedAt, &p.PauseReason, &p.Version, &p.CheckoutKey)
	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) && pgErr.Code == "23505" {
		if existing, findErr := r.findOpenForOwner(ctx, houseID, userID, kind); findErr == nil {
			return existing, nil
		}
		return p, domain.ErrPaymentConflict
	}
	if errors.Is(err, pgx.ErrNoRows) {
		return p, domain.ErrNotFound
	}
	return p, err
}

func (r *PromotionRepo) findOpenForOwner(ctx context.Context, houseID, userID int32, kind string) (domain.ListingPromotion, error) {
	var p domain.ListingPromotion
	err := r.pool.QueryRow(ctx, `SELECT lp.id,lp.house_id,COALESCE(lp.purchased_by,0),lp.payment_id,lp.type,lp.status,lp.duration_seconds,lp.remaining_seconds,lp.starts_at,lp.expires_at,lp.activated_at,COALESCE(lp.pause_reason,''),lp.version,lp.checkout_key::text,COALESCE(p.product_code,'') FROM listing_promotion lp JOIN house h ON h.id=lp.house_id LEFT JOIN payment p ON p.id=lp.payment_id WHERE lp.house_id=$1 AND h.owner_id=$2 AND lp.type=$3 AND lp.status IN ('pending_payment','active','paused') LIMIT 1`, houseID, userID, kind).Scan(&p.ID, &p.HouseID, &p.PurchasedBy, &p.PaymentID, &p.Type, &p.Status, &p.DurationSeconds, &p.RemainingSeconds, &p.StartsAt, &p.ExpiresAt, &p.ActivatedAt, &p.PauseReason, &p.Version, &p.CheckoutKey, &p.ProductCode)
	if errors.Is(err, pgx.ErrNoRows) {
		return p, domain.ErrNotFound
	}
	return p, err
}
func (r *PromotionRepo) AttachPayment(ctx context.Context, id, paymentID int64) (domain.ListingPromotion, error) {
	var p domain.ListingPromotion
	err := r.pool.QueryRow(ctx, `UPDATE listing_promotion SET payment_id=$2,updated_at=now() WHERE id=$1 AND (payment_id IS NULL OR payment_id=$2)
 RETURNING id,house_id,COALESCE(purchased_by,0),payment_id,type,status,duration_seconds,remaining_seconds,starts_at,expires_at,activated_at,COALESCE(pause_reason,''),version`, id, paymentID).Scan(&p.ID, &p.HouseID, &p.PurchasedBy, &p.PaymentID, &p.Type, &p.Status, &p.DurationSeconds, &p.RemainingSeconds, &p.StartsAt, &p.ExpiresAt, &p.ActivatedAt, &p.PauseReason, &p.Version)
	if errors.Is(err, pgx.ErrNoRows) {
		return p, domain.ErrPaymentConflict
	}
	return p, err
}
func (r *PromotionRepo) ApplyPayment(ctx context.Context, id int64, payment domain.Payment) (domain.ListingPromotion, error) {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return domain.ListingPromotion{}, err
	}
	defer tx.Rollback(ctx)
	var p domain.ListingPromotion
	var houseStatus string
	var deleted bool
	err = tx.QueryRow(ctx, `SELECT lp.id,lp.house_id,COALESCE(lp.purchased_by,0),lp.payment_id,lp.type,lp.status,lp.duration_seconds,lp.remaining_seconds,lp.starts_at,lp.expires_at,lp.activated_at,COALESCE(lp.pause_reason,''),lp.version,h.status,h.deleted FROM listing_promotion lp JOIN house h ON h.id=lp.house_id WHERE lp.id=$1 FOR UPDATE OF lp`, id).Scan(&p.ID, &p.HouseID, &p.PurchasedBy, &p.PaymentID, &p.Type, &p.Status, &p.DurationSeconds, &p.RemainingSeconds, &p.StartsAt, &p.ExpiresAt, &p.ActivatedAt, &p.PauseReason, &p.Version, &houseStatus, &deleted)
	if err != nil {
		return p, err
	}
	if p.PurchasedBy != payment.UserID {
		return p, domain.ErrPaymentConflict
	}
	if p.PaymentID != nil && *p.PaymentID != payment.ID {
		return p, domain.ErrPaymentConflict
	}
	if p.Status != domain.PromotionPendingPayment {
		return p, tx.Commit(ctx)
	}
	switch payment.Status {
	case domain.PaymentStatusSucceeded:
		if p.Status == domain.PromotionPendingPayment {
			if deleted {
				p.Status = domain.PromotionCancelled
			} else if houseStatus == "active" {
				p.Status = domain.PromotionActive
			} else {
				p.Status = domain.PromotionPaused
			}
		}
	case domain.PaymentStatusCanceled:
		if p.Status == domain.PromotionPendingPayment {
			p.Status = domain.PromotionPaymentFailed
		}
	default:
		return p, nil
	}
	if p.Status == domain.PromotionActive {
		err = tx.QueryRow(ctx, `UPDATE listing_promotion SET payment_id=$2,status='active',starts_at=now(),expires_at=now()+make_interval(secs=>remaining_seconds),activated_at=COALESCE(activated_at,now()),pause_reason=NULL,version=version+1,updated_at=now() WHERE id=$1 RETURNING version,starts_at,expires_at`, id, payment.ID).Scan(&p.Version, &p.StartsAt, &p.ExpiresAt)
		if err == nil {
			_, err = tx.Exec(ctx, `INSERT INTO promotion_expiry_job(promotion_id,version,due_at) VALUES($1,$2,$3) ON CONFLICT(promotion_id) DO UPDATE SET version=EXCLUDED.version,due_at=EXCLUDED.due_at,status='queued',attempts=0,last_error=NULL,updated_at=now()`, id, p.Version, p.ExpiresAt)
		}
	} else {
		_, err = tx.Exec(ctx, `UPDATE listing_promotion SET payment_id=$2,status=$3,paused_at=CASE WHEN $3='paused' THEN now() ELSE paused_at END,pause_reason=CASE WHEN $3='paused' THEN 'listing_not_active' ELSE pause_reason END,version=version+1,updated_at=now() WHERE id=$1`, id, payment.ID, p.Status)
	}
	if err != nil {
		return p, err
	}
	if err = tx.Commit(ctx); err != nil {
		return p, err
	}
	return p, nil
}
func (r *PromotionRepo) ListForOwner(ctx context.Context, houseID, ownerID int32) ([]domain.ListingPromotion, error) {
	rows, err := r.pool.Query(ctx, `SELECT lp.id,lp.house_id,COALESCE(lp.purchased_by,0),lp.payment_id,lp.type,lp.status,lp.duration_seconds,lp.remaining_seconds,lp.starts_at,lp.expires_at,lp.activated_at,COALESCE(lp.pause_reason,''),lp.version FROM listing_promotion lp JOIN house h ON h.id=lp.house_id WHERE lp.house_id=$1 AND h.owner_id=$2 AND h.deleted=false ORDER BY lp.created_at DESC`, houseID, ownerID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []domain.ListingPromotion
	for rows.Next() {
		var p domain.ListingPromotion
		if err := rows.Scan(&p.ID, &p.HouseID, &p.PurchasedBy, &p.PaymentID, &p.Type, &p.Status, &p.DurationSeconds, &p.RemainingSeconds, &p.StartsAt, &p.ExpiresAt, &p.ActivatedAt, &p.PauseReason, &p.Version); err != nil {
			return nil, err
		}
		out = append(out, p)
	}
	return out, rows.Err()
}
func (r *PromotionRepo) DueExpiry(ctx context.Context, limit int32) ([]domain.PromotionExpiryJob, error) {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)
	if _, err = tx.Exec(ctx, `UPDATE promotion_expiry_job SET status='queued',last_error='processing lease expired',updated_at=now() WHERE status='processing' AND updated_at<now()-interval '5 minutes'`); err != nil {
		return nil, err
	}
	rows, err := tx.Query(ctx, `WITH due AS(SELECT promotion_id FROM promotion_expiry_job WHERE status='queued' AND due_at<=now() ORDER BY due_at FOR UPDATE SKIP LOCKED LIMIT $1) UPDATE promotion_expiry_job j SET status='processing',attempts=attempts+1,updated_at=now() FROM due WHERE j.promotion_id=due.promotion_id RETURNING j.promotion_id,j.version,j.attempts`, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []domain.PromotionExpiryJob
	for rows.Next() {
		var j domain.PromotionExpiryJob
		if err := rows.Scan(&j.PromotionID, &j.Version, &j.Attempts); err != nil {
			return nil, err
		}
		out = append(out, j)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	if err = tx.Commit(ctx); err != nil {
		return nil, err
	}
	return out, nil
}
func (r *PromotionRepo) Expire(ctx context.Context, j domain.PromotionExpiryJob) error {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	tag, err := tx.Exec(ctx, `UPDATE listing_promotion SET status='expired',remaining_seconds=0,starts_at=NULL,expires_at=NULL,version=version+1,updated_at=now() WHERE id=$1 AND version=$2 AND status='active' AND expires_at<=now()`, j.PromotionID, j.Version)
	if err != nil {
		return err
	}
	_, err = tx.Exec(ctx, `UPDATE promotion_expiry_job SET status='done',last_error=NULL,updated_at=now() WHERE promotion_id=$1 AND version=$2`, j.PromotionID, j.Version)
	if err != nil {
		return err
	}
	_ = tag
	return tx.Commit(ctx)
}
func (r *PromotionRepo) RetryExpiry(ctx context.Context, j domain.PromotionExpiryJob, msg string, next time.Time) error {
	_, err := r.pool.Exec(ctx, `UPDATE promotion_expiry_job SET status=CASE WHEN attempts>=5 THEN 'failed' ELSE 'queued' END,last_error=left($3,500),due_at=$4,updated_at=now() WHERE promotion_id=$1 AND version=$2`, j.PromotionID, j.Version, msg, next)
	return err
}
