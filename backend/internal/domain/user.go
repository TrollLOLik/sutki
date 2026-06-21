package domain

import "time"

// User is an application account. It maps onto the legacy `user` table;
// nullable legacy columns are flattened to empty strings here.
type User struct {
	ID            int32
	Email         string
	Name          string
	Surname       string
	Patronymic    string
	Phone         string
	City          string
	AvatarURL     string
	IsVerified    bool
	Birthday      *time.Time
	ListingsCount int32
	Rating        float64
	VKID          string
}

// EmailLoginCode is a short-lived, hashed passwordless login code for an email.
type EmailLoginCode struct {
	Email     string
	CodeHash  string
	ExpiresAt time.Time
	Attempts  int32
	CreatedAt time.Time
}

// RefreshToken is a persisted (hashed) refresh token for JWT rotation.
type RefreshToken struct {
	ID        int64
	UserID    int32
	TokenHash string
	ExpiresAt time.Time
	RevokedAt *time.Time
}
