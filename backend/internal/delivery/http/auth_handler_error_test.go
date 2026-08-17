package http

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/TrollLOLik/sutki/backend/internal/domain"
)

func TestWriteAuthError_EmailAccountNotFound(t *testing.T) {
	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodPost, "/api/v1/auth/email/verify", nil)

	writeAuthError(recorder, request, domain.ErrEmailAccountNotFound)

	if recorder.Code != http.StatusNotFound {
		t.Fatalf("status = %d, want %d", recorder.Code, http.StatusNotFound)
	}
	var body map[string]string
	if err := json.Unmarshal(recorder.Body.Bytes(), &body); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if body["error"] != "email account not found" {
		t.Fatalf("error = %q, want email account not found", body["error"])
	}
}
