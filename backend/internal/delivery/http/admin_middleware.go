package http

import (
	"context"
	"errors"
	"net/http"

	"github.com/TrollLOLik/sutki/backend/internal/domain"
	"github.com/TrollLOLik/sutki/backend/internal/usecase/adminauth"
)

const adminSessionKey ctxKey = 100

func (h *AdminHandler) requireSession(minimumRole string, requireCSRF bool) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			cookie, err := r.Cookie(adminSessionCookie)
			if err != nil {
				writeError(w, http.StatusUnauthorized, "Требуется вход в панель управления.")
				return
			}
			session, err := h.svc.Authenticate(r.Context(), cookie.Value, r.Header.Get(adminCSRFHeader), requireCSRF)
			if err != nil {
				handleAdminAuthError(w, r, err)
				return
			}
			if err := h.svc.RequireRole(session, minimumRole); err != nil {
				if errors.Is(err, adminauth.ErrForbidden) {
					writeError(w, http.StatusForbidden, "Недостаточно прав.")
					return
				}
				handleAdminAuthError(w, r, err)
				return
			}
			ctx := context.WithValue(r.Context(), adminSessionKey, session)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

func adminSessionFromContext(ctx context.Context) (domain.AdminSession, bool) {
	session, ok := ctx.Value(adminSessionKey).(domain.AdminSession)
	return session, ok
}
