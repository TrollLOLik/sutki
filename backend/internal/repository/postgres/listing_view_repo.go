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
		INSERT INTO listing_view_event(event_id,house_id,viewer_hash,viewer_kind,viewed_on)
		VALUES($1::uuid,$2,$3,$4,$5::date)
		ON CONFLICT DO NOTHING`, eventID, houseID, viewerHash, viewerKind, viewedOn.UTC())
	if err != nil {
		return domain.ListingViewResult{}, err
	}
	if tag.RowsAffected() == 0 {
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
