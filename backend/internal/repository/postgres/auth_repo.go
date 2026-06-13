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

func (r *AuthCodeRepo) Upsert(ctx context.Context, email, codeHash string, expiresAt time.Time) error {
	return r.q.UpsertEmailLoginCode(ctx, sqlc.UpsertEmailLoginCodeParams{
		Email:     email,
		CodeHash:  codeHash,
		ExpiresAt: ts(expiresAt),
	})
}

func (r *AuthCodeRepo) Get(ctx context.Context, email string) (domain.EmailLoginCode, error) {
	row, err := r.q.GetEmailLoginCode(ctx, email)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return domain.EmailLoginCode{}, domain.ErrNotFound
		}
		return domain.EmailLoginCode{}, err
	}
	return domain.EmailLoginCode{
		Email:     row.Email,
		CodeHash:  row.CodeHash,
		ExpiresAt: row.ExpiresAt.Time,
		Attempts:  row.Attempts,
		CreatedAt: row.CreatedAt.Time,
	}, nil
}

func (r *AuthCodeRepo) IncrementAttempts(ctx context.Context, email string) error {
	return r.q.IncrementEmailLoginCodeAttempts(ctx, email)
}

func (r *AuthCodeRepo) Delete(ctx context.Context, email string) error {
	return r.q.DeleteEmailLoginCode(ctx, email)
}

// RefreshTokenRepo implements domain.RefreshTokenRepository.
type RefreshTokenRepo struct {
	q *sqlc.Queries
}

func NewRefreshTokenRepo(q *sqlc.Queries) *RefreshTokenRepo {
	return &RefreshTokenRepo{q: q}
}

func (r *RefreshTokenRepo) Create(ctx context.Context, userID int32, tokenHash string, expiresAt time.Time) error {
	return r.q.CreateRefreshToken(ctx, sqlc.CreateRefreshTokenParams{
		UserID:    userID,
		TokenHash: tokenHash,
		ExpiresAt: ts(expiresAt),
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
	tok := domain.RefreshToken{
		ID:        row.ID,
		UserID:    row.UserID,
		TokenHash: row.TokenHash,
		ExpiresAt: row.ExpiresAt.Time,
	}
	if row.RevokedAt.Valid {
		t := row.RevokedAt.Time
		tok.RevokedAt = &t
	}
	return tok, nil
}

func (r *RefreshTokenRepo) Revoke(ctx context.Context, tokenHash string) error {
	return r.q.RevokeRefreshToken(ctx, tokenHash)
}

func ts(t time.Time) pgtype.Timestamp {
	return pgtype.Timestamp{Time: t, Valid: true}
}
