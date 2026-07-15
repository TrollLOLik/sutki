package telegram

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

const maxResponseBytes = 16 << 10

type Config struct {
	BotToken string
	ChatID   string
	Timeout  time.Duration
	BaseURL  string
}

type Client struct {
	endpoint   string
	chatID     string
	httpClient *http.Client
}

func NewClient(cfg Config) *Client {
	baseURL := strings.TrimRight(cfg.BaseURL, "/")
	if baseURL == "" {
		baseURL = "https://api.telegram.org"
	}
	return &Client{
		endpoint:   fmt.Sprintf("%s/bot%s/sendMessage", baseURL, cfg.BotToken),
		chatID:     cfg.ChatID,
		httpClient: &http.Client{Timeout: cfg.Timeout},
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
