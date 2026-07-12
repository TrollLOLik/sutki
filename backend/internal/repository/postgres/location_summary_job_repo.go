package postgres

import (
	"context"
	"encoding/json"
	"errors"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/TrollLOLik/sutki/backend/internal/domain"
)

const locationJobLease = 5 * time.Minute

type LocationSummaryJobRepo struct {
	pool *pgxpool.Pool
}

func NewLocationSummaryJobRepo(pool *pgxpool.Pool) *LocationSummaryJobRepo {
	return &LocationSummaryJobRepo{pool: pool}
}

var _ domain.LocationSummaryRepository = (*LocationSummaryJobRepo)(nil)

func (r *LocationSummaryJobRepo) Enqueue(ctx context.Context, houseID int32, city, street string, lat, lng *float64, pois []domain.HousePOI) error {
	poisBytes, err := json.Marshal(pois)
	if err != nil {
		return err
	}
	_, err = r.pool.Exec(ctx, `
		INSERT INTO location_summary_job (house_id, city, street, lat, lng, pois, status, attempts, next_attempt_at, revision)
		VALUES ($1, $2, $3, $4, $5, $6, 'queued', 0, now(), 1)
		ON CONFLICT (house_id) DO UPDATE SET
			city = EXCLUDED.city,
			street = EXCLUDED.street,
			lat = EXCLUDED.lat,
			lng = EXCLUDED.lng,
			pois = EXCLUDED.pois,
			status = 'queued',
			attempts = 0,
			next_attempt_at = now(),
			last_error = NULL,
			revision = location_summary_job.revision + 1,
			updated_at = now()
	`, houseID, city, street, lat, lng, poisBytes)
	return err
}

func (r *LocationSummaryJobRepo) DueBatch(ctx context.Context, limit int32) ([]domain.LocationSummaryJob, error) {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	if _, err = tx.Exec(ctx, `
		UPDATE location_summary_job
		SET status = 'queued', next_attempt_at = now(), updated_at = now()
		WHERE status = 'processing' AND updated_at < now() - interval '5 minutes'
	`); err != nil {
		return nil, err
	}

	rows, err := tx.Query(ctx, `
		WITH due AS (
			SELECT id FROM location_summary_job
			WHERE status = 'queued' AND next_attempt_at <= now()
			ORDER BY next_attempt_at, id
			FOR UPDATE SKIP LOCKED
			LIMIT $1
		)
		UPDATE location_summary_job j
		SET status = 'processing', attempts = attempts + 1, updated_at = now()
		FROM due
		WHERE j.id = due.id
		RETURNING j.id, j.house_id, j.city, j.street, j.lat, j.lng, j.pois,
			j.revision, j.status, j.attempts, j.next_attempt_at, j.last_error
	`, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := make([]domain.LocationSummaryJob, 0)
	for rows.Next() {
		var item domain.LocationSummaryJob
		var poisBytes []byte
		if err := rows.Scan(&item.ID, &item.HouseID, &item.City, &item.Street, &item.Lat, &item.Lng,
			&poisBytes, &item.Revision, &item.Status, &item.Attempts, &item.NextAttemptAt, &item.LastError); err != nil {
			return nil, err
		}
		if len(poisBytes) > 0 {
			if err := json.Unmarshal(poisBytes, &item.POIs); err != nil {
				return nil, err
			}
		}
		items = append(items, item)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	return items, nil
}

func (r *LocationSummaryJobRepo) Complete(ctx context.Context, job domain.LocationSummaryJob, pois []domain.HousePOI, summary string) (bool, error) {
	poisBytes, err := json.Marshal(pois)
	if err != nil {
		return false, err
	}
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return false, err
	}
	defer tx.Rollback(ctx)

	var houseID int32
	err = tx.QueryRow(ctx, `
		UPDATE location_summary_job
		SET status = 'done', last_error = NULL, updated_at = now()
		WHERE id = $1 AND revision = $2 AND status = 'processing'
		RETURNING house_id
	`, job.ID, job.Revision).Scan(&houseID)
	if errors.Is(err, pgx.ErrNoRows) {
		return false, nil
	}
	if err != nil {
		return false, err
	}
	if _, err = tx.Exec(ctx, `UPDATE house SET pois = $2, location_summary = $3, updated_at = now() WHERE id = $1`, houseID, poisBytes, summary); err != nil {
		return false, err
	}
	if err = tx.Commit(ctx); err != nil {
		return false, err
	}
	return true, nil
}

func (r *LocationSummaryJobRepo) SavePOIs(ctx context.Context, job domain.LocationSummaryJob, pois []domain.HousePOI) (bool, error) {
	poisBytes, err := json.Marshal(pois)
	if err != nil {
		return false, err
	}
	result, err := r.pool.Exec(ctx, `
		UPDATE house h
		SET pois = $3, updated_at = now()
		WHERE h.id = $1
		  AND EXISTS (
			SELECT 1 FROM location_summary_job j
			WHERE j.id = $2 AND j.house_id = h.id AND j.revision = $4 AND j.status = 'processing'
		  )
	`, job.HouseID, job.ID, poisBytes, job.Revision)
	if err != nil {
		return false, err
	}
	return result.RowsAffected() == 1, nil
}

func (r *LocationSummaryJobRepo) MarkRetry(ctx context.Context, id, revision int64, lastError string, nextAttemptAt time.Time) error {
	_, err := r.pool.Exec(ctx, `
		UPDATE location_summary_job
		SET status = 'queued', last_error = $3, next_attempt_at = $4, updated_at = now()
		WHERE id = $1 AND revision = $2 AND status = 'processing'
	`, id, revision, truncateErrorText(lastError), nextAttemptAt)
	return err
}

func (r *LocationSummaryJobRepo) MarkFailed(ctx context.Context, id, revision int64, lastError string) error {
	_, err := r.pool.Exec(ctx, `
		UPDATE location_summary_job
		SET status = 'failed', last_error = $3, updated_at = now()
		WHERE id = $1 AND revision = $2 AND status = 'processing'
	`, id, revision, truncateErrorText(lastError))
	return err
}

func truncateErrorText(value string) string {
	const max = 500
	if len(value) <= max {
		return value
	}
	return value[:max]
}
