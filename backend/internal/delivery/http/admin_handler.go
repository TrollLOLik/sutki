package http

import (
	"errors"
	"net/http"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"

	"github.com/TrollLOLik/sutki/backend/internal/domain"
	"github.com/TrollLOLik/sutki/backend/internal/usecase/adminauth"
	"github.com/TrollLOLik/sutki/backend/internal/usecase/auth"
)

const (
	adminSessionCookie = "wigaj_admin_session"
	adminCSRFCookie    = "wigaj_admin_csrf"
	adminCSRFHeader    = "X-CSRF-Token"
)

type AdminHandlerConfig struct {
	AllowedOrigin string
	SecureCookies bool
	ExposeCode    bool
}

type AdminHandler struct {
	svc *adminauth.Service
	cfg AdminHandlerConfig
}

func NewAdminHandler(svc *adminauth.Service, cfg AdminHandlerConfig) *AdminHandler {
	cfg.AllowedOrigin = strings.TrimRight(strings.TrimSpace(cfg.AllowedOrigin), "/")
	return &AdminHandler{svc: svc, cfg: cfg}
}

func (h *AdminHandler) Routes(r chi.Router) {
	r.Use(h.originGuard)
	r.Post("/auth/request-code", h.requestCode)
	r.Post("/auth/verify-code", h.verifyCode)

	r.Group(func(r chi.Router) {
		r.Use(h.requireSession(domain.AdminRoleSupport, false))
		r.Get("/auth/me", h.me)
	})
	r.Group(func(r chi.Router) {
		r.Use(h.requireSession(domain.AdminRoleSupport, true))
		r.Post("/auth/logout", h.logout)
	})
}

func (h *AdminHandler) requestCode(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Email string `json:"email"`
	}
	if !decodeJSON(w, r, &body) {
		return
	}
	email, err := auth.NormalizeEmail(body.Email)
	if err != nil {
		writeError(w, http.StatusBadRequest, "Проверьте адрес электронной почты.")
		return
	}
	if !OTPEmailLimiter.Allow("admin_otp_email:"+email, 5) || !OTPIPLimiter.Allow("admin_otp_ip:"+getClientIP(r), 10) {
		writeRateLimitError(w, "Слишком много запросов. Попробуйте позже.")
		return
	}
	result, err := h.svc.RequestCode(r.Context(), email)
	if err != nil {
		if errors.Is(err, domain.ErrCodeRequestTooSoon) {
			writeRateLimitError(w, "Код уже отправлен. Подождите перед повторным запросом.")
			return
		}
		writeInternalError(w, r, err, "admin login code request failed")
		return
	}
	response := map[string]any{
		"expires_in": result.ExpiresIn,
		"message":    "Если адресу разрешён доступ, код отправлен.",
	}
	if h.cfg.ExposeCode && result.Exposed {
		response["code"] = result.Code
	}
	writeJSON(w, http.StatusAccepted, response)
}

func (h *AdminHandler) verifyCode(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Email string `json:"email"`
		Code  string `json:"code"`
	}
	if !decodeJSON(w, r, &body) {
		return
	}
	email, err := auth.NormalizeEmail(body.Email)
	if err != nil {
		writeError(w, http.StatusUnauthorized, "Неверный код или доступ не разрешён.")
		return
	}
	if !allowOTPVerify(w, r, "admin:"+email, "") {
		return
	}
	result, err := h.svc.VerifyCode(r.Context(), email, body.Code, adminClientMeta(r))
	if err != nil {
		handleAdminAuthError(w, r, err)
		return
	}
	h.setSessionCookies(w, result.SessionToken, result.CSRFToken, result.ExpiresAt)
	writeJSON(w, http.StatusOK, map[string]any{
		"csrf_token": result.CSRFToken,
		"expires_at": result.ExpiresAt.Format(time.RFC3339),
		"admin":      adminAccountDTO(result.Account),
	})
}

