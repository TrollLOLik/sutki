package observability

import (
	"context"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/getsentry/sentry-go"
)

type recordingTransport struct {
	mu     sync.Mutex
	events []*sentry.Event
}

func (t *recordingTransport) Flush(time.Duration) bool              { return true }
func (t *recordingTransport) FlushWithContext(context.Context) bool { return true }
func (t *recordingTransport) Configure(sentry.ClientOptions)        {}
func (t *recordingTransport) Close()                                {}
func (t *recordingTransport) SendEvent(event *sentry.Event) {
	t.mu.Lock()
	defer t.mu.Unlock()
	t.events = append(t.events, event)
}

func TestCaptureExceptionUsesContextHub(t *testing.T) {
	transport := &recordingTransport{}
	client, err := sentry.NewClient(sentry.ClientOptions{Dsn: "https://public@example.com/1", Transport: transport})
	if err != nil {
		t.Fatalf("new client: %v", err)
	}
	hub := sentry.NewHub(client, sentry.NewScope())
	ctx := sentry.SetHubOnContext(context.Background(), hub)

	CaptureException(ctx, errors.New("database unavailable"))

	transport.mu.Lock()
	defer transport.mu.Unlock()
	if len(transport.events) != 1 {
		t.Fatalf("events = %d, want 1", len(transport.events))
	}
	if got := transport.events[0].Exception[0].Value; got != "database unavailable" {
		t.Fatalf("exception = %q", got)
	}
}

func TestScrubEventRemovesRequestPII(t *testing.T) {
	event := &sentry.Event{
		User: sentry.User{Email: "guest@example.com", IPAddress: "127.0.0.1"},
		Request: &sentry.Request{
			Data:        `{"phone":"79990000000"}`,
			QueryString: "email=guest@example.com",
			Cookies:     "session=secret",
			Headers:     map[string]string{"Authorization": "Bearer secret"},
			Env:         map[string]string{"REMOTE_ADDR": "127.0.0.1"},
		},
	}

	got := scrubEvent(event, nil)
	if got.User.Email != "" || got.User.IPAddress != "" {
		t.Fatalf("user identity was not removed: %#v", got.User)
	}
	if got.Request.Data != "" || got.Request.QueryString != "" || got.Request.Cookies != "" || got.Request.Headers != nil || got.Request.Env != nil {
		t.Fatalf("request PII was not removed: %#v", got.Request)
	}
}

func TestInitSendsLegacyEventEnvelope(t *testing.T) {
	bodyCh := make(chan string, 1)
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		body, err := io.ReadAll(r.Body)
		if err != nil {
			t.Errorf("read envelope: %v", err)
		}
		bodyCh <- string(body)
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte("{}"))
	}))
	defer server.Close()

	hub := sentry.CurrentHub()
	previousClient := hub.Client()
	defer hub.BindClient(previousClient)
	dsn := strings.Replace(server.URL, "http://", "http://public@", 1) + "/1"
	flush, err := Init(Config{DSN: dsn, Environment: "test", Release: "test-release"})
	if err != nil {
		t.Fatalf("init: %v", err)
	}

	CaptureException(context.Background(), errors.New("legacy envelope test"))
	flush()

	select {
	case body := <-bodyCh:
		if !strings.Contains(body, `"type":"event"`) {
			t.Fatalf("envelope has no event item header: %s", body)
		}
		if !strings.Contains(body, `"exception"`) {
			t.Fatalf("envelope has no exception payload: %s", body)
		}
	case <-time.After(3 * time.Second):
		t.Fatal("timed out waiting for envelope")
	}
}
