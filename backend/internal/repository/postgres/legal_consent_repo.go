package postgres

import (
	"context"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/TrollLOLik/sutki/backend/internal/domain"
)

type LegalConsentRepo struct {
	pool *pgxpool.Pool
}

func NewLegalConsentRepo(pool *pgxpool.Pool) *LegalConsentRepo {
	return &LegalConsentRepo{pool: pool}
}

func (r *LegalConsentRepo) AcceptRegistration(ctx context.Context, consents []domain.LegalConsent) error {
	if len(consents) == 0 {
		return nil
	}
	tx, err := r.pool.BeginTx(ctx, pgx.TxOptions{})
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	registrationID := consents[0].RegistrationID
	if _, err = tx.Exec(ctx, `SELECT pg_advisory_xact_lock(hashtext($1))`, registrationID); err != nil {
		return err
	}
	for _, consent := range consents {
		_, err = tx.Exec(ctx, `
			UPDATE legal_consent
			SET revoked_at = $5, revocation_reason = 'superseded'
			WHERE registration_id = $1 AND document_type = $2
			  AND user_id IS NULL AND revoked_at IS NULL
			  AND (document_version <> $3 OR document_sha256 <> $4)`,
			consent.RegistrationID, consent.Document.Type, consent.Document.Version,
			consent.Document.SHA256, consent.AcceptedAt,
		)
		if err != nil {
			return err
		}
		_, err = tx.Exec(ctx, `
			INSERT INTO legal_consent (
				registration_id, document_type, document_version, document_sha256,
				accepted_at, ip_address, user_agent, app_version, source
			)
			VALUES ($1, $2, $3, $4, $5, NULLIF($6, '')::inet, NULLIF($7, ''), NULLIF($8, ''), $9)
			ON CONFLICT DO NOTHING`,
			consent.RegistrationID, consent.Document.Type, consent.Document.Version,
			consent.Document.SHA256, consent.AcceptedAt, stringValue(consent.IPAddress),
			stringValue(consent.UserAgent), stringValue(consent.AppVersion), consent.Source,
		)
		if err != nil {
			return err
		}
	}
	return tx.Commit(ctx)
}

func (r *LegalConsentRepo) BindRegistration(ctx context.Context, registrationID string, userID int32) error {
	tx, err := r.pool.BeginTx(ctx, pgx.TxOptions{})
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback(ctx) }()
	if _, err = tx.Exec(ctx, `SELECT pg_advisory_xact_lock(hashtext($1))`, registrationID); err != nil {
		return err
	}
	if _, err = tx.Exec(ctx, `SELECT pg_advisory_xact_lock($1)`, userID); err != nil {
		return err
	}
	// Keep an older active acceptance already bound to the account and remove
	// only an exact duplicate anonymous row. A newly accepted document version
	// supersedes the older active acceptance while preserving it in history.
	if _, err = tx.Exec(ctx, `
		DELETE FROM legal_consent anonymous
		WHERE anonymous.registration_id = $1
		  AND anonymous.user_id IS NULL
		  AND anonymous.revoked_at IS NULL
		  AND EXISTS (
			SELECT 1 FROM legal_consent bound
			WHERE bound.user_id = $2
			  AND bound.document_type = anonymous.document_type
			  AND bound.document_version = anonymous.document_version
			  AND bound.document_sha256 = anonymous.document_sha256
			  AND bound.revoked_at IS NULL
		  )`, registrationID, userID); err != nil {
		return err
	}
	if _, err = tx.Exec(ctx, `
		UPDATE legal_consent bound
		SET revoked_at = now(), revocation_reason = 'superseded'
		WHERE bound.user_id = $2 AND bound.revoked_at IS NULL
		  AND EXISTS (
			SELECT 1 FROM legal_consent anonymous
			WHERE anonymous.registration_id = $1
			  AND anonymous.user_id IS NULL
			  AND anonymous.revoked_at IS NULL
			  AND anonymous.document_type = bound.document_type
			  AND (anonymous.document_version <> bound.document_version
			       OR anonymous.document_sha256 <> bound.document_sha256)
		  )`, registrationID, userID); err != nil {
		return err
	}
	if _, err = tx.Exec(ctx, `
		UPDATE legal_consent
		SET user_id = $2
		WHERE registration_id = $1 AND user_id IS NULL AND revoked_at IS NULL`, registrationID, userID); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