func (h *AdminHandler) me(w http.ResponseWriter, r *http.Request) {
	session, ok := adminSessionFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "Требуется вход в панель управления.")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"admin":      adminAccountDTO(session.Account),
		"expires_at": session.ExpiresAt.Format(time.RFC3339),
	})
}

func (h *AdminHandler) logout(w http.ResponseWriter, r *http.Request) {
	sessionCookie, err := r.Cookie(adminSessionCookie)
	if err != nil {
		writeError(w, http.StatusUnauthorized, "Требуется вход в панель управления.")
		return
	}
	if err := h.svc.Logout(r.Context(), sessionCookie.Value, r.Header.Get(adminCSRFHeader), adminClientMeta(r)); err != nil {
		handleAdminAuthError(w, r, err)
		return
	}
	h.clearSessionCookies(w)
	w.WriteHeader(http.StatusNoContent)
}

func (h *AdminHandler) originGuard(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if h.cfg.AllowedOrigin != "" && isStateChangingMethod(r.Method) {
			origin := strings.TrimRight(strings.TrimSpace(r.Header.Get("Origin")), "/")
			if origin != h.cfg.AllowedOrigin {
				writeError(w, http.StatusForbidden, "Недопустимый источник запроса.")
				return
			}
		}
		next.ServeHTTP(w, r)
	})
}

func isStateChangingMethod(method string) bool {
	return method != http.MethodGet && method != http.MethodHead && method != http.MethodOptions
}

func (h *AdminHandler) setSessionCookies(w http.ResponseWriter, sessionToken, csrfToken string, expiresAt time.Time) {
	maxAge := int(time.Until(expiresAt).Seconds())
	if maxAge < 1 {
		maxAge = 1
	}
	http.SetCookie(w, &http.Cookie{
		Name: adminSessionCookie, Value: sessionToken, Path: "/api/admin/v1",
		HttpOnly: true, Secure: h.cfg.SecureCookies, SameSite: http.SameSiteStrictMode,
		Expires: expiresAt, MaxAge: maxAge,
	})
	http.SetCookie(w, &http.Cookie{
		Name: adminCSRFCookie, Value: csrfToken, Path: "/api/admin/v1",
		HttpOnly: false, Secure: h.cfg.SecureCookies, SameSite: http.SameSiteStrictMode,
		Expires: expiresAt, MaxAge: maxAge,
	})
}

func (h *AdminHandler) clearSessionCookies(w http.ResponseWriter) {
	for _, cookie := range []http.Cookie{
		{Name: adminSessionCookie, HttpOnly: true},
		{Name: adminCSRFCookie},
	} {
		cookie.Value = ""
		cookie.Path = "/api/admin/v1"
		cookie.Secure = h.cfg.SecureCookies
		cookie.SameSite = http.SameSiteStrictMode
		cookie.Expires = time.Unix(1, 0)
		cookie.MaxAge = -1
		http.SetCookie(w, &cookie)
	}
}

func adminAccountDTO(account domain.AdminAccount) map[string]any {
	return map[string]any{
		"id": account.ID, "user_id": account.UserID, "email": account.Email,
		"name": account.Name, "role": account.Role,
	}
}

func adminClientMeta(r *http.Request) adminauth.ClientMeta {
	return adminauth.ClientMeta{IPAddress: getClientIP(r), UserAgent: r.UserAgent()}
}

func handleAdminAuthError(w http.ResponseWriter, r *http.Request, err error) {
	switch {
	case errors.Is(err, adminauth.ErrInvalidCredentials):
		writeError(w, http.StatusUnauthorized, "Неверный код или доступ не разрешён.")
	case errors.Is(err, adminauth.ErrInvalidSession):
		writeError(w, http.StatusUnauthorized, "Сессия панели управления истекла.")
	case errors.Is(err, adminauth.ErrInvalidCSRF):
		writeError(w, http.StatusForbidden, "Защитный токен устарел. Обновите страницу.")
	case errors.Is(err, adminauth.ErrForbidden):
		writeError(w, http.StatusForbidden, "Недостаточно прав.")
	default:
		writeInternalError(w, r, err, "admin authentication failed")
	}
}
