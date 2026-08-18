package http

import (
	"errors"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"

	"github.com/TrollLOLik/sutki/backend/internal/domain"
	"github.com/TrollLOLik/sutki/backend/internal/usecase/adminauth"
	"github.com/TrollLOLik/sutki/backend/internal/usecase/admininbox"
	"github.com/TrollLOLik/sutki/backend/internal/usecase/adminops"
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
	svc   *adminauth.Service
	inbox *admininbox.Service
	ops   *adminops.Service
	cfg   AdminHandlerConfig
}

func NewAdminHandler(svc *adminauth.Service, inbox *admininbox.Service, ops *adminops.Service, cfg AdminHandlerConfig) *AdminHandler {
	cfg.AllowedOrigin = strings.TrimRight(strings.TrimSpace(cfg.AllowedOrigin), "/")
	return &AdminHandler{svc: svc, inbox: inbox, ops: ops, cfg: cfg}
}

func (h *AdminHandler) Routes(r chi.Router) {
	r.Use(h.originGuard)
	r.Post("/auth/request-code", h.requestCode)
	r.Post("/auth/verify-code", h.verifyCode)

	r.Group(func(r chi.Router) {
		r.Use(h.requireSession(domain.AdminRoleSupport, false))
		r.Get("/auth/me", h.me)
		r.Get("/inbox/summary", h.inboxSummary)
		r.Get("/inbox", h.listInbox)
		r.Get("/inbox/{kind}/{id}", h.getInboxItem)
		r.Get("/inbox/{kind}/{id}/media/{mediaID}", h.getInboxMedia)
		r.Get("/search", h.searchAdminItems)
		r.Get("/search/{kind}/{id}", h.getAdminSearchItem)
		r.Get("/search/{kind}/{id}/media/{mediaID}", h.getAdminSearchMedia)
	})
	r.Group(func(r chi.Router) {
		r.Use(h.requireSession(domain.AdminRoleSupport, true))
		r.Post("/auth/logout", h.logout)
		r.Post("/inbox/{kind}/{id}/actions", h.applyInboxAction)
	})
	r.Group(func(r chi.Router) {
		r.Use(h.requireSession(domain.AdminRoleOwner, false))
		r.Get("/audit", h.listAudit)
		r.Get("/staff", h.listStaff)
	})
	r.Group(func(r chi.Router) {
		r.Use(h.requireSession(domain.AdminRoleOwner, true))
		r.Post("/staff", h.createStaff)
		r.Patch("/staff/{id}", h.updateStaff)
	})
}

func (h *AdminHandler) listAudit(w http.ResponseWriter, r *http.Request) {
	page, err := h.ops.ListAudit(
		r.Context(),
		r.URL.Query().Get("action"),
		parseInt32(r.URL.Query().Get("limit"), 50),
		parseInt32(r.URL.Query().Get("offset"), 0),
	)
	if err != nil {
		handleAdminOpsError(w, r, err)
		return
	}
	items := make([]map[string]any, 0, len(page.Items))
	for _, record := range page.Items {
		items = append(items, adminAuditDTO(record))
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"items": items, "total": page.Total, "limit": page.Limit, "offset": page.Offset,
	})
}

func (h *AdminHandler) listStaff(w http.ResponseWriter, r *http.Request) {
	accounts, err := h.ops.ListStaff(r.Context())
	if err != nil {
		handleAdminOpsError(w, r, err)
		return
	}
	items := make([]map[string]any, 0, len(accounts))
	for _, account := range accounts {
		items = append(items, adminStaffDTO(account))
	}
	writeJSON(w, http.StatusOK, map[string]any{"items": items})
}

func (h *AdminHandler) createStaff(w http.ResponseWriter, r *http.Request) {
	session, ok := adminSessionFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "Требуется вход в панель управления.")
		return
	}
	var body struct {
		Email string `json:"email"`
		Role  string `json:"role"`
	}
	if !decodeJSON(w, r, &body) {
		return
	}
	meta := adminOpsClientMeta(r)
	account, err := h.ops.CreateStaff(r.Context(), session.Account.ID, body.Email, body.Role, meta)
	if err != nil {
		handleAdminOpsError(w, r, err)
		return
	}
	writeJSON(w, http.StatusCreated, adminStaffDTO(account))
}

func (h *AdminHandler) updateStaff(w http.ResponseWriter, r *http.Request) {
	session, ok := adminSessionFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "Требуется вход в панель управления.")
		return
	}
	targetID, err := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
	if err != nil || targetID <= 0 {
		writeError(w, http.StatusBadRequest, "Некорректный идентификатор сотрудника.")
		return
	}
	var body struct {
		Role    string `json:"role"`
		Enabled *bool  `json:"enabled"`
	}
	if !decodeJSON(w, r, &body) {
		return
	}
	if body.Enabled == nil {
		writeError(w, http.StatusBadRequest, "Передайте состояние доступа сотрудника.")
		return
	}
	account, err := h.ops.UpdateStaff(
		r.Context(), session.Account.ID, targetID, body.Role, *body.Enabled, adminOpsClientMeta(r),
	)
	if err != nil {
		handleAdminOpsError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, adminStaffDTO(account))
}

