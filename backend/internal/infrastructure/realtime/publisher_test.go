package realtime

import (
	"context"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/TrollLOLik/sutki/backend/internal/domain"
)

func TestPublishUserEventChecksCentrifugoResponse(t *testing.T) {
	tests := []struct {
		name     string
		response string
		wantErr  bool
	}{
		{name: "success", response: `{"result":{}}`},
		{name: "application error", response: `{"error":{"code":102,"message":"unknown channel"}}`, wantErr: true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				if r.URL.Path != "/api" {
					t.Fatalf("unexpected path %q", r.URL.Path)
				}
				if got := r.Header.Get("X-API-Key"); got != "secret" {
					t.Fatalf("unexpected API key %q", got)
				}
				w.Header().Set("Content-Type", "application/json")
				fmt.Fprint(w, tt.response)
			}))
			defer server.Close()

			publisher := NewPublisher(nil, server.URL, "secret")
			err := publisher.PublishUserEvent(context.Background(), 42, domain.UserEvent{
				Type: "listing.changed", Action: "updated", EntityID: 7,
			})
			if (err != nil) != tt.wantErr {
				t.Fatalf("PublishUserEvent() error = %v, wantErr %v", err, tt.wantErr)
			}
		})
	}
}
