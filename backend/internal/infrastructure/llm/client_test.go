package llm

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

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
