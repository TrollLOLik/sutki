package postgres

import (
	"encoding/json"
	"testing"
	"time"

	"github.com/TrollLOLik/sutki/backend/internal/domain"
)

func TestRedactDeletedMessagePreservesTombstoneWithoutContent(t *testing.T) {
	now := time.Now().UTC()
	body := "evidence must remain only in storage"
	message := domain.Message{
		ID:          17,
		Body:        &body,
		Payload:     json.RawMessage(`{"private":"value"}`),
		DeletedAt:   &now,
		Attachments: []domain.MessageAttachment{{ID: 9, URL: "private/object.jpg"}},
	}

	got := redactDeletedMessage(message)
	if got.ID != message.ID || got.DeletedAt == nil {
		t.Fatalf("tombstone identity changed: %#v", got)
	}
	if got.Body != nil || got.Payload != nil || got.Attachments != nil {
		t.Fatalf("deleted message content leaked: %#v", got)
	}
}

func TestRedactDeletedMessageLeavesVisibleMessageUntouched(t *testing.T) {
	body := "visible"
	message := domain.Message{ID: 18, Body: &body, Payload: json.RawMessage(`{"ok":true}`)}
	got := redactDeletedMessage(message)
	if got.Body == nil || *got.Body != body || string(got.Payload) != string(message.Payload) {
		t.Fatalf("visible message changed: %#v", got)
	}
}
