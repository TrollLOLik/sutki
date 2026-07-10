package postgres

import (
	"context"
	"errors"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/TrollLOLik/sutki/backend/internal/domain"
)

type PhoneChallengeRepo struct{ pool *pgxpool.Pool }

func NewPhoneChallengeRepo(pool *pgxpool.Pool) *PhoneChallengeRepo {
	return &PhoneChallengeRepo{pool: pool}
}

func (r *PhoneChallengeRepo) ReapStale(ctx context.Context, now time.Time) error {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	if _, err = tx.Exec(ctx, `UPDATE phone_auth_delivery d SET status='failed', error_code='pending_timeout', error_message='provider response timeout', updated_at=$1 FROM phone_auth_challenge c WHERE d.challenge_id=c.id AND d.status='pending' AND c.status='delivery_pending' AND c.pending_until <= $1`, now); err != nil {
		return err
	}
	if _, err = tx.Exec(ctx, `UPDATE phone_auth_challenge SET status=CASE WHEN code_hash IS NULL THEN 'delivery_failed' ELSE 'ready_for_verification' END, pending_until=NULL, updated_at=$1 WHERE status='delivery_pending' AND pending_until <= $1`, now); err != nil {
		return err
	}
	if _, err = tx.Exec(ctx, `UPDATE phone_auth_challenge SET status='expired', updated_at=$1 WHERE status='ready_for_verification' AND expires_at <= $1`, now); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

const phoneChallengeColumns = `id::text, phone_normalized, purpose, user_id, code_hash, code_length, status, delivery_mode, pending_until, expires_at, attempts, created_at, updated_at`

func scanPhoneChallenge(row pgx.Row) (domain.PhoneChallenge, error) {
	var c domain.PhoneChallenge
	err := row.Scan(&c.ID, &c.PhoneNormalized, &c.Purpose, &c.UserID, &c.CodeHash, &c.CodeLength, &c.Status, &c.DeliveryMode, &c.PendingUntil, &c.ExpiresAt, &c.Attempts, &c.CreatedAt, &c.UpdatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return domain.PhoneChallenge{}, domain.ErrNotFound
	}
	return c, err
}

func (r *PhoneChallengeRepo) GetActive(ctx context.Context, phone, purpose string) (domain.PhoneChallenge, error) {
	return scanPhoneChallenge(r.pool.QueryRow(ctx, `SELECT `+phoneChallengeColumns+` FROM phone_auth_challenge WHERE phone_normalized=$1 AND purpose=$2 AND status IN ('delivery_pending','ready_for_verification') LIMIT 1`, phone, purpose))
}

func (r *PhoneChallengeRepo) GetByID(ctx context.Context, id string) (domain.PhoneChallenge, error) {
	return scanPhoneChallenge(r.pool.QueryRow(ctx, `SELECT `+phoneChallengeColumns+` FROM phone_auth_challenge WHERE id=$1::uuid`, id))
}

func (r *PhoneChallengeRepo) CreatePending(ctx context.Context, c domain.PhoneChallenge, d domain.PhoneChallengeDelivery) error {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	_, err = tx.Exec(ctx, `INSERT INTO phone_auth_challenge (id,phone_normalized,purpose,user_id,code_length,status,delivery_mode,pending_until,expires_at,attempts,created_at,updated_at) VALUES ($1::uuid,$2,$3,$4,$5,$6,$7,$8,$9,0,$10,$10)`, c.ID, c.PhoneNormalized, c.Purpose, c.UserID, c.CodeLength, c.Status, c.DeliveryMode, c.PendingUntil, c.ExpiresAt, c.CreatedAt)
	if err != nil {
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) && pgErr.Code == "23505" {
			return domain.ErrPhoneChallengeActive
		}
		return err
	}
	if _, err = tx.Exec(ctx, `INSERT INTO phone_auth_delivery (challenge_id,provider,mode,idempotency_id,status) VALUES ($1::uuid,$2,$3,$4::uuid,'pending')`, c.ID, d.Provider, d.Mode, d.IdempotencyID); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

func scanPhoneDelivery(row pgx.Row) (domain.PhoneChallengeDelivery, error) {
	var d domain.PhoneChallengeDelivery
	err := row.Scan(&d.ID, &d.ChallengeID, &d.Provider, &d.Mode, &d.IdempotencyID, &d.ProviderDeliveryID, &d.Status, &d.ErrorCode, &d.ErrorMessage, &d.CreatedAt, &d.UpdatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return domain.PhoneChallengeDelivery{}, domain.ErrNotFound
	}
	return d, err
}

func (r *PhoneChallengeRepo) GetPendingDelivery(ctx context.Context, challengeID string) (domain.PhoneChallengeDelivery, error) {
	return scanPhoneDelivery(r.pool.QueryRow(ctx, `SELECT id,challenge_id::text,provider,mode,idempotency_id::text,provider_delivery_id,status,error_code,error_message,created_at,updated_at FROM phone_auth_delivery WHERE challenge_id=$1::uuid AND status='pending' ORDER BY created_at DESC LIMIT 1`, challengeID))
}

func (r *PhoneChallengeRepo) BeginDelivery(ctx context.Context, challengeID, provider, mode, idempotencyID string, pendingUntil time.Time) (domain.PhoneChallengeDelivery, error) {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return domain.PhoneChallengeDelivery{}, err
	}
	defer tx.Rollback(ctx)
	result, err := tx.Exec(ctx, `UPDATE phone_auth_challenge SET status='delivery_pending',delivery_mode=$2,pending_until=$3,updated_at=now() WHERE id=$1::uuid AND status='ready_for_verification'`, challengeID, mode, pendingUntil)
	if err != nil {
		return domain.PhoneChallengeDelivery{}, err
	}
	if result.RowsAffected() != 1 {
		return domain.PhoneChallengeDelivery{}, domain.ErrCodeInvalid
	}
	var d domain.PhoneChallengeDelivery
	err = tx.QueryRow(ctx, `INSERT INTO phone_auth_delivery (challenge_id,provider,mode,idempotency_id,status) VALUES ($1::uuid,$2,$3,$4::uuid,'pending') RETURNING id,challenge_id::text,provider,mode,idempotency_id::text,provider_delivery_id,status,error_code,error_message,created_at,updated_at`, challengeID, provider, mode, idempotencyID).Scan(&d.ID, &d.ChallengeID, &d.Provider, &d.Mode, &d.IdempotencyID, &d.ProviderDeliveryID, &d.Status, &d.ErrorCode, &d.ErrorMessage, &d.CreatedAt, &d.UpdatedAt)
	if err != nil {
		return domain.PhoneChallengeDelivery{}, err
	}
	if err = tx.Commit(ctx); err != nil {
		return domain.PhoneChallengeDelivery{}, err
	}
	return d, nil
}

