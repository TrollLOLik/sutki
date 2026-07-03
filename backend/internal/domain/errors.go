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
	// ErrEmailTaken is returned when trying to change the email to an already registered address.
	ErrEmailTaken = errors.New("email already taken")
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
	// ErrDatesUnavailable is returned when the requested dates overlap an
	// already-confirmed booking on the same listing.
	ErrDatesUnavailable = errors.New("dates unavailable")
	// ErrBookingOwnListing is returned when a user attempts to book their own listing.
	ErrBookingOwnListing = errors.New("cannot book own listing")
)

// Review-related errors.
var (
	// ErrInvalidReview is returned when a review fails validation (rating out of
	// range or empty body).
	ErrInvalidReview = errors.New("invalid review")
	// ErrReviewNotAllowed is returned when the author has no confirmed/active
	// booking for the listing, or attempts to review their own listing.
	ErrReviewNotAllowed = errors.New("review not allowed")
)

// Account deletion errors.
var (
	// ErrActiveBookings is returned when a user attempts to delete their account with active bookings.
	ErrActiveBookings = errors.New("cannot delete account with active bookings")
)
