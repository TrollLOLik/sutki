package ucaller

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/TrollLOLik/sutki/backend/internal/domain"
)

func TestStartCallUsesEffectiveResponseCode(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if got := r.Header.Get("Authorization"); got != "Bearer secret.303201" {
			t.Fatalf("unexpected authorization header: %s", got)
		}
		var body struct {
			Phone int64  `json:"phone"`
			Code  string `json:"code"`
			Voice bool   `json:"voice"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			t.Fatal(err)
		}
		if body.Phone != 79991234567 || body.Code != "0007" || body.Voice {
			t.Fatalf("unexpected request: %+v", body)
		}
		_, _ = w.Write([]byte(`{"status":true,"ucaller_id":123,"code":"0042","exists":false}`))
	}))
	defer server.Close()

	client := NewClient(Config{APIURL: server.URL, APIKey: "secret", ServiceID: "303201", Enabled: true, Timeout: time.Second})
	result, err := client.StartCall(context.Background(), domain.PhoneCallRequest{
		Phone: "79991234567", Code: "0007", Mode: domain.PhoneDeliveryModeFlashCall, IdempotencyID: "6ba7b810-9dad-41d1-80b4-00c04fd430c8",
	})
	if err != nil {
		t.Fatal(err)
	}
	if result.Code != "0042" {
		t.Fatalf("expected effective provider code 0042, got %q", result.Code)
	}
}
