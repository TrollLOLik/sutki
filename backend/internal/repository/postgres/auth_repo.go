package postgres

import (
	"context"
	"errors"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"

	"github.com/TrollLOLik/sutki/backend/internal/domain"
	"github.com/TrollLOLik/sutki/backend/internal/repository/postgres/sqlc"
)

// AuthCodeRepo implements domain.AuthCodeRepository.
type AuthCodeRepo struct {
	q *sqlc.Queries
}

func NewAuthCodeRepo(q *sqlc.Queries) *AuthCodeRepo {
	return &AuthCodeRepo{q: q}
}

func (r *AuthCodeRepo) Upsert(ctx context.Context, code domain.AuthCode) error {
	return r.q.UpsertAuthCode(ctx, sqlc.UpsertAuthCodeParams{
		Channel:          code.Channel,
		Target:           code.Target,
		CodeHash:         code.CodeHash,
		ExpiresAt:        tstz(code.ExpiresAt),
		DeliveryProvider: code.DeliveryProvider,
		DeliveryID:       code.DeliveryID,
		DeliveryCost:     code.DeliveryCost,
	})
}

func (r *AuthCodeRepo) Get(ctx context.Context, channel, target string) (domain.AuthCode, error) {
	row, err := r.q.GetAuthCode(ctx, sqlc.GetAuthCodeParams{
		Channel: channel,
		Target:  target,
	})
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return domain.AuthCode{}, domain.ErrNotFound
		}
		return domain.AuthCode{}, err
	}
	return domain.AuthCode{
		Channel:          row.Channel,
		Target:           row.Target,
		CodeHash:         row.CodeHash,
		ExpiresAt:        row.ExpiresAt.Time,
		Attempts:         row.Attempts,
		CreatedAt:        row.CreatedAt.Time,
		DeliveryProvider: row.DeliveryProvider,
		DeliveryID:       row.DeliveryID,
		DeliveryCost:     row.DeliveryCost,
	}, nil
}

func (r *AuthCodeRepo) IncrementAttempts(ctx context.Context, channel, target string) error {
	return r.q.IncrementAuthCodeAttempts(ctx, sqlc.IncrementAuthCodeAttemptsParams{
		Channel: channel,
		Target:  target,
	})
}

func (r *AuthCodeRepo) Delete(ctx context.Context, channel, target string) error {
	return r.q.DeleteAuthCode(ctx, sqlc.DeleteAuthCodeParams{
		Channel: channel,
		Target:  target,
	})
}

func tstz(t time.Time) pgtype.Timestamptz {
	return pgtype.Timestamptz{Time: t, Valid: true}
}

// RefreshTokenRepo implements domain.RefreshTokenRepository.
type RefreshTokenRepo struct {
	q *sqlc.Queries
}

func NewRefreshTokenRepo(q *sqlc.Queries) *RefreshTokenRepo {
	return &RefreshTokenRepo{q: q}
}

func (r *RefreshTokenRepo) Create(ctx context.Context, userID int32, tokenHash string, expiresAt time.Time, deviceName, deviceOS, appVersion, ipAddress, location *string) (int64, error) {
	return r.q.CreateRefreshToken(ctx, sqlc.CreateRefreshTokenParams{
		UserID:     userID,
		TokenHash:  tokenHash,
		ExpiresAt:  ts(expiresAt),
		DeviceName: deviceName,
		DeviceOs:   deviceOS,
		AppVersion: appVersion,
		IpAddress:  ipAddress,
		Location:   location,
	})
}

func (r *RefreshTokenRepo) Get(ctx context.Context, tokenHash string) (domain.RefreshToken, error) {
	row, err := r.q.GetRefreshToken(ctx, tokenHash)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return domain.RefreshToken{}, domain.ErrNotFound
		}
		return domain.RefreshToken{}, err
	}
	return mapRefreshToken(row), nil
}

func (r *RefreshTokenRepo) GetByID(ctx context.Context, id int64) (domain.RefreshToken, error) {
	row, err := r.q.GetRefreshTokenByID(ctx, id)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return domain.RefreshToken{}, domain.ErrNotFound
		}
		return domain.RefreshToken{}, err
	}
	return mapRefreshToken(row), nil
}

func (r *RefreshTokenRepo) Revoke(ctx context.Context, tokenHash string) error {
	return r.q.RevokeRefreshToken(ctx, tokenHash)
}

func (r *RefreshTokenRepo) RevokeByID(ctx context.Context, id int64, userID int32) error {
	return r.q.RevokeRefreshTokenByID(ctx, sqlc.RevokeRefreshTokenByIDParams{
		ID:     id,
		UserID: userID,
	})
}

func (r *RefreshTokenRepo) RevokeAllExcept(ctx context.Context, currentID int64, userID int32) error {
	return r.q.RevokeAllOtherRefreshTokens(ctx, sqlc.RevokeAllOtherRefreshTokensParams{
		ID:     currentID,
		UserID: userID,
	})
}

func (r *RefreshTokenRepo) UpdateActiveTime(ctx context.Context, id int64, lastActive time.Time) error {
	return r.q.UpdateRefreshTokenActiveTime(ctx, sqlc.UpdateRefreshTokenActiveTimeParams{
		ID:           id,
		LastActiveAt: ts(lastActive),
	})
}

func (r *RefreshTokenRepo) UpdateLocation(ctx context.Context, id int64, location string) error {
	return r.q.UpdateRefreshTokenLocation(ctx, sqlc.UpdateRefreshTokenLocationParams{
		ID:       id,
		Location: &location,
	})
}

func (r *RefreshTokenRepo) ListActive(ctx context.Context, userID int32) ([]domain.RefreshToken, error) {
	rows, err := r.q.ListActiveRefreshTokens(ctx, userID)
	if err != nil {
		return nil, err
	}
	res := make([]domain.RefreshToken, len(rows))
	for i, row := range rows {
		res[i] = mapRefreshToken(row)
	}
	return res, nil
}

func mapRefreshToken(row sqlc.RefreshToken) domain.RefreshToken {
	tok := domain.RefreshToken{
		ID:           row.ID,
		UserID:       row.UserID,
		TokenHash:    row.TokenHash,
		ExpiresAt:    row.ExpiresAt.Time,
		DeviceName:   row.DeviceName,
		DeviceOS:     row.DeviceOs,
		AppVersion:   row.AppVersion,
		IPAddress:    row.IpAddress,
		Location:     row.Location,
		LastActiveAt: row.LastActiveAt.Time,
	}
	if row.RevokedAt.Valid {
		t := row.RevokedAt.Time
		tok.RevokedAt = &t
	}
	return tok
}

func ts(t time.Time) pgtype.Timestamp {
	return pgtype.Timestamp{Time: t, Valid: true}
}
