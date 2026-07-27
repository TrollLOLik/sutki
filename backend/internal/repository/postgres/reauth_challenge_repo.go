package postgres

import (
	"context"
	"errors"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/TrollLOLik/sutki/backend/internal/domain"
)

// ReauthChallengeRepo persists re-authentication attempts and the proofs they
// produce, and owns the transaction that turns a proof into a factor change.
type ReauthChallengeRepo struct{ pool *pgxpool.Pool }

func NewReauthChallengeRepo(pool *pgxpool.Pool) *ReauthChallengeRepo {
	return &ReauthChallengeRepo{pool: pool}
}

const reauthChallengeColumns = `id, user_id, purpose, factor, phone_challenge_id::text, token_hash, verified_at, expires_at, consumed_at, created_at`

func scanReauthChallenge(row pgx.Row) (domain.ReauthChallenge, error) {
	var c domain.ReauthChallenge
	err := row.Scan(&c.ID, &c.UserID, &c.Purpose, &c.Factor, &c.PhoneChallengeID,
		&c.TokenHash, &c.VerifiedAt, &c.ExpiresAt, &c.ConsumedAt, &c.CreatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return domain.ReauthChallenge{}, domain.ErrNotFound
	}
	return c, err
}

// Start records a re-authentication attempt, cancelling whatever the user had
// in flight. Purpose and factor are written here, at request time, and are the
// only source of truth for them afterwards.
func (r *ReauthChallengeRepo) Start(ctx context.Context, a domain.ReauthAttempt) (domain.ReauthChallenge, error) {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return domain.ReauthChallenge{}, err
	}
	defer tx.Rollback(ctx)
	// Serialize concurrent starts for the same user. Without it two
	// transactions each cancel only what their own snapshot could see and both
	// insert, leaving two live attempts — and the whole point of "one live
	// attempt" is that verification is unambiguous.
	if _, err = tx.Exec(ctx, `SELECT pg_advisory_xact_lock($1, 0)`, a.UserID); err != nil {
		return domain.ReauthChallenge{}, err
	}
	if _, err = tx.Exec(ctx, `UPDATE reauth_challenge SET consumed_at=$2 WHERE user_id=$1 AND consumed_at IS NULL`, a.UserID, a.Now); err != nil {
		return domain.ReauthChallenge{}, err
	}
	c, err := scanReauthChallenge(tx.QueryRow(ctx, `INSERT INTO reauth_challenge (user_id,purpose,factor,phone_challenge_id,expires_at)
VALUES ($1,$2,$3,$4::uuid,$5)
RETURNING `+reauthChallengeColumns, a.UserID, a.Purpose, a.Factor, a.PhoneChallengeID, a.ExpiresAt))
	if err != nil {
		return domain.ReauthChallenge{}, err
	}
	if err = tx.Commit(ctx); err != nil {
		return domain.ReauthChallenge{}, err
	}
	return c, nil
}

// Pending returns the user's live, not-yet-verified attempt. This is where
// verification reads the purpose and the phone challenge from, instead of
// trusting whatever the client puts in the request body.
func (r *ReauthChallengeRepo) Pending(ctx context.Context, userID int32, now time.Time) (domain.ReauthChallenge, error) {
	return scanReauthChallenge(r.pool.QueryRow(ctx, `SELECT `+reauthChallengeColumns+`
FROM reauth_challenge
WHERE user_id=$1 AND consumed_at IS NULL AND verified_at IS NULL AND expires_at > $2`, userID, now))
}

// MarkVerified attaches the proof to a verified attempt and extends it to the
// proof's lifetime. Guarded on verified_at IS NULL so a replayed verification
// cannot mint a second proof from one code.
func (r *ReauthChallengeRepo) MarkVerified(ctx context.Context, id int64, userID int32, tokenHash string, expiresAt, now time.Time) error {
	// user_id is in the predicate as well as the row id: an attempt id is a
	// small sequential integer, so a caller that ever passed the wrong one must
	// not be able to attach its proof to somebody else's live attempt.
	tag, err := r.pool.Exec(ctx, `UPDATE reauth_challenge
SET token_hash=$3, verified_at=$4, expires_at=$5
WHERE id=$1 AND user_id=$2 AND consumed_at IS NULL AND verified_at IS NULL`, id, userID, tokenHash, now, expiresAt)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return domain.ErrNotFound
	}
	return nil
}