func (h *AdminHandler) inboxSummary(w http.ResponseWriter, r *http.Request) {
	session, ok := adminSessionFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "Требуется вход в панель управления.")
		return
	}
	result, err := h.inbox.Summary(r.Context(), session.Account.Role)
	if err != nil {
		handleAdminInboxError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, result)
}

func (h *AdminHandler) listInbox(w http.ResponseWriter, r *http.Request) {
	session, ok := adminSessionFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "Требуется вход в панель управления.")
		return
	}
	result, err := h.inbox.List(r.Context(), session.Account.Role, domain.AdminInboxFilter{
		Kind:   r.URL.Query().Get("kind"),
		Limit:  parseInt32(r.URL.Query().Get("limit"), 20),
		Offset: parseInt32(r.URL.Query().Get("offset"), 0),
	})
	if err != nil {
		handleAdminInboxError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, result)
}

func (h *AdminHandler) getInboxItem(w http.ResponseWriter, r *http.Request) {
	session, ok := adminSessionFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "Требуется вход в панель управления.")
		return
	}
	id, err := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
	if err != nil || id <= 0 {
		writeError(w, http.StatusBadRequest, "Некорректный идентификатор элемента.")
		return
	}
	result, err := h.inbox.Get(r.Context(), session.Account.Role, chi.URLParam(r, "kind"), id)
	if err != nil {
		handleAdminInboxError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, result)
}

func (h *AdminHandler) getInboxMedia(w http.ResponseWriter, r *http.Request) {
	session, ok := adminSessionFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "Требуется вход в панель управления.")
		return
	}
	id, err := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
	if err != nil || id <= 0 {
		writeError(w, http.StatusBadRequest, "Некорректный идентификатор элемента.")
		return
	}
	mediaID, err := strconv.ParseInt(chi.URLParam(r, "mediaID"), 10, 64)
	if err != nil || mediaID <= 0 {
		writeError(w, http.StatusBadRequest, "Некорректный идентификатор файла.")
		return
	}
	url, err := h.inbox.MediaURL(
		r.Context(), session.Account.Role, chi.URLParam(r, "kind"), id, mediaID,
		r.URL.Query().Get("variant"),
	)
	if err != nil {
		handleAdminInboxError(w, r, err)
		return
	}
	w.Header().Set("Cache-Control", "private, no-store")
	w.Header().Set("Pragma", "no-cache")
	w.Header().Set("Referrer-Policy", "no-referrer")
	w.Header().Set("X-Content-Type-Options", "nosniff")
	http.Redirect(w, r, url, http.StatusTemporaryRedirect)
}

func (h *AdminHandler) searchAdminItems(w http.ResponseWriter, r *http.Request) {
	session, ok := adminSessionFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "Требуется вход в панель управления.")
		return
	}
	result, err := h.inbox.Search(r.Context(), session.Account.Role, domain.AdminSearchFilter{
		Kind: r.URL.Query().Get("kind"), Query: r.URL.Query().Get("q"),
	})
	if err != nil {
		handleAdminInboxError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, result)
}

func (h *AdminHandler) getAdminSearchItem(w http.ResponseWriter, r *http.Request) {
	session, ok := adminSessionFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "Требуется вход в панель управления.")
		return
	}
	id, err := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
	if err != nil || id <= 0 {
		writeError(w, http.StatusBadRequest, "Некорректный идентификатор объекта.")
		return
	}
	result, err := h.inbox.GetSearch(r.Context(), session.Account.Role, chi.URLParam(r, "kind"), id)
	if err != nil {
		handleAdminInboxError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, result)
}

func (h *AdminHandler) getAdminSearchMedia(w http.ResponseWriter, r *http.Request) {
	session, ok := adminSessionFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "Требуется вход в панель управления.")
		return
	}
	id, idErr := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
	mediaID, mediaErr := strconv.ParseInt(chi.URLParam(r, "mediaID"), 10, 64)
	if idErr != nil || mediaErr != nil || id <= 0 || mediaID <= 0 {
		writeError(w, http.StatusBadRequest, "Некорректный идентификатор файла.")
		return
	}
	url, err := h.inbox.SearchMediaURL(
		r.Context(), session.Account.Role, chi.URLParam(r, "kind"), id, mediaID,
		r.URL.Query().Get("variant"),
	)
	if err != nil {
		handleAdminInboxError(w, r, err)
		return
	}
	w.Header().Set("Cache-Control", "private, no-store")
	w.Header().Set("Pragma", "no-cache")
	w.Header().Set("Referrer-Policy", "no-referrer")
	w.Header().Set("X-Content-Type-Options", "nosniff")
	http.Redirect(w, r, url, http.StatusTemporaryRedirect)
}

