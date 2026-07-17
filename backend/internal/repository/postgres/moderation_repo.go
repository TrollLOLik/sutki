package postgres

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/TrollLOLik/sutki/backend/internal/domain"
)

// ModerationRepo implements domain.ModerationRepository on Postgres.
// Raw SQL (not sqlc): the verdict table doubles as a work queue and needs
// FOR UPDATE SKIP LOCKED claiming, jsonb writes, and bit-count matching that
// sqlc's codegen handles poorly.
type ModerationRepo struct {
	pool *pgxpool.Pool
}

func NewModerationRepo(pool *pgxpool.Pool) *ModerationRepo {
	return &ModerationRepo{pool: pool}
}

func (r *ModerationRepo) EnqueueLLM(ctx context.Context, houseID int32, contentHash string) (bool, error) {
	tag, err := r.pool.Exec(ctx, `
		INSERT INTO moderation_verdict (house_id, content_hash, source, status)
		VALUES ($1, $2, 'llm', 'queued')
		ON CONFLICT (house_id, content_hash) WHERE source = 'llm' DO NOTHING
	`, houseID, contentHash)
	if err != nil {
		return false, fmt.Errorf("enqueue llm moderation: %w", err)
	}
	return tag.RowsAffected() > 0, nil
}

func (r *ModerationRepo) RecordVerdict(ctx context.Context, v domain.ModerationVerdict, rawResponse []byte) error {
	_, err := r.pool.Exec(ctx, `
		INSERT INTO moderation_verdict
			(house_id, content_hash, source, decision, category, reason, confidence, raw_response, moderator_id, status)
		VALUES ($1, $2, $3, $4, NULLIF($5, ''), NULLIF($6, ''), NULLIF($7, 0.0), $8, $9, 'done')
	`, v.HouseID, v.ContentHash, v.Source, v.Decision, v.Category, v.Reason, v.Confidence, rawResponse, v.ModeratorID)
	if err != nil {
		return fmt.Errorf("record moderation verdict: %w", err)
	}
	return nil
}

func (r *ModerationRepo) DueBatch(ctx context.Context, limit int32) ([]domain.ModerationVerdict, error) {
	rows, err := r.pool.Query(ctx, `
		UPDATE moderation_verdict
		SET status = 'processing', attempts = attempts + 1, updated_at = now()
		WHERE id IN (
			SELECT id FROM moderation_verdict
			WHERE status IN ('queued', 'processing')
			  AND source = 'llm'
			  AND next_attempt_at <= now()
			ORDER BY next_attempt_at
			LIMIT $1
			FOR UPDATE SKIP LOCKED
		)
		RETURNING id, house_id, content_hash, attempts
	`, limit)
	if err != nil {
		return nil, fmt.Errorf("claim moderation batch: %w", err)
	}
	defer rows.Close()

	var out []domain.ModerationVerdict
	for rows.Next() {
		v := domain.ModerationVerdict{Source: domain.ModerationSourceLLM, Status: domain.ModerationProcessing}
		if err := rows.Scan(&v.ID, &v.HouseID, &v.ContentHash, &v.Attempts); err != nil {
			return nil, err
		}
		out = append(out, v)
	}
	return out, rows.Err()
}

func (r *ModerationRepo) CompleteLLM(ctx context.Context, id int64, decision, category, reason string, confidence float32, rawResponse []byte) error {
	_, err := r.pool.Exec(ctx, `
		UPDATE moderation_verdict
		SET status = 'done', decision = $2, category = NULLIF($3, ''), reason = NULLIF($4, ''),
		    confidence = $5, raw_response = $6, updated_at = now()
		WHERE id = $1
	`, id, decision, category, reason, confidence, rawResponse)
	if err != nil {
		return fmt.Errorf("complete llm verdict %d: %w", id, err)
	}
	return nil
}

func (r *ModerationRepo) RescheduleLLM(ctx context.Context, id int64, nextAttempt time.Time, lastError string) error {
	_, err := r.pool.Exec(ctx, `
		UPDATE moderation_verdict
		SET status = 'queued', next_attempt_at = $2, last_error = left($3, 2000), updated_at = now()
		WHERE id = $1
	`, id, nextAttempt, lastError)
	return err
}

func (r *ModerationRepo) FailLLM(ctx context.Context, id int64, lastError string) error {
	_, err := r.pool.Exec(ctx, `
		UPDATE moderation_verdict
		SET status = 'failed', last_error = left($2, 2000), updated_at = now()
		WHERE id = $1
	`, id, lastError)
	return err
}

func (r *ModerationRepo) SetHouseModeration(ctx context.Context, houseID int32, status, rejectionReason string) error {
	_, err := r.pool.Exec(ctx, `
		UPDATE house
		SET status = $2, rejection_reason = NULLIF(left($3, 2000), ''), updated_at = now()
		WHERE id = $1
	`, houseID, status, rejectionReason)
	if err != nil {
		return fmt.Errorf("set house %d moderation status %s: %w", houseID, status, err)
	}
	return nil
}