// Get returns a live, verified, unspent proof WITHOUT spending it.
//
// Used at the request half of a change flow, which must confirm the caller
// holds a proof but must not burn it — the confirm half still needs it.
func (r *ReauthChallengeRepo) Get(ctx context.Context, tokenHash string, userID int32, purpose string, now time.Time) (domain.ReauthChallenge, error) {
	return scanReauthChallenge(r.pool.QueryRow(ctx, `SELECT `+reauthChallengeColumns+`
FROM reauth_challenge
WHERE token_hash=$1 AND user_id=$2 AND purpose=$3
  AND verified_at IS NOT NULL AND consumed_at IS NULL AND expires_at > $4`,
		tokenHash, userID, purpose, now))
}

// ConsumeAndRebind performs the entire factor change in ONE transaction: lock
// the user, let the caller decide which factor the account currently requires
// from the locked snapshot, spend the proof, apply the rebind, and revoke every
// other session.
//
// Doing it in one transaction is the point. Spending the proof in its own
// statement and then updating the user separately means a failed update leaves
// the proof burned and the factor unchanged — the user is locked out of their
// own change and has to re-authenticate, at the cost of another billable call.
// Here any error, including a factor mismatch, rolls the spend back with it.
//
// Session revocation joins the same transaction for the same reason: a factor
// change whose revocation failed silently would leave the sessions it was
// supposed to kill alive, which is precisely the compromise being defended
// against.
func (r *ReauthChallengeRepo) ConsumeAndRebind(ctx context.Context, req domain.ReauthRebind, designate func(domain.User) (string, error)) error {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	// Take the SAME advisory lock Start does, and take it first. Otherwise the
	// two transactions acquire "user" and reauth_challenge in opposite orders —
	// Start's INSERT grabs FOR KEY SHARE on the parent row through the foreign
	// key — and a resend racing a confirm deadlocks.
	if _, err = tx.Exec(ctx, `SELECT pg_advisory_xact_lock($1, 0)`, req.UserID); err != nil {
		return err
	}

	// Lock the account for the duration: the factor decision below must not be
	// made against a snapshot someone else is concurrently rebinding.
	var locked domain.User
	err = tx.QueryRow(ctx, `SELECT id, coalesce(email,''), coalesce(phone_normalized,''), phone_verified_at
FROM "user" WHERE id=$1 AND deleted=false FOR UPDATE`, req.UserID).
		Scan(&locked.ID, &locked.Email, &locked.PhoneNormalized, &locked.PhoneVerifiedAt)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return domain.ErrNotFound
		}
		return err
	}

	wantFactor, err := designate(locked)
	if err != nil {
		return err
	}

	var storedFactor string
	err = tx.QueryRow(ctx, `UPDATE reauth_challenge SET consumed_at=$4
WHERE token_hash=$1 AND user_id=$2 AND purpose=$3
  AND verified_at IS NOT NULL AND consumed_at IS NULL AND expires_at > $4
RETURNING factor`, req.TokenHash, req.UserID, req.Purpose, req.Now).Scan(&storedFactor)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return domain.ErrNotFound
		}
		return err
	}
	if storedFactor != wantFactor {
		// Rolls back the spend along with everything else, so a proof obtained
		// through a factor the account no longer designates is refused without
		// being destroyed.
		return domain.ErrReauthRequired
	}

	switch {
	case req.Phone != nil:
		if _, err = tx.Exec(ctx, `UPDATE "user" SET phone=$2, phone_normalized=$3, phone_verified_at=$4, updated_at=now()
WHERE id=$1 AND deleted=false`, req.UserID, req.Phone.Raw, req.Phone.Normalized, req.Phone.VerifiedAt); err != nil {
			return err
		}
	case req.Email != nil:
		if _, err = tx.Exec(ctx, `UPDATE "user" SET email=$2, updated_at=now() WHERE id=$1 AND deleted=false`,
			req.UserID, *req.Email); err != nil {
			return err
		}
	default:
		return errors.New("reauth rebind: neither phone nor email supplied")
	}

	if _, err = tx.Exec(ctx, `UPDATE refresh_token SET revoked_at=now()
WHERE user_id=$1 AND id <> $2 AND revoked_at IS NULL`, req.UserID, req.CurrentSessionID); err != nil {
		return err
	}

	return tx.Commit(ctx)
}

// DeleteExpired drops rows no longer usable. Spent and expired attempts are
// kept briefly so an operator investigating a takeover can still see the trail,
// then removed — otherwise the table grows without bound.
func (r *ReauthChallengeRepo) DeleteExpired(ctx context.Context, before time.Time) error {
	_, err := r.pool.Exec(ctx, `DELETE FROM reauth_challenge WHERE expires_at < $1`, before)
	return err
}
