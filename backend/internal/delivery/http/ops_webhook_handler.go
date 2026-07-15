package http

import (
	"context"
	"crypto/subtle"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"strings"
	"unicode/utf8"
)

const (
	maxGlitchTipWebhookBytes = 64 << 10
	maxTelegramMessageRunes  = 3900
	glitchTipTelegramPath    = "/internal/webhooks/glitchtip/telegram"
)

type opsWebhookTokenContextKey struct{}

type telegramAlertSender interface {
	Send(context.Context, string) error
}

type OpsWebhookHandler struct {
	sender telegramAlertSender
	secret string
}

func NewOpsWebhookHandler(sender telegramAlertSender, secret string) *OpsWebhookHandler {
	if sender == nil || secret == "" {
		return nil
	}
	return &OpsWebhookHandler{sender: sender, secret: secret}
}

type glitchTipWebhook struct {
	Text        string `json:"text"`
	Title       string `json:"title"`
	TitleLink   string `json:"title_link"`
	Description string `json:"description"`
	Attachments []struct {
		Title     string `json:"title"`
		TitleLink string `json:"title_link"`
		Text      string `json:"text"`
	} `json:"attachments"`
}

func (h *OpsWebhookHandler) GlitchTipTelegram(w http.ResponseWriter, r *http.Request) {
	provided, _ := r.Context().Value(opsWebhookTokenContextKey{}).(string)
	if len(provided) != len(h.secret) || subtle.ConstantTimeCompare([]byte(provided), []byte(h.secret)) != 1 {
		writeError(w, http.StatusNotFound, "not found")
		return
	}

	r.Body = http.MaxBytesReader(w, r.Body, maxGlitchTipWebhookBytes)
	defer r.Body.Close()
	var payload glitchTipWebhook
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	message := formatGlitchTipAlert(payload)
	if message == "" {
		writeError(w, http.StatusBadRequest, "empty alert")
		return
	}
	if err := h.sender.Send(r.Context(), message); err != nil {
		// Do not send this error back to GlitchTip: that would recursively
		// invoke the same alert webhook while Telegram is unavailable.
		log.Printf("glitchtip telegram webhook: %v", err)
		writeError(w, http.StatusBadGateway, "telegram delivery failed")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// captureOpsWebhookToken removes the shared secret before request logging and
// keeps it request-local for the handler. GlitchTip generic webhooks cannot set
// a custom authorization header, so the internal URL carries this one token.
func captureOpsWebhookToken(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != glitchTipTelegramPath {
			next.ServeHTTP(w, r)
			return
		}
		query := r.URL.Query()
		token := query.Get("token")
		query.Del("token")
		r.URL.RawQuery = query.Encode()
		// net/http keeps the original request target separately from URL.
		// Chi's request logger uses RequestURI, so sanitize both copies.
		r.RequestURI = r.URL.RequestURI()
		ctx := context.WithValue(r.Context(), opsWebhookTokenContextKey{}, token)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

func formatGlitchTipAlert(payload glitchTipWebhook) string {
	parts := []string{"TiTop Arenda error"}
	appendPart := func(value string) {
		value = strings.TrimSpace(strings.Map(func(r rune) rune {
			if r == '\n' || r == '\t' || r >= ' ' {
				return r
			}
			return -1
		}, value))
		if value != "" {
			parts = append(parts, value)
		}
	}

	appendPart(payload.Title)
	appendPart(payload.Description)
	appendPart(payload.Text)
	appendPart(payload.TitleLink)
	for _, attachment := range payload.Attachments {
		appendPart(attachment.Title)
		appendPart(attachment.Text)
		appendPart(attachment.TitleLink)
	}

	if len(parts) == 1 {
		return ""
	}
	message := strings.Join(parts, "\n\n")
	if utf8.RuneCountInString(message) <= maxTelegramMessageRunes {
		return message
	}
	runes := []rune(message)
	return fmt.Sprintf("%s\n\n[message truncated]", string(runes[:maxTelegramMessageRunes-22]))
}
