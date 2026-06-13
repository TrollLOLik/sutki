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
	// ErrTokenInvalid is returned for an invalid/expired/revoked refresh token.
	ErrTokenInvalid = errors.New("invalid token")
	// ErrInvalidEmail is returned when an email fails validation.
	ErrInvalidEmail = errors.New("invalid email")
)
