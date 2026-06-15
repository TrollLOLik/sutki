package domain

import (
	"context"
	"time"
)

// ListingRepository abstracts persistence for rental listings.
type ListingRepository interface {
	List(ctx context.Context, filter ListFilter) ([]House, error)
	Count(ctx context.Context, filter ListFilter) (int64, error)
	GetByID(ctx context.Context, id int32) (House, error)
	ListPhotos(ctx context.Context, houseID int32) ([]Photo, error)
	ListServices(ctx context.Context, houseID int32) ([]Ref, error)
	ListCategories(ctx context.Context, houseID int32) ([]Ref, error)
	AllServices(ctx context.Context) ([]Ref, error)
	AllCategories(ctx context.Context) ([]Ref, error)
}

// BookingRepository abstracts persistence for rental requests (bookings).
type BookingRepository interface {
	GetHouseForBooking(ctx context.Context, houseID int32) (ownerID int32, status string, err error)
	Create(ctx context.Context, b NewBooking) (Booking, error)
	GetByID(ctx context.Context, id int32) (Booking, error)
	ListByUser(ctx context.Context, userID, limit, offset int32) ([]Booking, error)
	CountByUser(ctx context.Context, userID int32) (int64, error)
	ListForOwner(ctx context.Context, ownerID, limit, offset int32) ([]Booking, error)
	CountForOwner(ctx context.Context, ownerID int32) (int64, error)
	Confirm(ctx context.Context, id int32) (Booking, error)
	Reject(ctx context.Context, id int32, reason string) (Booking, error)
	Cancel(ctx context.Context, id int32) (Booking, error)
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
