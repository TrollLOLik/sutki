package llm

import (
	"bufio"
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

type Client struct {
	baseURL    string
	apiKey     string
	model      string
	timeout    time.Duration
	httpClient *http.Client
}

func NewClient(baseURL, apiKey, model string, timeout time.Duration) *Client {
	if timeout <= 0 {
		timeout = 15 * time.Second
	}
	return &Client{
		baseURL:    baseURL,
		apiKey:     apiKey,
		model:      model,
		timeout:    timeout,
		httpClient: &http.Client{Timeout: timeout},
	}
}

type Message struct {
	Role    string          `json:"role"`
	Content string          `json:"content"`
	Refusal json.RawMessage `json:"refusal,omitempty"`
}

type ChatCompletionsRequest struct {
	Model       string    `json:"model"`
	Messages    []Message `json:"messages"`
	MaxTokens   int       `json:"max_tokens,omitempty"`
	Temperature float64   `json:"temperature,omitempty"`
}

type Choice struct {
	Message      Message `json:"message"`
	FinishReason string  `json:"finish_reason"`
}

type ChatCompletionsResponse struct {
	Choices []Choice `json:"choices"`
}

const visionSafetyRejection = `{"decision":"reject","category":"other","reason":"Провайдер заблокировал изображение как небезопасное.","confidence":1}`

type multimodalContent struct {
	Type     string              `json:"type"`
	Text     string              `json:"text,omitempty"`
	ImageURL *multimodalImageURL `json:"image_url,omitempty"`
}

type multimodalImageURL struct {
	URL string `json:"url"`
}

// GenerateWithImages sends an OpenAI-compatible vision request. Image URLs
// should be short-lived server-issued links, never arbitrary client URLs.
func (c *Client) GenerateWithImages(ctx context.Context, systemPrompt, userPrompt string, imageURLs []string, maxTokens int, temperature float64) (string, error) {
	if c.apiKey == "" {
		return "", fmt.Errorf("llm client: API key is not configured")
	}

	content := make([]multimodalContent, 0, len(imageURLs)+1)
	content = append(content, multimodalContent{Type: "text", Text: userPrompt})
	for _, rawURL := range imageURLs {
		if url := strings.TrimSpace(rawURL); url != "" {
			content = append(content, multimodalContent{Type: "image_url", ImageURL: &multimodalImageURL{URL: url}})
		}
	}
	if len(content) == 1 {
		return "", fmt.Errorf("llm client: no image URLs supplied")
	}

	payload := struct {
		Model       string  `json:"model"`
		Messages    []any   `json:"messages"`
		MaxTokens   int     `json:"max_tokens,omitempty"`
		Temperature float64 `json:"temperature,omitempty"`
	}{
		Model: c.model,
		Messages: []any{
			map[string]any{"role": "system", "content": systemPrompt},
			map[string]any{"role": "user", "content": content},
		},
		MaxTokens: maxTokens, Temperature: temperature,
	}

	jsonBytes, err := json.Marshal(payload)
	if err != nil {
		return "", fmt.Errorf("llm client: marshal vision request failed: %w", err)
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, fmt.Sprintf("%s/chat/completions", c.baseURL), bytes.NewReader(jsonBytes))
	if err != nil {
		return "", fmt.Errorf("llm client: create vision request failed: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", c.apiKey))

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return "", fmt.Errorf("llm client: vision request failed: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		bodyBytes, _ := io.ReadAll(io.LimitReader(resp.Body, 32<<10))
		if isSafetyHTTPRejection(resp.StatusCode, bodyBytes) {
			return visionSafetyRejection, nil
		}
		return "", fmt.Errorf("llm client: vision status %d: %s", resp.StatusCode, string(bodyBytes))
	}

	var response ChatCompletionsResponse
	if err := json.NewDecoder(resp.Body).Decode(&response); err != nil {
		return "", fmt.Errorf("llm client: decode vision response failed: %w", err)
	}
	if len(response.Choices) == 0 {
		return "", fmt.Errorf("llm client: empty choices in vision response")
	}
	choice := response.Choices[0]
	if hasRefusal(choice.Message.Refusal) || isSafetyFinishReason(choice.FinishReason) {
		return visionSafetyRejection, nil
	}
	responseContent := strings.TrimSpace(choice.Message.Content)
	if responseContent == "" {
		finishReason := strings.TrimSpace(choice.FinishReason)
		if finishReason != "" {
			return "", fmt.Errorf("llm client: empty vision response (finish_reason=%s)", finishReason)
		}
		return "", fmt.Errorf("llm client: empty vision response")
	}
	return responseContent, nil
}

func hasRefusal(raw json.RawMessage) bool {
	value := strings.TrimSpace(string(raw))
	return value != "" && value != "null" && value != `""`
}

func isSafetyFinishReason(reason string) bool {
	switch strings.ToLower(strings.TrimSpace(reason)) {
	case "content_filter", "content-filter", "safety", "blocked", "guardrail":
		return true
	default:
		return false
	}
}

func isSafetyHTTPRejection(status int, body []byte) bool {
	switch status {
	case http.StatusBadRequest, http.StatusForbidden, http.StatusUnprocessableEntity:
	default:
		return false
	}

	message := strings.ToLower(string(body))
	for _, marker := range []string{
		"content_filter",
		"content filter",
		"safety violation",
		"unsafe content",
		"blocked by safety",
		"moderation_blocked",
		"moderation blocked",
	} {
		if strings.Contains(message, marker) {
			return true
		}
	}
	return false
}

func (c *Client) Generate(ctx context.Context, systemPrompt, userPrompt string, maxTokens int, temperature float64) (string, error) {
	if c.apiKey == "" {
		return "", fmt.Errorf("llm client: API key is not configured")
	}

	reqBody := ChatCompletionsRequest{
		Model: c.model,
		Messages: []Message{
			{Role: "system", Content: systemPrompt},
			{Role: "user", Content: userPrompt},
		},
		MaxTokens:   maxTokens,
		Temperature: temperature,
	}

	jsonBytes, err := json.Marshal(reqBody)
	if err != nil {
		return "", fmt.Errorf("llm client: marshal request failed: %w", err)
	}

	url := fmt.Sprintf("%s/chat/completions", c.baseURL)
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewBuffer(jsonBytes))
	if err != nil {
		return "", fmt.Errorf("llm client: create HTTP request failed: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", c.apiKey))

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return "", fmt.Errorf("llm client: request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		bodyBytes, _ := io.ReadAll(resp.Body)
		return "", fmt.Errorf("llm client: status %d: %s", resp.StatusCode, string(bodyBytes))
	}

	var respBody ChatCompletionsResponse
	if err := json.NewDecoder(resp.Body).Decode(&respBody); err != nil {
		return "", fmt.Errorf("llm client: decode response failed: %w", err)
	}

	if len(respBody.Choices) == 0 {
		return "", fmt.Errorf("llm client: empty choices in response")
	}

	content := strings.TrimSpace(respBody.Choices[0].Message.Content)
	if content == "" {
		finishReason := strings.TrimSpace(respBody.Choices[0].FinishReason)
		if finishReason != "" {
			return "", fmt.Errorf("llm client: empty message content (finish_reason=%s)", finishReason)
		}
		return "", fmt.Errorf("llm client: empty message content in response")
	}
	return content, nil
}