func (r *PhoneChallengeRepo) MarkReady(ctx context.Context, id, codeHash string, codeLength int32, mode, providerDeliveryID string, expiresAt time.Time) error {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	if _, err = tx.Exec(ctx, `UPDATE phone_auth_delivery SET status='sent',provider_delivery_id=$2,updated_at=now() WHERE id=(SELECT id FROM phone_auth_delivery WHERE challenge_id=$1::uuid AND status='pending' ORDER BY created_at DESC LIMIT 1)`, id, providerDeliveryID); err != nil {
		return err
	}
	if _, err = tx.Exec(ctx, `UPDATE phone_auth_challenge SET code_hash=$2,code_length=$3,status='ready_for_verification',delivery_mode=$4,pending_until=NULL,expires_at=$5,updated_at=now() WHERE id=$1::uuid AND status='delivery_pending'`, id, codeHash, codeLength, mode, expiresAt); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

func (r *PhoneChallengeRepo) MarkDeliveryFailed(ctx context.Context, id string, errorCode, errorMessage *string) error {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	if _, err = tx.Exec(ctx, `UPDATE phone_auth_delivery SET status='failed',error_code=$2,error_message=$3,updated_at=now() WHERE id=(SELECT id FROM phone_auth_delivery WHERE challenge_id=$1::uuid AND status='pending' ORDER BY created_at DESC LIMIT 1)`, id, errorCode, errorMessage); err != nil {
		return err
	}
	if _, err = tx.Exec(ctx, `UPDATE phone_auth_challenge SET status=CASE WHEN code_hash IS NULL THEN 'delivery_failed' ELSE 'ready_for_verification' END,pending_until=NULL,updated_at=now() WHERE id=$1::uuid AND status='delivery_pending'`, id); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

func (r *PhoneChallengeRepo) IncrementAttempts(ctx context.Context, id string) error {
	_, err := r.pool.Exec(ctx, `UPDATE phone_auth_challenge SET attempts=attempts+1,updated_at=now() WHERE id=$1::uuid`, id)
	return err
}
func (r *PhoneChallengeRepo) MarkVerified(ctx context.Context, id string) error {
	_, err := r.pool.Exec(ctx, `UPDATE phone_auth_challenge SET status='verified',code_hash=NULL,updated_at=now() WHERE id=$1::uuid`, id)
	return err
}
func (r *PhoneChallengeRepo) MarkExpired(ctx context.Context, id string) error {
	_, err := r.pool.Exec(ctx, `UPDATE phone_auth_challenge SET status='expired',code_hash=NULL,pending_until=NULL,updated_at=now() WHERE id=$1::uuid`, id)
	return err
}
