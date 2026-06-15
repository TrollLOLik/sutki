package domain

import "errors"

// ErrNotFound is returned by repositories when an entity does not exist.
var ErrNotFound = errors.New("not found")

// Auth-related errors.
var (
	// ErrCodeInvalid is returned when an email login code is wrong or absent.
	ErrCodeInvalid = errors.New("invalid code")
	// ErrCodeExpired is returned when an email login code has expired.
	ErrCodeExpired = errors.New("code expired")
	// ErrTooManyAttempts is returned when a code has been guessed too many times.
	ErrTooManyAttempts = errors.New("too many attempts")
	// ErrCodeRequestTooSoon is returned when a code is re-requested within the cooldown.
	ErrCodeRequestTooSoon = errors.New("code requested too soon")
	// ErrTokenInvalid is returned for an invalid/expired/revoked refresh token.
	ErrTokenInvalid = errors.New("invalid token")
	// ErrInvalidEmail is returned when an email fails validation.
	ErrInvalidEmail = errors.New("invalid email")
)

// Booking-related errors.
var (
	// ErrListingUnavailable is returned when booking a listing that is not active.
	ErrListingUnavailable = errors.New("listing unavailable")
	// ErrBookingForbidden is returned when a user acts on a booking they may not.
	ErrBookingForbidden = errors.New("booking forbidden")
	// ErrBookingNotPending is returned when a status transition is not allowed
	// from the booking's current status.
	ErrBookingNotPending = errors.New("booking not pending")
)