func (r *ModerationRepo) CountRecentRejects(ctx context.Context, ownerID int32, since time.Time) (int64, error) {
	var n int64
	err := r.pool.QueryRow(ctx, `
		SELECT count(*)
		FROM moderation_verdict mv
		JOIN house h ON h.id = mv.house_id
		WHERE h.owner_id = $1
		  AND mv.decision = 'reject'
		  AND mv.created_at >= $2
	`, ownerID, since).Scan(&n)
	return n, err
}

func (r *ModerationRepo) CountReviewQueue(ctx context.Context) (int64, error) {
	var n int64
	err := r.pool.QueryRow(ctx, `
		SELECT count(*) FROM house WHERE status = 'moderation_review' AND deleted = false
	`).Scan(&n)
	return n, err
}

func (r *ModerationRepo) CountOwnerSubmissions(ctx context.Context, ownerID int32, since time.Time) (int64, error) {
	var n int64
	err := r.pool.QueryRow(ctx, `
		SELECT count(*)
		FROM moderation_verdict mv
		JOIN house h ON h.id = mv.house_id
		WHERE h.owner_id = $1 AND mv.created_at >= $2
	`, ownerID, since).Scan(&n)
	return n, err
}

func (r *ModerationRepo) FindDuplicateText(ctx context.Context, houseID, ownerID int32, contentHash string) (bool, error) {
	var exists bool
	err := r.pool.QueryRow(ctx, `
		SELECT EXISTS (
			SELECT 1
			FROM moderation_verdict mv
			JOIN house h ON h.id = mv.house_id
			WHERE mv.content_hash = $3
			  AND mv.house_id != $1
			  AND h.owner_id != $2
			  AND h.status = 'active'
			  AND h.deleted = false
		)
	`, houseID, ownerID, contentHash).Scan(&exists)
	return exists, err
}

func (r *ModerationRepo) SavePhotoHash(ctx context.Context, houseID int32, mediaKey string, phash uint64) error {
	_, err := r.pool.Exec(ctx, `
		INSERT INTO photo_hash (house_id, media_key, phash)
		VALUES ($1, $2, $3)
		ON CONFLICT (house_id, media_key) DO UPDATE SET phash = EXCLUDED.phash
	`, houseID, mediaKey, int64(phash))
	return err
}

func (r *ModerationRepo) FindSimilarPhoto(ctx context.Context, houseID, ownerID int32, phash uint64, maxDistance int) (bool, error) {
	// Hamming distance via bit_count(a # b) — Postgres 14+.
	var exists bool
	err := r.pool.QueryRow(ctx, `
		SELECT EXISTS (
			SELECT 1
			FROM photo_hash ph
			JOIN house h ON h.id = ph.house_id
			WHERE ph.house_id != $1
			  AND h.owner_id != $2
			  AND h.status = 'active'
			  AND h.deleted = false
			  AND bit_count((ph.phash # $3)::bit(64)) <= $4
		)
	`, houseID, ownerID, int64(phash), maxDistance).Scan(&exists)
	return exists, err
}

func (r *ModerationRepo) GetHouseForModeration(ctx context.Context, houseID int32) (domain.ModerationHouse, error) {
	var h domain.ModerationHouse
	var poisBytes []byte
	err := r.pool.QueryRow(ctx, `
		SELECT h.id, h.owner_id, COALESCE(u.email, ''), h.status,
		       COALESCE(h.country, ''), h.street, h.house_number, COALESCE(h.number_room, ''),
		       COALESCE(h.description, ''), h.price,
		       COALESCE(h.count_room, ''), h.area, h.max_guests,
		       COALESCE(h.smoking_allowed, ''), COALESCE(h.pets_allowed, ''),
		       COALESCE(h.children_allowed, ''), COALESCE(h.events_allowed, ''),
		       COALESCE((
		           SELECT string_agg(s.name, ', ' ORDER BY s.name)
		           FROM house_house_service hhs
		           JOIN service s ON s.id = hhs.service_id
		           WHERE hhs.house_id = h.id
		       ), ''),
		       COALESCE((
		           SELECT string_agg(c.name, ', ' ORDER BY c.name)
		           FROM house_house_category hhc
		           JOIN house_category c ON c.id = hhc.house_category_id
		           WHERE hhc.house_id = h.id
		       ), ''),
		       COALESCE(h.pois, '[]'::jsonb)
		FROM house h
		JOIN "user" u ON u.id = h.owner_id
		WHERE h.id = $1 AND h.deleted = false
	`, houseID).Scan(&h.ID, &h.OwnerID, &h.OwnerEmail, &h.Status, &h.City, &h.Street, &h.HouseNumber, &h.NumberRoom, &h.Description, &h.Price,
		&h.CountRoom, &h.Area, &h.MaxGuests, &h.SmokingAllowed, &h.PetsAllowed, &h.ChildrenAllowed, &h.EventsAllowed, &h.ServicesList,
		&h.CategoriesList, &poisBytes)
	if errors.Is(err, pgx.ErrNoRows) {
		return domain.ModerationHouse{}, domain.ErrNotFound
	}
	if err == nil && len(poisBytes) > 0 {
		_ = json.Unmarshal(poisBytes, &h.POIs)
	}
	return h, err
}
