package http

import (
	"context"
	"net/http"
	"strings"
	"unicode/utf8"

	"github.com/TrollLOLik/sutki/backend/internal/usecase/auth"
)

type callbackRequestNotifier interface {
	SendCallbackRequest(ctx context.Context, recipient, name, phone, message, clientIP string) error
}

// SupportHandler accepts public website forms and queues them through the
// backend's durable email outbox. It owns validation and abuse limits so a
// caller cannot bypass them by posting directly to the API.
type SupportHandler struct {
	notifier  callbackRequestNotifier
	recipient string
}

func NewSupportHandler(notifier callbackRequestNotifier, recipient string) *SupportHandler {
	return &SupportHandler{notifier: notifier, recipient: strings.TrimSpace(recipient)}
}

type callbackRequestBody struct {
	Name    string `json:"name"`
	Phone   string `json:"phone"`
	Message string `json:"message"`
}

func (h *SupportHandler) CallbackRequest(w http.ResponseWriter, r *http.Request) {
	if h == nil || h.notifier == nil || h.recipient == "" {
		writeError(w, http.StatusServiceUnavailable, "Приём заявок временно недоступен. Попробуйте позже.")
		return
	}

	var body callbackRequestBody
	if !decodeJSON(w, r, &body) {
		return
	}
	body.Name = strings.TrimSpace(body.Name)
	body.Message = strings.TrimSpace(body.Message)
	phone, err := auth.NormalizePhone(body.Phone)
	if err != nil || body.Name == "" || utf8.RuneCountInString(body.Name) > 100 || utf8.RuneCountInString(body.Message) > 2000 {
		writeError(w, http.StatusBadRequest, "Укажите имя и корректный российский номер телефона.")
		return
	}
	if body.Message == "" {
		body.Message = "Комментарий не указан"
	}

	clientIP := getClientIP(r)
	if !CallbackRequestLimiter.Allow("callback_ip:"+clientIP, callbackRequestsPerIPHour) ||
		!CallbackRequestLimiter.Allow("callback_phone:"+phone, callbackRequestsPerPhoneHour) {
		writeRateLimitError(w, "Слишком много заявок. Попробуйте позже.")
		return
	}

	if err := h.notifier.SendCallbackRequest(r.Context(), h.recipient, body.Name, phone, body.Message, clientIP); err != nil {
		writeInternalError(w, r, err, "Не удалось отправить заявку. Попробуйте позже.")
		return
	}
	writeJSON(w, http.StatusAccepted, map[string]string{"status": "queued"})
}
