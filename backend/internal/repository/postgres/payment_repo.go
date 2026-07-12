package postgres

import (
	"context"
	"encoding/json"
	"errors"
	"strconv"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/TrollLOLik/sutki/backend/internal/domain"
	paymentuc "github.com/TrollLOLik/sutki/backend/internal/usecase/payment"
)

type PaymentRepo struct{ pool *pgxpool.Pool }

func NewPaymentRepo(pool *pgxpool.Pool) *PaymentRepo { return &PaymentRepo{pool: pool} }

var _ paymentuc.Repository = (*PaymentRepo)(nil)

func (r *PaymentRepo) ListProducts(ctx context.Context) ([]domain.PaymentProduct, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT code, title, purpose, amount_kopecks, currency, vat_code, payment_subject, payment_mode,COALESCE(service_type,''),COALESCE(duration_seconds,0)
		FROM payment_product WHERE enabled = true ORDER BY code`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []domain.PaymentProduct
	for rows.Next() {
		var p domain.PaymentProduct
		if err := rows.Scan(&p.Code, &p.Title, &p.Purpose, &p.AmountKopecks, &p.Currency, &p.VATCode, &p.PaymentSubject, &p.PaymentMode, &p.ServiceType, &p.DurationSeconds); err != nil {
			return nil, err
		}
		out = append(out, p)
	}
	return out, rows.Err()
}

func (r *PaymentRepo) GetProduct(ctx context.Context, code string) (domain.PaymentProduct, error) {
	var p domain.PaymentProduct
	err := r.pool.QueryRow(ctx, `
		SELECT code, title, purpose, amount_kopecks, currency, vat_code, payment_subject, payment_mode,COALESCE(service_type,''),COALESCE(duration_seconds,0)
		FROM payment_product WHERE code = $1 AND enabled = true`, code).
		Scan(&p.Code, &p.Title, &p.Purpose, &p.AmountKopecks, &p.Currency, &p.VATCode, &p.PaymentSubject, &p.PaymentMode, &p.ServiceType, &p.DurationSeconds)
	if errors.Is(err, pgx.ErrNoRows) {
		return p, domain.ErrPaymentNotFound
	}
	return p, err
}

func (r *PaymentRepo) ReservePayment(ctx context.Context, userID int32, product domain.PaymentProduct, provider, key string, metadata map[string]string, receipt domain.Receipt) (domain.Payment, error) {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return domain.Payment{}, err
	}
	defer tx.Rollback(ctx)

	if existing, err := getPaymentByIdempotency(ctx, tx, key); err == nil {
		if existing.UserID != userID || existing.ProductCode != product.Code || existing.Provider != provider || existing.AmountKopecks != product.AmountKopecks || existing.Currency != product.Currency {
			return domain.Payment{}, domain.ErrPaymentConflict
		}
		return existing, nil
	} else if !errors.Is(err, domain.ErrPaymentNotFound) {
		return domain.Payment{}, err
	}

	metadataBytes, _ := json.Marshal(metadata)
	var id int64
	err = tx.QueryRow(ctx, `
		INSERT INTO payment
			(user_id, provider, amount_kopecks, currency, status, purpose, product_code,
			 idempotency_key, description, metadata, created_at, updated_at)
		VALUES ($1, $2, $3, $4, 'pending', $5, $6, $7::uuid, $8, $9, now(), now())
		RETURNING id`, userID, provider, product.AmountKopecks, product.Currency, product.Purpose,
		product.Code, key, product.Title, metadataBytes).Scan(&id)
	if err != nil {
		return domain.Payment{}, err
	}

	metadata["local_payment_id"] = strconv.FormatInt(id, 10)
	metadataBytes, _ = json.Marshal(metadata)
	if _, err = tx.Exec(ctx, `UPDATE payment SET metadata=$2 WHERE id=$1`, id, metadataBytes); err != nil {
		return domain.Payment{}, err
	}
	receiptBytes, _ := json.Marshal(receipt)
	contact := receipt.Customer.Email
	if contact == "" {
		contact = receipt.Customer.Phone
	}
	if _, err = tx.Exec(ctx, `
		INSERT INTO payment_receipt (payment_id, operation, status, customer_contact_masked, payload)
		VALUES ($1, 'payment', 'pending', $2, $3)`, id, maskContact(contact), receiptBytes); err != nil {
		return domain.Payment{}, err
	}
	if err = tx.Commit(ctx); err != nil {
		return domain.Payment{}, err
	}
	return r.GetPaymentForUser(ctx, id, userID)
}

func (r *PaymentRepo) AttachProviderPayment(ctx context.Context, id int64, verified domain.ProviderPayment) (domain.Payment, error) {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return domain.Payment{}, err
	}
	defer tx.Rollback(ctx)
	p, err := getPaymentForUpdate(ctx, tx, id)
	if err != nil {
		return p, err
	}
	if err := verifyProviderPayment(p, verified); err != nil {
		return p, err
	}
	if p.ProviderPaymentID != "" && p.ProviderPaymentID != verified.ID {
		return p, domain.ErrPaymentConflict
	}
	// Creation response is not an activation signal. The verified provider
	// identifier is stored, while status remains pending until webhook processing.
	_, err = tx.Exec(ctx, `
		UPDATE payment SET provider_payment_id=$2, confirmation_url=NULLIF($3,''), updated_at=now()
		WHERE id=$1`, id, verified.ID, verified.ConfirmationURL)
	if err != nil {
		return p, err
	}
	receiptStatus := verified.ReceiptRegistration
	if receiptStatus == "" {
		receiptStatus = "submitted"
	}
	if _, err = tx.Exec(ctx, `UPDATE payment_receipt SET status=$2,updated_at=now() WHERE payment_id=$1 AND operation='payment'`, id, receiptStatus); err != nil {
		return p, err
	}
	if err = tx.Commit(ctx); err != nil {
		return p, err
	}
	return r.GetPaymentForUser(ctx, id, p.UserID)
}

func (r *PaymentRepo) GetPaymentForUser(ctx context.Context, id int64, userID int32) (domain.Payment, error) {
	query := `SELECT id, COALESCE(user_id,0), provider, COALESCE(provider_payment_id,''), purpose,
		COALESCE(product_code,''), amount_kopecks, currency, status, COALESCE(confirmation_url,''),
		COALESCE(description,''), COALESCE(idempotency_key::text,''), metadata, refunded_amount_kopecks,
		created_at, updated_at, paid_at, canceled_at FROM payment WHERE id=$1`
	args := []any{id}
	if userID != 0 {
		query += ` AND user_id=$2`
		args = append(args, userID)
	}
	return scanPayment(r.pool.QueryRow(ctx, query, args...))
}

func (r *PaymentRepo) GetPaymentByProviderID(ctx context.Context, id string) (domain.Payment, error) {
	return scanPayment(r.pool.QueryRow(ctx, `SELECT id, COALESCE(user_id,0), provider, COALESCE(provider_payment_id,''), purpose,
		COALESCE(product_code,''), amount_kopecks, currency, status, COALESCE(confirmation_url,''),
		COALESCE(description,''), COALESCE(idempotency_key::text,''), metadata, refunded_amount_kopecks,
		created_at, updated_at, paid_at, canceled_at FROM payment WHERE provider_payment_id=$1`, id))
}

func (r *PaymentRepo) ApplyVerifiedPayment(ctx context.Context, verified domain.ProviderPayment) (domain.Payment, bool, error) {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return domain.Payment{}, false, err
	}
	defer tx.Rollback(ctx)
	var localID int64
	err = tx.QueryRow(ctx, `SELECT id FROM payment WHERE provider_payment_id=$1 FOR UPDATE`, verified.ID).Scan(&localID)
	if errors.Is(err, pgx.ErrNoRows) {
		return domain.Payment{}, false, domain.ErrPaymentNotFound
	}
	if err != nil {
		return domain.Payment{}, false, err
	}
	p, err := getPaymentForUpdate(ctx, tx, localID)
	if err != nil {
		return p, false, err
	}
	if err := verifyProviderPayment(p, verified); err != nil {
		return p, false, err
	}
	if !validPaymentTransition(p.Status, verified.Status) {
		return p, false, domain.ErrPaymentConflict
	}
	changed := p.Status != verified.Status
	if changed {
		if verified.Status == domain.PaymentStatusSucceeded && !verified.Paid {
			return p, false, domain.ErrPaymentConflict
		}
		_, err = tx.Exec(ctx, `UPDATE payment SET status=$2::varchar, paid_at=CASE WHEN $2::text='succeeded' THEN now() ELSE paid_at END,
			canceled_at=CASE WHEN $2::text='canceled' THEN now() ELSE canceled_at END, updated_at=now() WHERE id=$1`, p.ID, verified.Status)
		if err != nil {
			return p, false, err
		}
	}
	if verified.ReceiptRegistration != "" {
		if _, err = tx.Exec(ctx, `UPDATE payment_receipt SET status=$2::varchar,registered_at=CASE WHEN $2::text='succeeded' THEN now() ELSE registered_at END,updated_at=now() WHERE payment_id=$1 AND operation='payment'`, p.ID, verified.ReceiptRegistration); err != nil {
			return p, false, err
		}
	}
	if err = tx.Commit(ctx); err != nil {
		return p, false, err
	}
	p, err = r.GetPaymentForUser(ctx, p.ID, p.UserID)
	return p, changed, err
}

func (r *PaymentRepo) EnqueueWebhook(ctx context.Context, provider string, event domain.ProviderWebhook) (bool, error) {
	dedup := provider + ":" + event.Event + ":" + event.ObjectID
	tag, err := r.pool.Exec(ctx, `INSERT INTO payment_webhook_event
		(provider,event_type,provider_object_id,dedup_key,payload) VALUES ($1,$2,$3,$4,$5)
		ON CONFLICT (dedup_key) DO UPDATE SET
			payload=EXCLUDED.payload,status='queued',attempts=0,next_attempt_at=now(),last_error=NULL,updated_at=now()
		WHERE payment_webhook_event.status='failed'`, provider, event.Event, event.ObjectID, dedup, []byte(event.Raw))
	return err == nil && tag.RowsAffected() == 1, err
}

func (r *PaymentRepo) DueWebhookBatch(ctx context.Context, limit int32) ([]domain.PaymentWebhookEvent, error) {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)
	_, err = tx.Exec(ctx, `UPDATE payment_webhook_event SET status='queued', updated_at=now()
		WHERE status='processing' AND updated_at < now()-interval '5 minutes'`)
	if err != nil {
		return nil, err
	}
	rows, err := tx.Query(ctx, `WITH due AS (
		SELECT id FROM payment_webhook_event WHERE status='queued' AND next_attempt_at<=now()
		ORDER BY next_attempt_at,id FOR UPDATE SKIP LOCKED LIMIT $1)
		UPDATE payment_webhook_event e SET status='processing', attempts=attempts+1, updated_at=now()
		FROM due WHERE e.id=due.id
		RETURNING e.id,e.provider,e.event_type,e.provider_object_id,e.payload,e.attempts`, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []domain.PaymentWebhookEvent
	for rows.Next() {
		var e domain.PaymentWebhookEvent
		if err := rows.Scan(&e.ID, &e.Provider, &e.EventType, &e.ProviderObjectID, &e.Payload, &e.Attempts); err != nil {
			return nil, err
		}
		out = append(out, e)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	return out, nil
}

func (r *PaymentRepo) MarkWebhookDone(ctx context.Context, id int64) error {
	_, err := r.pool.Exec(ctx, `UPDATE payment_webhook_event SET status='done',processed_at=now(),last_error=NULL,updated_at=now() WHERE id=$1 AND status='processing'`, id)
	return err
}
func (r *PaymentRepo) MarkWebhookRetry(ctx context.Context, id int64, msg string, next time.Time) error {
	_, err := r.pool.Exec(ctx, `UPDATE payment_webhook_event SET status='queued',last_error=left($2,1000),next_attempt_at=$3,updated_at=now() WHERE id=$1 AND status='processing'`, id, msg, next)
	return err
}
func (r *PaymentRepo) MarkWebhookFailed(ctx context.Context, id int64, msg string) error {
	_, err := r.pool.Exec(ctx, `UPDATE payment_webhook_event SET status='failed',last_error=left($2,1000),updated_at=now() WHERE id=$1 AND status='processing'`, id, msg)
	return err
}

func (r *PaymentRepo) GetPaymentReceipt(ctx context.Context, paymentID int64) (domain.Receipt, error) {
	var payload []byte
	err := r.pool.QueryRow(ctx, `SELECT payload FROM payment_receipt WHERE payment_id=$1 AND operation='payment' ORDER BY id DESC LIMIT 1`, paymentID).Scan(&payload)
	if errors.Is(err, pgx.ErrNoRows) {
		return domain.Receipt{}, domain.ErrPaymentNotFound
	}
	if err != nil {
		return domain.Receipt{}, err
	}
	var receipt domain.Receipt
	if err = json.Unmarshal(payload, &receipt); err != nil {
		return receipt, err
	}
	return receipt, nil
}

func (r *PaymentRepo) ReserveRefund(ctx context.Context, payment domain.Payment, amount int32, key string, by int32, reason string, receipt domain.Receipt) (domain.PaymentRefund, error) {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return domain.PaymentRefund{}, err
	}
	defer tx.Rollback(ctx)
	var existing domain.PaymentRefund
	err = tx.QueryRow(ctx, `SELECT id,payment_id,COALESCE(provider_refund_id,''),idempotency_key::text,amount_kopecks,currency,status,reason,COALESCE(initiated_by,0) FROM payment_refund WHERE idempotency_key=$1::uuid`, key).
		Scan(&existing.ID, &existing.PaymentID, &existing.ProviderRefundID, &existing.IdempotencyKey, &existing.AmountKopecks, &existing.Currency, &existing.Status, &existing.Reason, &existing.InitiatedBy)
	if err == nil {
		if existing.PaymentID != payment.ID || existing.AmountKopecks != amount {
			return existing, domain.ErrPaymentConflict
		}
		return existing, nil
	}
	if !errors.Is(err, pgx.ErrNoRows) {
		return existing, err
	}
	var status string
	var paid, refunded, pending int32
	err = tx.QueryRow(ctx, `SELECT status,amount_kopecks,refunded_amount_kopecks,
		COALESCE((SELECT sum(amount_kopecks) FROM payment_refund WHERE payment_id=payment.id AND status IN ('pending','waiting_for_capture')),0)
		FROM payment WHERE id=$1 FOR UPDATE`, payment.ID).Scan(&status, &paid, &refunded, &pending)
	if err != nil {
		return existing, err
	}
	if status != domain.PaymentStatusSucceeded || amount <= 0 || amount > paid-refunded-pending {
		return existing, domain.ErrPaymentNotRefundable
	}
	err = tx.QueryRow(ctx, `INSERT INTO payment_refund(payment_id,idempotency_key,amount_kopecks,currency,status,reason,initiated_by)
		VALUES($1,$2::uuid,$3,$4,'pending',$5,NULLIF($6,0)) RETURNING id,payment_id,COALESCE(provider_refund_id,''),idempotency_key::text,amount_kopecks,currency,status,reason,COALESCE(initiated_by,0)`,
		payment.ID, key, amount, payment.Currency, reason, by).Scan(&existing.ID, &existing.PaymentID, &existing.ProviderRefundID, &existing.IdempotencyKey, &existing.AmountKopecks, &existing.Currency, &existing.Status, &existing.Reason, &existing.InitiatedBy)
	if err != nil {
		return existing, err
	}
	receiptBytes, _ := json.Marshal(receipt)
	contact := receipt.Customer.Email
	if contact == "" {
		contact = receipt.Customer.Phone
	}
	if _, err = tx.Exec(ctx, `INSERT INTO payment_receipt(payment_id,refund_id,operation,status,customer_contact_masked,payload) VALUES($1,$2,'refund','pending',$3,$4)`, payment.ID, existing.ID, maskContact(contact), receiptBytes); err != nil {
		return existing, err
	}
	if err = tx.Commit(ctx); err != nil {
		return existing, err
	}
	return existing, nil
}

func (r *PaymentRepo) AttachProviderRefund(ctx context.Context, id int64, verified domain.ProviderRefund) (domain.PaymentRefund, error) {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return domain.PaymentRefund{}, err
	}
	defer tx.Rollback(ctx)
	var out domain.PaymentRefund
	var providerPaymentID string
	err = tx.QueryRow(ctx, `SELECT pr.id,pr.payment_id,COALESCE(pr.provider_refund_id,''),pr.idempotency_key::text,pr.amount_kopecks,pr.currency,pr.status,pr.reason,COALESCE(pr.initiated_by,0),COALESCE(p.provider_payment_id,'') FROM payment_refund pr JOIN payment p ON p.id=pr.payment_id WHERE pr.id=$1 FOR UPDATE`, id).
		Scan(&out.ID, &out.PaymentID, &out.ProviderRefundID, &out.IdempotencyKey, &out.AmountKopecks, &out.Currency, &out.Status, &out.Reason, &out.InitiatedBy, &providerPaymentID)
	if err != nil {
		return out, err
	}
	if verified.PaymentID != providerPaymentID || verified.Money.AmountKopecks != out.AmountKopecks || verified.Money.Currency != out.Currency {
		return out, domain.ErrPaymentConflict
	}
	err = tx.QueryRow(ctx, `UPDATE payment_refund SET provider_refund_id=$2,updated_at=now() WHERE id=$1
		RETURNING id,payment_id,COALESCE(provider_refund_id,''),idempotency_key::text,amount_kopecks,currency,status,reason,COALESCE(initiated_by,0)`, id, verified.ID).
		Scan(&out.ID, &out.PaymentID, &out.ProviderRefundID, &out.IdempotencyKey, &out.AmountKopecks, &out.Currency, &out.Status, &out.Reason, &out.InitiatedBy)
	if err != nil {
		return out, err
	}
	status := verified.ReceiptRegistration
	if status == "" {
		status = "submitted"
	}
	if _, err = tx.Exec(ctx, `UPDATE payment_receipt SET status=$2,updated_at=now() WHERE refund_id=$1`, id, status); err != nil {
		return out, err
	}
	if err = tx.Commit(ctx); err != nil {
		return out, err
	}
	return out, nil
}

func (r *PaymentRepo) ApplyVerifiedRefund(ctx context.Context, verified domain.ProviderRefund) (domain.PaymentRefund, bool, error) {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return domain.PaymentRefund{}, false, err
	}
	defer tx.Rollback(ctx)
	var out domain.PaymentRefund
	var providerPaymentID string
	err = tx.QueryRow(ctx, `SELECT id,payment_id,COALESCE(provider_refund_id,''),idempotency_key::text,amount_kopecks,currency,status,reason,COALESCE(initiated_by,0)
		,COALESCE((SELECT provider_payment_id FROM payment WHERE id=payment_refund.payment_id),'') FROM payment_refund WHERE provider_refund_id=$1 FOR UPDATE`, verified.ID).Scan(&out.ID, &out.PaymentID, &out.ProviderRefundID, &out.IdempotencyKey, &out.AmountKopecks, &out.Currency, &out.Status, &out.Reason, &out.InitiatedBy, &providerPaymentID)
	if errors.Is(err, pgx.ErrNoRows) {
		return out, false, domain.ErrPaymentNotFound
	}
	if err != nil {
		return out, false, err
	}
	if verified.PaymentID != providerPaymentID || out.AmountKopecks != verified.Money.AmountKopecks || out.Currency != verified.Money.Currency {
		return out, false, domain.ErrPaymentConflict
	}
	if verified.ReceiptRegistration != "" {
		if _, err = tx.Exec(ctx, `UPDATE payment_receipt SET status=$2::varchar,registered_at=CASE WHEN $2::text='succeeded' THEN now() ELSE registered_at END,updated_at=now() WHERE refund_id=$1`, out.ID, verified.ReceiptRegistration); err != nil {
			return out, false, err
		}
	}
	changed := out.Status != verified.Status
	if changed {
		_, err = tx.Exec(ctx, `UPDATE payment_refund SET status=$2::varchar,succeeded_at=CASE WHEN $2::text='succeeded' THEN now() ELSE succeeded_at END,
			canceled_at=CASE WHEN $2::text='canceled' THEN now() ELSE canceled_at END,updated_at=now() WHERE id=$1`, out.ID, verified.Status)
		if err != nil {
			return out, false, err
		}
		if verified.Status == domain.RefundStatusSucceeded {
			_, err = tx.Exec(ctx, `UPDATE payment SET refunded_amount_kopecks=refunded_amount_kopecks+$2,updated_at=now() WHERE id=$1`, out.PaymentID, out.AmountKopecks)
			if err != nil {
				return out, false, err
			}
		}
	}
	if err = tx.Commit(ctx); err != nil {
		return out, false, err
	}
	out.Status = verified.Status
	return out, changed, nil
}

type rowScanner interface{ Scan(...any) error }

func scanPayment(row rowScanner) (domain.Payment, error) {
	var p domain.Payment
	var metadata []byte
	err := row.Scan(&p.ID, &p.UserID, &p.Provider, &p.ProviderPaymentID, &p.Purpose, &p.ProductCode, &p.AmountKopecks, &p.Currency, &p.Status, &p.ConfirmationURL, &p.Description, &p.IdempotencyKey, &metadata, &p.RefundedAmountKopecks, &p.CreatedAt, &p.UpdatedAt, &p.PaidAt, &p.CanceledAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return p, domain.ErrPaymentNotFound
	}
	if err != nil {
		return p, err
	}
	_ = json.Unmarshal(metadata, &p.Metadata)
	return p, nil
}
func getPaymentByIdempotency(ctx context.Context, tx pgx.Tx, key string) (domain.Payment, error) {
	return scanPayment(tx.QueryRow(ctx, `SELECT id,COALESCE(user_id,0),provider,COALESCE(provider_payment_id,''),purpose,COALESCE(product_code,''),amount_kopecks,currency,status,COALESCE(confirmation_url,''),COALESCE(description,''),COALESCE(idempotency_key::text,''),metadata,refunded_amount_kopecks,created_at,updated_at,paid_at,canceled_at FROM payment WHERE idempotency_key=$1::uuid FOR UPDATE`, key))
}
func getPaymentForUpdate(ctx context.Context, tx pgx.Tx, id int64) (domain.Payment, error) {
	return scanPayment(tx.QueryRow(ctx, `SELECT id,COALESCE(user_id,0),provider,COALESCE(provider_payment_id,''),purpose,COALESCE(product_code,''),amount_kopecks,currency,status,COALESCE(confirmation_url,''),COALESCE(description,''),COALESCE(idempotency_key::text,''),metadata,refunded_amount_kopecks,created_at,updated_at,paid_at,canceled_at FROM payment WHERE id=$1 FOR UPDATE`, id))
}
func verifyProviderPayment(local domain.Payment, verified domain.ProviderPayment) error {
	if verified.ID == "" || local.AmountKopecks != verified.Money.AmountKopecks || local.Currency != verified.Money.Currency {
		return domain.ErrPaymentConflict
	}
	if id := verified.Metadata["local_payment_id"]; id != "" && id != strconv.FormatInt(local.ID, 10) {
		return domain.ErrPaymentConflict
	}
	if purpose := verified.Metadata["purpose"]; purpose != "" && purpose != local.Purpose {
		return domain.ErrPaymentConflict
	}
	return nil
}
func validPaymentTransition(from, to string) bool {
	if from == to {
		return true
	}
	switch from {
	case domain.PaymentStatusPending:
		return to == domain.PaymentStatusWaitingForCapture || to == domain.PaymentStatusSucceeded || to == domain.PaymentStatusCanceled
	case domain.PaymentStatusWaitingForCapture:
		return to == domain.PaymentStatusSucceeded || to == domain.PaymentStatusCanceled
	default:
		return false
	}
}
func maskContact(v string) string {
	if len(v) < 5 {
		return "***"
	}
	return v[:2] + "***" + v[len(v)-2:]
}
