package domain

import (
	"context"
	"time"
)

// BookedRange is a confirmed occupancy window on a listing. End is nil for a
// single-night booking.
type BookedRange struct {
	Start time.Time
	End   *time.Time
}

// ListingRepository abstracts persistence for rental listings.
type ListingRepository interface {
	List(ctx context.Context, filter ListFilter) ([]House, error)
	Count(ctx context.Context, filter ListFilter) (int64, error)
	Create(ctx context.Context, h NewHouse) (int32, error)
	ListByOwner(ctx context.Context, ownerID, limit, offset int32) ([]House, error)
	CountByOwner(ctx context.Context, ownerID int32) (int64, error)
	GetByID(ctx context.Context, id int32) (House, error)
	ListPhotos(ctx context.Context, houseID int32) ([]Photo, error)
	ListServices(ctx context.Context, houseID int32) ([]Ref, error)
	ListCategories(ctx context.Context, houseID int32) ([]Ref, error)
	AllServices(ctx context.Context) ([]Ref, error)
	AllCategories(ctx context.Context) ([]Ref, error)
	Update(ctx context.Context, id int32, h NewHouse) error
}

// BookingRepository abstracts persistence for rental requests (bookings).
type BookingRepository interface {
	GetHouseForBooking(ctx context.Context, houseID int32) (ownerID int32, status string, err error)
	// HasConfirmedOverlap reports whether the house already has a confirmed
	// booking overlapping [start, end). A nil end means a single night.
	HasConfirmedOverlap(ctx context.Context, houseID int32, start time.Time, end *time.Time) (bool, error)
	// ConfirmedRanges returns the house's confirmed (occupied) date ranges,
	// used to block taken dates in the booking calendar.
	ConfirmedRanges(ctx context.Context, houseID int32) ([]BookedRange, error)
	Create(ctx context.Context, b NewBooking) (Booking, error)
	GetByID(ctx context.Context, id int32) (Booking, error)
	ListByUser(ctx context.Context, userID, limit, offset int32, scope string) ([]Booking, error)
	CountByUser(ctx context.Context, userID int32, scope string) (int64, error)
	ListForOwner(ctx context.Context, ownerID, limit, offset int32) ([]Booking, error)
	CountForOwner(ctx context.Context, ownerID int32) (int64, error)
	Confirm(ctx context.Context, id int32) (Booking, error)
	Reject(ctx context.Context, id int32, reason string) (Booking, error)
	Cancel(ctx context.Context, id int32) (Booking, error)
}

// ReviewRepository abstracts persistence for listing reviews.
type ReviewRepository interface {
	HouseExists(ctx context.Context, houseID int32) (bool, error)
	ListByHouse(ctx context.Context, houseID, limit, offset int32) ([]Review, error)
	CountByHouse(ctx context.Context, houseID int32) (int64, error)
	Summary(ctx context.Context, houseID int32) (RatingSummary, error)
	Create(ctx context.Context, r NewReview) (Review, error)
	ListByAuthor(ctx context.Context, userID, limit, offset int32) ([]Review, error)
	CountByAuthor(ctx context.Context, userID int32) (int64, error)
	ListForHost(ctx context.Context, userID, limit, offset int32) ([]Review, error)
	CountForHost(ctx context.Context, userID int32) (int64, error)
}

// FavoriteRepository abstracts persistence for a user's favorite listings.
type FavoriteRepository interface {
	HouseExists(ctx context.Context, houseID int32) (bool, error)
	Add(ctx context.Context, userID, houseID int32) error
	Remove(ctx context.Context, userID, houseID int32) error
	ListHouses(ctx context.Context, userID, limit, offset int32) ([]House, error)
	CountHouses(ctx context.Context, userID int32) (int64, error)
	ListIDs(ctx context.Context, userID int32) ([]int32, error)
}

// UserRepository abstracts persistence for application accounts.
type UserRepository interface {
	GetByEmail(ctx context.Context, email string) (User, error)
	GetByID(ctx context.Context, id int32) (User, error)
	Create(ctx context.Context, email string) (User, error)
	UpdateProfile(ctx context.Context, id int32, name, phone, city, avatarURL *string, birthday *time.Time, vkID *string, vkIDDoNull *bool) (User, error)
	UpdateEmail(ctx context.Context, id int32, email string) (User, error)
	Delete(ctx context.Context, id int32) error
	CheckActiveBookings(ctx context.Context, id int32) (int64, error)
	AnonymizeAndRevoke(ctx context.Context, id int32, emailHash string) error
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