func (r *LegalConsentRepo) AcceptForUser(ctx context.Context, consent domain.LegalConsent) error {
	if consent.UserID == nil {
		return fmt.Errorf("legal consent user id is required")
	}
	tx, err := r.pool.BeginTx(ctx, pgx.TxOptions{})
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback(ctx) }()
	if _, err = tx.Exec(ctx, `SELECT pg_advisory_xact_lock($1)`, *consent.UserID); err != nil {
		return err
	}
	if _, err = tx.Exec(ctx, `
		UPDATE legal_consent
		SET revoked_at = $5, revocation_reason = 'superseded'
		WHERE user_id = $1 AND document_type = $2 AND revoked_at IS NULL
		  AND (document_version <> $3 OR document_sha256 <> $4)`,
		*consent.UserID, consent.Document.Type, consent.Document.Version,
		consent.Document.SHA256, consent.AcceptedAt); err != nil {
		return err
	}
	if _, err = tx.Exec(ctx, `
		INSERT INTO legal_consent (
			user_id, registration_id, document_type, document_version, document_sha256,
			accepted_at, ip_address, user_agent, app_version, source
		)
		VALUES ($1, $2, $3, $4, $5, $6, NULLIF($7, '')::inet, NULLIF($8, ''), NULLIF($9, ''), $10)
		ON CONFLICT DO NOTHING`, *consent.UserID, consent.RegistrationID, consent.Document.Type,
		consent.Document.Version, consent.Document.SHA256, consent.AcceptedAt,
		stringValue(consent.IPAddress), stringValue(consent.UserAgent),
		stringValue(consent.AppVersion), consent.Source); err != nil {
		return err
	}
	if consent.Document.Type == domain.LegalDocumentDataDissemination {
		if _, err = tx.Exec(ctx, `UPDATE "user" SET public_profile_visible = true WHERE id = $1`, *consent.UserID); err != nil {
			return err
		}
	}
	return tx.Commit(ctx)
}

func (r *LegalConsentRepo) HasActive(ctx context.Context, userID int32, document domain.LegalDocument) (bool, error) {
	var exists bool
	err := r.pool.QueryRow(ctx, `
		SELECT EXISTS (
			SELECT 1 FROM legal_consent
			WHERE user_id = $1
			  AND document_type = $2
			  AND document_version = $3
			  AND document_sha256 = $4
			  AND revoked_at IS NULL
		)`, userID, document.Type, document.Version, document.SHA256).Scan(&exists)
	return exists, err
}

func (r *LegalConsentRepo) PublicProfileVisible(ctx context.Context, userID int32) (bool, error) {
	var visible bool
	err := r.pool.QueryRow(ctx, `SELECT public_profile_visible FROM "user" WHERE id = $1 AND deleted = false`, userID).Scan(&visible)
	if err != nil && err == pgx.ErrNoRows {
		return false, domain.ErrNotFound
	}
	return visible, err
}

func (r *LegalConsentRepo) Revoke(ctx context.Context, userID int32, documentType, reason string, at time.Time) error {
	tx, err := r.pool.BeginTx(ctx, pgx.TxOptions{})
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback(ctx) }()
	if _, err = tx.Exec(ctx, `SELECT pg_advisory_xact_lock($1)`, userID); err != nil {
		return err
	}
	tag, err := tx.Exec(ctx, `
		UPDATE legal_consent
		SET revoked_at = $3, revocation_reason = NULLIF($4, '')
		WHERE user_id = $1 AND document_type = $2 AND revoked_at IS NULL`, userID, documentType, at, reason)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return domain.ErrNotFound
	}
	if documentType == domain.LegalDocumentDataDissemination {
		if _, err = tx.Exec(ctx, `UPDATE "user" SET public_profile_visible = false WHERE id = $1`, userID); err != nil {
			return err
		}
		// Moderation finalization locks the queue row before changing the house.
		// Use the same order here so a verdict already in flight cannot publish
		// the listing after the owner has withdrawn dissemination consent.
		if _, err = tx.Exec(ctx, `
			UPDATE moderation_verdict verdict
			SET status = 'failed',
			    last_error = 'data dissemination consent revoked',
			    updated_at = $2
			FROM house
			WHERE verdict.house_id = house.id
			  AND house.owner_id = $1
			  AND verdict.status IN ('queued', 'processing')`, userID, at); err != nil {
			return err
		}
		if _, err = tx.Exec(ctx, `
			UPDATE house
			SET status = 'unpublished', rejection_reason = NULL, updated_at = $2
			WHERE owner_id = $1
			  AND deleted = false
			  AND status IN ('active', 'pending_moderation', 'moderation_review')`, userID, at); err != nil {
			return err
		}
	}
	return tx.Commit(ctx)
}

func stringValue(value *string) string {
	if value == nil {
		return ""
	}
	return *value
}