type Delta struct {
	Content string `json:"content"`
}

type ChoiceDelta struct {
	Delta Delta `json:"delta"`
}

type ChatCompletionsStreamResponse struct {
	Choices []ChoiceDelta `json:"choices"`
}

func (c *Client) GenerateStream(ctx context.Context, systemPrompt, userPrompt string, maxTokens int, temperature float64) (<-chan string, error) {
	if c.apiKey == "" {
		return nil, fmt.Errorf("llm client: API key is not configured")
	}

	// We create a custom struct with Stream for request serialization
	type RequestPayload struct {
		Model       string    `json:"model"`
		Messages    []Message `json:"messages"`
		MaxTokens   int       `json:"max_tokens,omitempty"`
		Temperature float64   `json:"temperature,omitempty"`
		Stream      bool      `json:"stream"`
	}

	reqBody := RequestPayload{
		Model: c.model,
		Messages: []Message{
			{Role: "system", Content: systemPrompt},
			{Role: "user", Content: userPrompt},
		},
		MaxTokens:   maxTokens,
		Temperature: temperature,
		Stream:      true,
	}

	jsonBytes, err := json.Marshal(reqBody)
	if err != nil {
		return nil, fmt.Errorf("llm client: marshal request failed: %w", err)
	}

	url := fmt.Sprintf("%s/chat/completions", c.baseURL)
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewBuffer(jsonBytes))
	if err != nil {
		return nil, fmt.Errorf("llm client: create HTTP request failed: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", c.apiKey))

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("llm client: request failed: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		bodyBytes, _ := io.ReadAll(resp.Body)
		resp.Body.Close()
		return nil, fmt.Errorf("llm client: status %d: %s", resp.StatusCode, string(bodyBytes))
	}

	out := make(chan string, 100)

	go func() {
		defer resp.Body.Close()
		defer close(out)

		reader := bufio.NewReader(resp.Body)
		for {
			line, err := reader.ReadString('\n')
			if err != nil {
				break
			}

			line = strings.TrimSpace(line)
			if line == "" {
				continue
			}

			if !strings.HasPrefix(line, "data: ") {
				continue
			}

			dataStr := strings.TrimPrefix(line, "data: ")
			if dataStr == "[DONE]" {
				break
			}

			var chunk ChatCompletionsStreamResponse
			if err := json.Unmarshal([]byte(dataStr), &chunk); err != nil {
				continue
			}

			if len(chunk.Choices) > 0 {
				content := chunk.Choices[0].Delta.Content
				if content != "" {
					select {
					case out <- content:
					case <-ctx.Done():
						return
					}
				}
			}
		}
	}()

	return out, nil
}
