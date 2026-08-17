package telegram

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/TrollLOLik/sutki/backend/internal/domain"
)

func TestClientSend(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/bottest-token/sendMessage" {
			t.Fatalf("path = %q", r.URL.Path)
		}
		var body struct {
			ChatID    string `json:"chat_id"`
			Text      string `json:"text"`
			ParseMode string `json:"parse_mode"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			t.Fatalf("decode request: %v", err)
		}
		if body.ChatID != "-100123" || body.Text != "test alert" || body.ParseMode != "HTML" {
			t.Fatalf("body = %#v", body)
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"ok":true,"result":{}}`))
	}))
	defer server.Close()

	client := NewClient(Config{BotToken: "test-token", ChatID: "-100123", Timeout: time.Second, BaseURL: server.URL})
	if err := client.Send(context.Background(), "test alert"); err != nil {
		t.Fatalf("send: %v", err)
	}
}

func TestClientNotifyAdminQueueEscapesUntrustedText(t *testing.T) {
	var text string
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var body struct {
			Text string `json:"text"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			t.Fatalf("decode request: %v", err)
		}
		text = body.Text
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"ok":true,"result":{}}`))
	}))
	defer server.Close()

	client := NewClient(Config{
		BotToken: "test-token", ChatID: "-100123", Timeout: time.Second,
		BaseURL: server.URL, AdminURL: "https://admin.wigaj.ru",
	})
	err := client.NotifyAdminQueue(context.Background(), domain.AdminQueueEvent{
		Kind: domain.AdminInboxKindReport, ID: 42,
		Title: `<b>подмена</b>`, Reason: `спам & обман`,
	})
	if err != nil {
		t.Fatalf("notify admin queue: %v", err)
	}
	if strings.Contains(text, "<b>подмена</b>") || !strings.Contains(text, "&lt;b&gt;подмена&lt;/b&gt;") {
		t.Fatalf("untrusted title was not escaped: %q", text)
	}
	if !strings.Contains(text, "https://admin.wigaj.ru/?kind=report&amp;id=42") {
		t.Fatalf("admin detail URL missing: %q", text)
	}
}

func TestClientNotifyAdminQueueBuildsDeepLinkForEveryKind(t *testing.T) {
	var text string
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var body struct {
			Text string `json:"text"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			t.Fatalf("decode request: %v", err)
		}
		text = body.Text
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"ok":true,"result":{}}`))
	}))
	defer server.Close()

	client := NewClient(Config{
		BotToken: "test-token", ChatID: "-100123", Timeout: time.Second,
		BaseURL: server.URL, AdminURL: " https://admin.wigaj.ru/ ",
	})
	testCases := []struct {
		kind  string
		label string
	}{
		{domain.AdminInboxKindReport, "Новая жалоба"},
		{domain.AdminInboxKindListing, "Объявление ждёт ручной проверки"},
		{domain.AdminInboxKindReview, "Отзыв ждёт ручной проверки"},
		{domain.AdminInboxKindReviewReply, "Ответ на отзыв ждёт ручной проверки"},
		{domain.AdminInboxKindAttachment, "Проверка вложения завершилась ошибкой"},
	}

	for index, testCase := range testCases {
		t.Run(testCase.kind, func(t *testing.T) {
			text = ""
			id := int64(index + 101)
			if err := client.NotifyAdminQueue(context.Background(), domain.AdminQueueEvent{Kind: testCase.kind, ID: id}); err != nil {
				t.Fatalf("notify admin queue: %v", err)
			}
			wantURL := "https://admin.wigaj.ru/?kind=" + testCase.kind + "&amp;id=" + fmt.Sprint(id)
			if !strings.Contains(text, wantURL) {
				t.Fatalf("deep link missing: want %q in %q", wantURL, text)
			}
			if !strings.Contains(text, testCase.label) {
				t.Fatalf("kind label missing: want %q in %q", testCase.label, text)
			}
		})
	}
}

func TestClientSendReturnsTelegramError(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusBadRequest)
		_, _ = w.Write([]byte(`{"ok":false,"description":"chat not found"}`))
	}))
	defer server.Close()

	client := NewClient(Config{BotToken: "test-token", ChatID: "bad", Timeout: time.Second, BaseURL: server.URL})
	if err := client.Send(context.Background(), "test"); err == nil {
		t.Fatal("expected Telegram error")
	}
}

func TestClientSendDoesNotExposeBotTokenOnTransportError(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(http.ResponseWriter, *http.Request) {}))
	baseURL := server.URL
	server.Close()

	const token = "super-secret-bot-token"
	client := NewClient(Config{BotToken: token, ChatID: "-100123", Timeout: time.Second, BaseURL: baseURL})
	err := client.Send(context.Background(), "test")
	if err == nil {
		t.Fatal("expected transport error")
	}
	if strings.Contains(err.Error(), token) {
		t.Fatalf("transport error exposed bot token: %v", err)
	}
}
