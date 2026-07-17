package llm

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

func TestGenerateWithImagesUsesOpenAIContentParts(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var body struct {
			Model    string `json:"model"`
			Messages []struct {
				Role    string          `json:"role"`
				Content json.RawMessage `json:"content"`
			} `json:"messages"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			t.Fatal(err)
		}
		if body.Model != "vision-model" || len(body.Messages) != 2 {
			t.Fatalf("body=%+v", body)
		}
		var parts []map[string]any
		if err := json.Unmarshal(body.Messages[1].Content, &parts); err != nil {
			t.Fatal(err)
		}
		if len(parts) != 2 || parts[0]["type"] != "text" || parts[1]["type"] != "image_url" {
			t.Fatalf("parts=%#v", parts)
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"choices":[{"message":{"role":"assistant","content":"{\"decision\":\"approve\"}"}}]}`))
	}))
	defer server.Close()

	client := NewClient(server.URL, "key", "vision-model", time.Second)
	answer, err := client.GenerateWithImages(context.Background(), "system", "user", []string{"https://storage.test/image"}, 20, 0)
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(answer, "approve") {
		t.Fatalf("answer=%q", answer)
	}
}

func TestGenerateRejectsEmptyContent(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_, _ = w.Write([]byte(`{"choices":[{"message":{"role":"assistant","content":"   "}}]}`))
	}))
	defer server.Close()

	client := NewClient(server.URL, "key", "model", time.Second)
	_, err := client.Generate(context.Background(), "system", "user", 20, 0)
	if err == nil || !strings.Contains(err.Error(), "empty message content") {
		t.Fatalf("expected empty content error, got %v", err)
	}
}

func TestGenerateWithImagesIncludesFinishReasonForEmptyContent(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_, _ = w.Write([]byte(`{"choices":[{"finish_reason":"length","message":{"role":"assistant","content":null}}]}`))
	}))
	defer server.Close()

	client := NewClient(server.URL, "key", "vision-model", time.Second)
	_, err := client.GenerateWithImages(context.Background(), "system", "user", []string{"data:image/png;base64,AA=="}, 20, 0)
	if err == nil || !strings.Contains(err.Error(), "finish_reason=length") {
		t.Fatalf("expected finish reason error, got %v", err)
	}
}

func TestGenerateIncludesFinishReasonForEmptyContent(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_, _ = w.Write([]byte(`{"choices":[{"finish_reason":"length","message":{"role":"assistant","content":null}}]}`))
	}))
	defer server.Close()

	client := NewClient(server.URL, "key", "model", time.Second)
	_, err := client.Generate(context.Background(), "system", "user", 20, 0)
	if err == nil || !strings.Contains(err.Error(), "finish_reason=length") {
		t.Fatalf("expected finish reason error, got %v", err)
	}
}
