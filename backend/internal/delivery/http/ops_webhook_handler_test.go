package http

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

type telegramSenderStub struct {
	message string
	err     error
}

func (s *telegramSenderStub) Send(_ context.Context, message string) error {
	s.message = message
	return s.err
}

func requestWithOpsToken(req *http.Request, token string) *http.Request {
	return req.WithContext(context.WithValue(req.Context(), opsWebhookTokenContextKey{}, token))
}

func TestGlitchTipTelegramWebhook(t *testing.T) {
	sender := &telegramSenderStub{}
	handler := NewOpsWebhookHandler(sender, strings.Repeat("a", 32))
	req := httptest.NewRequest(http.MethodPost, glitchTipTelegramPath, strings.NewReader(`{
		"text":"GlitchTip Alert",
		"attachments":[{
			"title":"database <failed>",
			"title_link":"https://errors.example/issue/1",
			"text":"query timeout",
			"fields":[
				{"title":"Project","value":"titop-arenda-api"},
				{"title":"Environment","value":"production"},
				{"title":"Release","value":"abc123"}
			]
		}]
	}`))
	req = requestWithOpsToken(req, strings.Repeat("a", 32))
	rec := httptest.NewRecorder()

	handler.GlitchTipTelegram(rec, req)

	if rec.Code != http.StatusNoContent {
		t.Fatalf("status = %d, body = %s", rec.Code, rec.Body.String())
	}
	for _, want := range []string{"<b>Ошибка в TiTop Arenda</b>", "database &lt;failed&gt;", "query timeout", "<b>Проект:</b> titop-arenda-api", "<b>Окружение:</b> production", "<b>Релиз:</b> abc123", `<a href="https://errors.example/issue/1">Открыть в GlitchTip</a>`} {
		if !strings.Contains(sender.message, want) {
			t.Fatalf("message %q does not contain %q", sender.message, want)
		}
	}
}

func TestGlitchTipTelegramWebhookRejectsInvalidToken(t *testing.T) {
	sender := &telegramSenderStub{}
	handler := NewOpsWebhookHandler(sender, strings.Repeat("a", 32))
	req := httptest.NewRequest(http.MethodPost, glitchTipTelegramPath, strings.NewReader(`{"text":"alert"}`))
	req = requestWithOpsToken(req, "wrong")
	rec := httptest.NewRecorder()

	handler.GlitchTipTelegram(rec, req)

	if rec.Code != http.StatusNotFound || sender.message != "" {
		t.Fatalf("status = %d, message = %q", rec.Code, sender.message)
	}
}

func TestGlitchTipTelegramWebhookDoesNotReportDeliveryLoop(t *testing.T) {
	sender := &telegramSenderStub{err: errors.New("telegram unavailable")}
	handler := NewOpsWebhookHandler(sender, strings.Repeat("a", 32))
	req := httptest.NewRequest(http.MethodPost, glitchTipTelegramPath, strings.NewReader(`{"text":"alert"}`))
	req = requestWithOpsToken(req, strings.Repeat("a", 32))
	rec := httptest.NewRecorder()

	handler.GlitchTipTelegram(rec, req)

	if rec.Code != http.StatusBadGateway {
		t.Fatalf("status = %d", rec.Code)
	}
}

func TestCaptureOpsWebhookTokenRedactsQueryBeforeNextHandler(t *testing.T) {
	const secret = "secret-value"
	next := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.RawQuery != "keep=value" {
			t.Fatalf("raw query = %q", r.URL.RawQuery)
		}
		if r.RequestURI != glitchTipTelegramPath+"?keep=value" {
			t.Fatalf("request URI = %q", r.RequestURI)
		}
		if got, _ := r.Context().Value(opsWebhookTokenContextKey{}).(string); got != secret {
			t.Fatalf("context token = %q", got)
		}
		w.WriteHeader(http.StatusNoContent)
	})
	req := httptest.NewRequest(http.MethodPost, glitchTipTelegramPath+"?token="+secret+"&keep=value", nil)
	rec := httptest.NewRecorder()

	captureOpsWebhookToken(next).ServeHTTP(rec, req)

	if rec.Code != http.StatusNoContent {
		t.Fatalf("status = %d", rec.Code)
	}
}
