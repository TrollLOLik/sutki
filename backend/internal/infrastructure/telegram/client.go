package telegram

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"html"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/TrollLOLik/sutki/backend/internal/domain"
)

const maxResponseBytes = 16 << 10

var defaultAdminQueueRetryDelays = []time.Duration{time.Second, 3 * time.Second}

type Config struct {
	BotToken              string
	ChatID                string
	Timeout               time.Duration
	BaseURL               string
	AdminURL              string
	AdminQueueRetryDelays []time.Duration
}

type Client struct {
	endpoint    string
	chatID      string
	httpClient  *http.Client
	adminURL    string
	retryDelays []time.Duration
}

func NewClient(cfg Config) *Client {
	baseURL := strings.TrimRight(cfg.BaseURL, "/")
	if baseURL == "" {
		baseURL = "https://api.telegram.org"
	}
	retryDelays := cfg.AdminQueueRetryDelays
	if retryDelays == nil {
		retryDelays = defaultAdminQueueRetryDelays
	}
	return &Client{
		endpoint:    fmt.Sprintf("%s/bot%s/sendMessage", baseURL, cfg.BotToken),
		chatID:      cfg.ChatID,
		httpClient:  &http.Client{Timeout: cfg.Timeout},
		adminURL:    strings.TrimRight(strings.TrimSpace(cfg.AdminURL), "/"),
		retryDelays: append([]time.Duration(nil), retryDelays...),
	}
}

// NotifyAdminQueue sends a compact operator signal. Evidence and user contact
// data deliberately stay in the authenticated panel and are never copied into
// Telegram.
func (c *Client) NotifyAdminQueue(ctx context.Context, event domain.AdminQueueEvent) error {
	label := adminQueueKindLabel(event.Kind)
	lines := []string{
		"<b>" + html.EscapeString(label) + "</b>",
		fmt.Sprintf("<b>ID:</b> %d", event.ID),
	}
	if title := strings.TrimSpace(event.Title); title != "" {
		lines = append(lines, "<b>Объект:</b> "+html.EscapeString(title))
	}
	if reason := strings.TrimSpace(event.Reason); reason != "" {
		lines = append(lines, "<b>Причина:</b> "+html.EscapeString(reason))
	}
	if c.adminURL != "" {
		panelURL := fmt.Sprintf("%s/?kind=%s&id=%d", c.adminURL, url.QueryEscape(event.Kind), event.ID)
		lines = append(lines, fmt.Sprintf(`<a href="%s">Открыть в панели</a>`, html.EscapeString(panelURL)))
	}
	message := strings.Join(lines, "\n")
	var lastErr error
	for attempt := 0; attempt <= len(c.retryDelays); attempt++ {
		if attempt > 0 {
			delay := c.retryDelays[attempt-1]
			timer := time.NewTimer(delay)
			select {
			case <-ctx.Done():
				timer.Stop()
				return fmt.Errorf("notify admin queue: %w", ctx.Err())
			case <-timer.C:
			}
		}

		if err := c.Send(ctx, message); err == nil {
			return nil
		} else {
			lastErr = err
		}
	}
	return fmt.Errorf("notify admin queue after %d attempts: %w", len(c.retryDelays)+1, lastErr)
}

func adminQueueKindLabel(kind string) string {
	switch kind {
	case domain.AdminInboxKindReport:
		return "Новая жалоба"
	case domain.AdminInboxKindListing:
		return "Объявление ждёт ручной проверки"
	case domain.AdminInboxKindReview:
		return "Отзыв ждёт ручной проверки"
	case domain.AdminInboxKindReviewReply:
		return "Ответ на отзыв ждёт ручной проверки"
	case domain.AdminInboxKindAttachment:
		return "Проверка вложения завершилась ошибкой"
	default:
		return "Новый элемент очереди"
	}
}

func (c *Client) Send(ctx context.Context, text string) error {
	body, err := json.Marshal(map[string]any{
		"chat_id":    c.chatID,
		"text":       text,
		"parse_mode": "HTML",
		"link_preview_options": map[string]bool{
			"is_disabled": true,
		},
	})
	if err != nil {
		return fmt.Errorf("encode telegram message: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.endpoint, bytes.NewReader(body))
	if err != nil {
		return fmt.Errorf("create telegram request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		var urlErr *url.Error
		if errors.As(err, &urlErr) {
			// url.Error includes the request URL, and Telegram puts the bot
			// token in that URL. Keep only the underlying transport failure.
			return fmt.Errorf("send telegram message: %w", urlErr.Err)
		}
		return fmt.Errorf("send telegram message: %w", err)
	}
	defer resp.Body.Close()

	responseBody, err := io.ReadAll(io.LimitReader(resp.Body, maxResponseBytes))
	if err != nil {
		return fmt.Errorf("read telegram response: %w", err)
	}

	var result struct {
		OK          bool   `json:"ok"`
		Description string `json:"description"`
	}
	if err := json.Unmarshal(responseBody, &result); err != nil {
		return fmt.Errorf("decode telegram response (status %d): %w", resp.StatusCode, err)
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 || !result.OK {
		if result.Description == "" {
			result.Description = http.StatusText(resp.StatusCode)
		}
		return fmt.Errorf("telegram status %d: %s", resp.StatusCode, result.Description)
	}
	return nil
}
