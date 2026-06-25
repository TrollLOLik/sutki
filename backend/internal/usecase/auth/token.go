package auth

import (
	"fmt"
	"strconv"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

// AccessClaims represents custom claims with session ID.
type AccessClaims struct {
	jwt.RegisteredClaims
	SessionID int64 `json:"sid"`
}

// TokenManager issues and validates short-lived HS256 access tokens.
type TokenManager struct {
	secret    []byte
	accessTTL time.Duration
}

func NewTokenManager(secret string, accessTTL time.Duration) *TokenManager {
	return &TokenManager{secret: []byte(secret), accessTTL: accessTTL}
}

// Issue returns a signed access token for the user and its expiry time.
func (m *TokenManager) Issue(userID int32, sessionID int64, now time.Time) (string, time.Time, error) {
	exp := now.Add(m.accessTTL)
	claims := AccessClaims{
		RegisteredClaims: jwt.RegisteredClaims{
			Subject:   strconv.FormatInt(int64(userID), 10),
			IssuedAt:  jwt.NewNumericDate(now),
			ExpiresAt: jwt.NewNumericDate(exp),
		},
		SessionID: sessionID,
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	signed, err := token.SignedString(m.secret)
	if err != nil {
		return "", time.Time{}, err
	}
	return signed, exp, nil
}

// Parse validates an access token and returns the user id and session id.
func (m *TokenManager) Parse(tokenString string) (int32, int64, error) {
	claims := &AccessClaims{}
	_, err := jwt.ParseWithClaims(tokenString, claims, func(t *jwt.Token) (any, error) {
		if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", t.Header["alg"])
		}
		return m.secret, nil
	})
	if err != nil {
		return 0, 0, err
	}
	id, err := strconv.ParseInt(claims.Subject, 10, 32)
	if err != nil {
		return 0, 0, fmt.Errorf("invalid subject: %w", err)
	}
	return int32(id), claims.SessionID, nil
}
