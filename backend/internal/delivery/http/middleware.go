package http

import (
	"context"
	"net/http"
	"strings"

	"github.com/TrollLOLik/sutki/backend/internal/usecase/auth"
)

type ctxKey int

const (
	userIDKey ctxKey = iota
	sessionIDKey
)

// SessionValidator interface defines methods to check session validity.
type SessionValidator interface {
	IsValidSession(ctx context.Context, sid int64) bool
	UpdateSessionActiveTime(ctx context.Context, sid int64)
}

// AuthMiddleware validates the Bearer access token, checks if the session is still active,
// updates the last active timestamp, and stores the user id and session id in context.
func AuthMiddleware(tm *auth.TokenManager, sv SessionValidator) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			header := r.Header.Get("Authorization")
			token, ok := bearerToken(header)
			if !ok {
				writeError(w, http.StatusUnauthorized, "missing bearer token")
				return
			}
			userID, sid, err := tm.Parse(token)
			if err != nil {
				writeError(w, http.StatusUnauthorized, "invalid token")
				return
			}

			// Perform cheap write-through cache check for revoked sessions
			if !sv.IsValidSession(r.Context(), sid) {
				writeError(w, http.StatusUnauthorized, "session revoked or expired")
				return
			}

			// Update last active time (rate-limited inside usecase layer)
			sv.UpdateSessionActiveTime(r.Context(), sid)

			ctx := context.WithValue(r.Context(), userIDKey, userID)
			ctx = context.WithValue(ctx, sessionIDKey, sid)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

func bearerToken(header string) (string, bool) {
	const prefix = "Bearer "
	if len(header) <= len(prefix) || !strings.EqualFold(header[:len(prefix)], prefix) {
		return "", false
	}
	token := strings.TrimSpace(header[len(prefix):])
	return token, token != ""
}

func userIDFromContext(ctx context.Context) (int32, bool) {
	id, ok := ctx.Value(userIDKey).(int32)
	return id, ok
}

func sessionIDFromContext(ctx context.Context) (int64, bool) {
	id, ok := ctx.Value(sessionIDKey).(int64)
	return id, ok
}
