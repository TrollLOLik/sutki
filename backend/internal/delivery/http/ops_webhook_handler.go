package http

import (
	"context"
	"crypto/subtle"
	"encoding/json"
	"html"
	"log"
	"net/http"
	"net/url"
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
		Fields    []struct {
			Title string `json:"title"`
			Value string `json:"value"`
		} `json:"fields"`
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
	header := "<b>Ошибка в TiTop Arenda</b>"
	blocks := make([]string, 0, len(payload.Attachments)+1)
	for _, attachment := range payload.Attachments {
		lines := make([]string, 0, len(attachment.Fields)+3)
		if title := telegramHTMLText(attachment.Title, 300); title != "" {
			lines = append(lines, "<b>"+title+"</b>")
		}
		if culprit := telegramHTMLText(attachment.Text, 800); culprit != "" {
			lines = append(lines, "<code>"+culprit+"</code>")
		}
		for _, field := range attachment.Fields {
			label := telegramFieldLabel(cleanTelegramText(field.Title, 80))
			value := telegramHTMLText(field.Value, 300)
			if label != "" && value != "" {
				lines = append(lines, "<b>"+html.EscapeString(label)+":</b> "+value)
			}
		}
		if link := telegramLink(attachment.TitleLink); link != "" {
			lines = append(lines, `<a href="`+link+`">Открыть в GlitchTip</a>`)
		}
		if len(lines) > 0 {
			blocks = append(blocks, strings.Join(lines, "\n"))
		}
	}

	if len(blocks) == 0 {
		for _, value := range []string{payload.Title, payload.Description, payload.Text} {
			if text := telegramHTMLText(value, 1000); text != "" {
				blocks = append(blocks, text)
			}
		}
		if link := telegramLink(payload.TitleLink); link != "" {
			blocks = append(blocks, `<a href="`+link+`">Открыть в GlitchTip</a>`)
		}
	}

	if len(blocks) == 0 {
		return ""
	}

	message := header
	for _, block := range blocks {
		candidate := message + "\n\n" + block
		if utf8.RuneCountInString(candidate) > maxTelegramMessageRunes-40 {
			message += "\n\n<i>Остальные ошибки скрыты</i>"
			break
		}
		message = candidate
	}
	return message
}

func cleanTelegramText(value string, limit int) string {
	value = strings.TrimSpace(strings.Map(func(r rune) rune {
		if r == '\n' || r == '\t' || r >= ' ' {
			return r
		}
		return -1
	}, value))
	runes := []rune(value)
	if len(runes) > limit {
		return string(runes[:limit-3]) + "..."
	}
	return value
}

func telegramHTMLText(value string, limit int) string {
	return html.EscapeString(cleanTelegramText(value, limit))
}

func telegramFieldLabel(label string) string {
	switch strings.ToLower(label) {
	case "project":
		return "Проект"
	case "environment":
		return "Окружение"
	case "server name":
		return "Сервер"
	case "release":
		return "Релиз"
	default:
		return label
	}
}

func telegramLink(value string) string {
	value = cleanTelegramText(value, 1000)
	parsed, err := url.Parse(value)
	if err != nil || (parsed.Scheme != "http" && parsed.Scheme != "https") || parsed.Host == "" {
		return ""
	}
	return html.EscapeString(value)
}
