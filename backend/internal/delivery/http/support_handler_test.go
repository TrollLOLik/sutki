package http

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

type callbackNotifierStub struct {
	called    int
	recipient string
	name      string
	phone     string
	message   string
}

func (n *callbackNotifierStub) SendCallbackRequest(_ context.Context, recipient, name, phone, message, _ string) error {
	n.called++
	n.recipient = recipient
	n.name = name
	n.phone = phone
	n.message = message
	return nil
}

func TestSupportHandlerQueuesCallbackRequest(t *testing.T) {
	CallbackRequestLimiter = NewSlidingWindowLimiter(time.Hour)
	notifier := &callbackNotifierStub{}
	h := NewSupportHandler(notifier, "support@wigaj.ru")
	req := httptest.NewRequest(http.MethodPost, "/api/v1/support/callback-requests",
		strings.NewReader(`{"name":" Александр ","phone":"8 (982) 322-50-60","message":" Перезвоните вечером "}`))
	req.Header.Set("Content-Type", "application/json")
	req.RemoteAddr = "192.0.2.10:4321"
	w := httptest.NewRecorder()

	h.CallbackRequest(w, req)

	if w.Code != http.StatusAccepted {
		t.Fatalf("status = %d, body = %s", w.Code, w.Body.String())
	}
	if notifier.called != 1 || notifier.recipient != "support@wigaj.ru" || notifier.name != "Александр" || notifier.phone != "+79823225060" || notifier.message != "Перезвоните вечером" {
		t.Fatalf("unexpected queued request: %+v", notifier)
	}
}

func TestSupportHandlerRejectsInvalidPhone(t *testing.T) {
	CallbackRequestLimiter = NewSlidingWindowLimiter(time.Hour)
	notifier := &callbackNotifierStub{}
	h := NewSupportHandler(notifier, "support@wigaj.ru")
	req := httptest.NewRequest(http.MethodPost, "/api/v1/support/callback-requests",
		strings.NewReader(`{"name":"Александр","phone":"123","message":""}`))
	w := httptest.NewRecorder()

	h.CallbackRequest(w, req)

	if w.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, body = %s", w.Code, w.Body.String())
	}
	if notifier.called != 0 {
		t.Fatal("invalid request must not be queued")
	}
}

func TestSupportHandlerRequiresRecipient(t *testing.T) {
	h := NewSupportHandler(&callbackNotifierStub{}, "")
	req := httptest.NewRequest(http.MethodPost, "/api/v1/support/callback-requests",
		strings.NewReader(`{"name":"Александр","phone":"+79823225060"}`))
	w := httptest.NewRecorder()

	h.CallbackRequest(w, req)

	if w.Code != http.StatusServiceUnavailable {
		t.Fatalf("status = %d, body = %s", w.Code, w.Body.String())
	}
}
