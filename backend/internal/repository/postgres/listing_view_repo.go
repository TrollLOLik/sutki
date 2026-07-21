package postgres

import (
	"context"
	"errors"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/TrollLOLik/sutki/backend/internal/domain"
)

type ListingViewRepo struct {
	pool *pgxpool.Pool
}

func NewListingViewRepo(pool *pgxpool.Pool) *ListingViewRepo {
	return &ListingViewRepo{pool: pool}
}

func (r *ListingViewRepo) Record(ctx context.Context, eventID string, houseID int32, viewerHash []byte, viewerKind string, viewedOn time.Time, userID *int32) (domain.ListingViewResult, error) {
	tx, err := r.pool.BeginTx(ctx, pgx.TxOptions{})
	if err != nil {
		return domain.ListingViewResult{}, err
	}
	defer tx.Rollback(ctx)

	var ownerID int32
	var views int32
	var status string
	var deleted bool
	if err := tx.QueryRow(ctx, `SELECT owner_id, views, status, deleted FROM house WHERE id=$1`, houseID).Scan(&ownerID, &views, &status, &deleted); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return domain.ListingViewResult{}, domain.ErrNotFound
		}
		return domain.ListingViewResult{}, err
	}
	if deleted || status != domain.HouseStatusActive {
		return domain.ListingViewResult{}, domain.ErrNotFound
	}
	if userID != nil && *userID == ownerID {
		return domain.ListingViewResult{Views: views}, nil
	}

	tag, err := tx.Exec(ctx, `
		INSERT INTO listing_view_event(event_id,house_id,viewer_hash,viewer_kind,viewed_on,user_id)
		VALUES($1::uuid,$2,$3,$4,$5::date,$6)
		ON CONFLICT DO NOTHING`, eventID, houseID, viewerHash, viewerKind, viewedOn.UTC(), userID)
	if err != nil {
		return domain.ListingViewResult{}, err
	}
	if tag.RowsAffected() == 0 {
		// A repeated open on the same day must not increase counters, but it
		// still refreshes the product-facing "last viewed" order.
		if _, err := tx.Exec(ctx, `
			UPDATE listing_view_event
			SET created_at=now(), user_id=COALESCE(user_id,$4)
			WHERE house_id=$1
			  AND viewed_on=$3::date
			  AND (viewer_hash=$2 OR ($4::int IS NOT NULL AND user_id=$4))`,
			houseID, viewerHash, viewedOn.UTC(), userID); err != nil {
			return domain.ListingViewResult{}, err
		}
		if err := tx.Commit(ctx); err != nil {
			return domain.ListingViewResult{}, err
		}
		return domain.ListingViewResult{Views: views}, nil
	}

	authIncrement, guestIncrement := 0, 0
	if viewerKind == "authenticated" {
		authIncrement = 1
	} else {
		guestIncrement = 1
	}
	_, err = tx.Exec(ctx, `
		INSERT INTO listing_view_daily(house_id,view_date,authenticated_views,guest_views,is_anomalous,updated_at)
		VALUES($1,$2::date,$3,$4,false,now())
		ON CONFLICT(house_id,view_date) DO UPDATE SET
			authenticated_views=listing_view_daily.authenticated_views+EXCLUDED.authenticated_views,
			guest_views=listing_view_daily.guest_views+EXCLUDED.guest_views,
			is_anomalous=(listing_view_daily.authenticated_views+EXCLUDED.authenticated_views>50 OR listing_view_daily.guest_views+EXCLUDED.guest_views>500),
			updated_at=now()`, houseID, viewedOn.UTC(), authIncrement, guestIncrement)
	if err != nil {
		return domain.ListingViewResult{}, err
	}
	if err := tx.QueryRow(ctx, `UPDATE house SET views=views+1 WHERE id=$1 RETURNING views`, houseID).Scan(&views); err != nil {
		return domain.ListingViewResult{}, err
	}
	if err := tx.Commit(ctx); err != nil {
		return domain.ListingViewResult{}, err
	}
	return domain.ListingViewResult{Counted: true, Views: views}, nil
}

func (r *ListingViewRepo) ListRecentIDs(ctx context.Context, userID int32, since time.Time, limit int32) ([]int32, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT e.house_id
		FROM listing_view_event e
		JOIN house h ON h.id=e.house_id
		WHERE e.user_id=$1
		  AND e.created_at >= $2
		  AND h.deleted=false
		  AND h.status=$3
		  AND h.owner_id<>$1
		GROUP BY e.house_id
		ORDER BY max(e.created_at) DESC, e.house_id DESC
		LIMIT $4`, userID, since.UTC(), domain.HouseStatusActive, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	ids := make([]int32, 0)
	for rows.Next() {
		var id int32
		if err := rows.Scan(&id); err != nil {
			return nil, err
		}
		ids = append(ids, id)
	}
	return ids, rows.Err()
}

func (r *ListingViewRepo) AttachGuestHistory(ctx context.Context, userID int32, guestHash []byte, houseIDs []int32, since time.Time) error {
	if len(houseIDs) == 0 {
		return nil
	}
	_, err := r.pool.Exec(ctx, `
		UPDATE listing_view_event e
		SET user_id=$1
		FROM house h
		WHERE h.id=e.house_id
		  AND e.viewer_hash=$2
		  AND e.house_id=ANY($3::int[])
		  AND e.created_at >= $4
		  AND h.deleted=false
		  AND h.status=$5
		  AND h.owner_id<>$1
		  AND NOT EXISTS (
			SELECT 1
			FROM listing_view_event existing
			WHERE existing.house_id=e.house_id
			  AND existing.user_id=$1
			  AND existing.viewed_on=e.viewed_on
		  )`, userID, guestHash, houseIDs, since.UTC(), domain.HouseStatusActive)
	return err
}