func (h *AdminHandler) applyInboxAction(w http.ResponseWriter, r *http.Request) {
	session, ok := adminSessionFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "Требуется вход в панель управления.")
		return
	}
	id, err := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
	if err != nil || id <= 0 {
		writeError(w, http.StatusBadRequest, "Некорректный идентификатор элемента.")
		return
	}
	var body struct {
		Action      string   `json:"action"`
		Reason      string   `json:"reason"`
		Sanctions   []string `json:"sanctions"`
		SanctionIDs []int64  `json:"sanction_ids"`
	}
	if !decodeJSON(w, r, &body) {
		return
	}
	meta := adminClientMeta(r)
	result, err := h.inbox.Act(r.Context(), session.Account.Role, domain.AdminInboxAction{
		Kind:           chi.URLParam(r, "kind"),
		ID:             id,
		Action:         body.Action,
		Reason:         body.Reason,
		Sanctions:      body.Sanctions,
		SanctionIDs:    body.SanctionIDs,
		ActorAdminID:   session.Account.ID,
		ActorUserID:    session.Account.UserID,
		ActorIPAddress: meta.IPAddress,
		ActorUserAgent: meta.UserAgent,
	})
	if err != nil {
		handleAdminInboxError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, result)
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
	csrfCookie, err := r.Cookie(adminCSRFCookie)
	if err != nil || strings.TrimSpace(csrfCookie.Value) == "" {
		writeError(w, http.StatusUnauthorized, "Сессия панели управления повреждена. Войдите снова.")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"admin":      adminAccountDTO(session.Account),
		"csrf_token": csrfCookie.Value,
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
		{Name: adminSessionCookie, Path: "/api/admin/v1", HttpOnly: true},
		{Name: adminCSRFCookie, Path: "/api/admin/v1"},
	} {
		cookie.Value = ""
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

func adminStaffDTO(account domain.AdminAccount) map[string]any {
	return map[string]any{
		"id":            account.ID,
		"user_id":       account.UserID,
		"email":         account.Email,
		"name":          account.Name,
		"role":          account.Role,
		"enabled":       account.Enabled,
		"created_at":    account.CreatedAt,
		"updated_at":    account.UpdatedAt,
		"last_login_at": account.LastLoginAt,
	}
}

func adminAuditDTO(record domain.AdminAuditRecord) map[string]any {
	return map[string]any{
		"id":          record.ID,
		"actor":       adminStaffDTO(record.Actor),
		"action":      record.Action,
		"target_type": record.TargetType,
		"target_id":   record.TargetID,
		"reason":      record.Reason,
		"metadata":    record.Metadata,
		"ip_address":  record.IPAddress,
		"user_agent":  record.UserAgent,
		"created_at":  record.CreatedAt,
	}
}

func adminClientMeta(r *http.Request) adminauth.ClientMeta {
	return adminauth.ClientMeta{IPAddress: getClientIP(r), UserAgent: r.UserAgent()}
}

func adminOpsClientMeta(r *http.Request) adminops.ClientMeta {
	return adminops.ClientMeta{IPAddress: getClientIP(r), UserAgent: r.UserAgent()}
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

func handleAdminInboxError(w http.ResponseWriter, r *http.Request, err error) {
	switch {
	case errors.Is(err, admininbox.ErrInvalidFilter):
		writeError(w, http.StatusBadRequest, "Некорректный фильтр очереди.")
	case errors.Is(err, admininbox.ErrInvalidAction):
		writeError(w, http.StatusBadRequest, "Это действие недоступно для элемента очереди.")
	case errors.Is(err, admininbox.ErrReasonRequired):
		writeError(w, http.StatusBadRequest, "Укажите причину решения.")
	case errors.Is(err, admininbox.ErrForbidden):
		writeError(w, http.StatusForbidden, "Недостаточно прав для этого раздела.")
	case errors.Is(err, admininbox.ErrMediaUnavailable):
		writeError(w, http.StatusServiceUnavailable, "Медиа временно недоступно.")
	case errors.Is(err, domain.ErrAdminActionConflict):
		writeError(w, http.StatusConflict, "Состояние уже изменилось. Обновите очередь.")
	case errors.Is(err, domain.ErrNotFound):
		writeError(w, http.StatusNotFound, "Элемент очереди не найден.")
	default:
		writeInternalError(w, r, err, "Не удалось загрузить очередь модерации.")
	}
}

func handleAdminOpsError(w http.ResponseWriter, r *http.Request, err error) {
	switch {
	case errors.Is(err, adminops.ErrInvalidInput):
		writeError(w, http.StatusBadRequest, "Проверьте данные сотрудника.")
	case errors.Is(err, adminops.ErrSelfChange):
		writeError(w, http.StatusConflict, "Нельзя изменить собственную роль или отключить свой доступ.")
	case errors.Is(err, domain.ErrAdminStaffConflict):
		writeError(w, http.StatusConflict, "Изменение невозможно: сотрудник уже добавлен или это последний активный владелец.")
	case errors.Is(err, domain.ErrNotFound):
		writeError(w, http.StatusNotFound, "Аккаунт сотрудника не найден.")
	default:
		writeInternalError(w, r, err, "Не удалось изменить доступ сотрудников.")
	}
}
