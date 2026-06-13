package domain

import (
	"context"
	"time"
)

// ListingRepository abstracts persistence for rental listings.
type ListingRepository interface {
	ListActive(ctx context.Context, limit, offset int32) ([]House, error)
	CountActive(ctx context.Context) (int64, error)
	GetByID(ctx context.Context, id int32) (House, error)
	ListPhotos(ctx context.Context, houseID int32) ([]Photo, error)
	ListServices(ctx context.Context, houseID int32) ([]Ref, error)
	ListCategories(ctx context.Context, houseID int32) ([]Ref, error)
}

// UserRepository abstracts persistence for application accounts.
type UserRepository interface {
	GetByEmail(ctx context.Context, email string) (User, error)
	GetByID(ctx context.Context, id int32) (User, error)
	Create(ctx context.Context, email string) (User, error)
	UpdateProfile(ctx context.Context, id int32, name, phone, city *string) (User, error)
}

// AuthCodeRepository persists short-lived email login codes.
type AuthCodeRepository interface {
	Upsert(ctx context.Context, email, codeHash string, expiresAt time.Time) error
	Get(ctx context.Context, email string) (EmailLoginCode, error)
	IncrementAttempts(ctx context.Context, email string) error
	Delete(ctx context.Context, email string) error
}

// RefreshTokenRepository persists hashed refresh tokens for JWT rotation.
type RefreshTokenRepository interface {
	Create(ctx context.Context, userID int32, tokenHash string, expiresAt time.Time) error
	Get(ctx context.Context, tokenHash string) (RefreshToken, error)
	Revoke(ctx context.Context, tokenHash string) error
}
