package http

import (
	"crypto/subtle"
	"net/http"
	"strconv"

	"github.com/TrollLOLik/sutki/backend/internal/domain"
	"github.com/TrollLOLik/sutki/backend/internal/infrastructure/email"
)

// EmailHandler serves email notification preferences and the login-free
// unsubscribe link embedded in outgoing emails.
type EmailHandler struct {
	prefs             domain.EmailPreferencesRepository
	unsubscribeSecret string
}

func NewEmailHandler(prefs domain.EmailPreferencesRepository, unsubscribeSecret string) *EmailHandler {
	return &EmailHandler{prefs: prefs, unsubscribeSecret: unsubscribeSecret}
}

type emailPreferencesDTO struct {
	Booking    bool `json:"booking"`
	ChatDigest bool `json:"chat_digest"`
	Reviews    bool `json:"reviews"`
}

// GetPreferences handles GET /api/v1/me/email-preferences.
func (h *EmailHandler) GetPreferences(w http.ResponseWriter, r *http.Request) {
	userID, ok := userIDFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "unauthorized")
		return
	}
	p, err := h.prefs.Get(r.Context(), userID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "internal error")
		return
	}
	writeJSON(w, http.StatusOK, emailPreferencesDTO{
		Booking:    p.Booking,
		ChatDigest: p.ChatDigest,
		Reviews:    p.Reviews,
	})
}

// UpdatePreferences handles PUT /api/v1/me/email-preferences with the full
// preference set (missing fields default to false, so clients send all three).
func (h *EmailHandler) UpdatePreferences(w http.ResponseWriter, r *http.Request) {
	userID, ok := userIDFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "unauthorized")
		return
	}
	var req emailPreferencesDTO
	if !decodeJSON(w, r, &req) {
		return
	}
	err := h.prefs.Update(r.Context(), domain.EmailPreferences{
		UserID:     userID,
		Booking:    req.Booking,
		ChatDigest: req.ChatDigest,
		Reviews:    req.Reviews,
	})
	if err != nil {
		writeError(w, http.StatusInternalServerError, "internal error")
		return
	}
	writeJSON(w, http.StatusOK, req)
}

// Unsubscribe handles GET /api/v1/email/unsubscribe?uid=..&cat=..&sig=..
// It requires no login: the HMAC signature proves the link came from an email
// we sent to that user. Responds with a tiny human-readable HTML page because
// the link is opened in a browser from a mail client.
func (h *EmailHandler) Unsubscribe(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	uid64, err := strconv.ParseInt(q.Get("uid"), 10, 32)
	cat := domain.EmailCategory(q.Get("cat"))
	sig := q.Get("sig")
	if err != nil || uid64 <= 0 || sig == "" || !validCategory(cat) {
		unsubscribePage(w, http.StatusBadRequest, "Некорректная ссылка отписки.")
		return
	}
	if h.unsubscribeSecret == "" {
		unsubscribePage(w, http.StatusServiceUnavailable, "Отписка по ссылке временно недоступна.")
		return
	}
	want := email.UnsubscribeSignature(h.unsubscribeSecret, int32(uid64), cat)
	if subtle.ConstantTimeCompare([]byte(want), []byte(sig)) != 1 {
		unsubscribePage(w, http.StatusForbidden, "Ссылка отписки недействительна или устарела.")
		return
	}
	if err := h.prefs.SetCategory(r.Context(), int32(uid64), cat, false); err != nil {
		unsubscribePage(w, http.StatusInternalServerError, "Не удалось сохранить настройку. Попробуйте позже.")
		return
	}
	unsubscribePage(w, http.StatusOK, "Готово! Вы больше не будете получать такие письма. Управлять уведомлениями можно в настройках профиля в приложении.")
}

func validCategory(cat domain.EmailCategory) bool {
	switch cat {
	case domain.EmailCategoryBooking, domain.EmailCategoryChatDigest, domain.EmailCategoryReviews:
		return true
	default:
		return false
	}
}

// unsubscribePage renders a minimal branded confirmation page. The message is
// always a server-controlled constant, never derived from request input.
func unsubscribePage(w http.ResponseWriter, status int, message string) {
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	w.WriteHeader(status)
	_, _ = w.Write([]byte(`<!DOCTYPE html>
<html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>ДомРядом</title></head>
<body style="margin:0;font-family:Arial,Helvetica,sans-serif;background:#F5F2F0;display:flex;min-height:100vh;align-items:center;justify-content:center;">
<div style="background:#FFFFFF;border-radius:12px;padding:32px;max-width:420px;margin:16px;">
<p style="margin:0 0 12px;font-size:18px;font-weight:bold;color:#FF5A1F;">ДомРядом</p>
<p style="margin:0;font-size:15px;line-height:1.5;color:#2B2320;">` + message + `</p>
</div></body></html>`))
}
