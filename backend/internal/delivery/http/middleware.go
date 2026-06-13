package http

import (
	"context"
	"net/http"
	"strings"

	"github.com/TrollLOLik/sutki/backend/internal/usecase/auth"
)

type ctxKey int

const userIDKey ctxKey = iota

// AuthMiddleware validates the Bearer access token and stores the user id in
// the request context. Requests without a valid token get 401.
func AuthMiddleware(tm *auth.TokenManager) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			header := r.Header.Get("Authorization")
			token, ok := bearerToken(header)
			if !ok {
				writeError(w, http.StatusUnauthorized, "missing bearer token")
				return
			}
			userID, err := tm.Parse(token)
			if err != nil {
				writeError(w, http.StatusUnauthorized, "invalid token")
				return
			}
			ctx := context.WithValue(r.Context(), userIDKey, userID)
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
