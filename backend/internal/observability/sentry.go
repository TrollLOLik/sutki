package observability

import (
	"context"
	"errors"
	"time"

	"github.com/getsentry/sentry-go"
)

// Config contains the deployment identity used to group backend errors.
type Config struct {
	DSN         string
	Environment string
	Release     string
}

// Init configures the process-wide Sentry-compatible client used by GlitchTip.
// The returned function flushes buffered events during graceful shutdown.
func Init(cfg Config) (func(), error) {
	if cfg.DSN == "" {
		return func() {}, nil
	}

	err := sentry.Init(sentry.ClientOptions{
		Dsn:              cfg.DSN,
		Environment:      cfg.Environment,
		Release:          cfg.Release,
		SendDefaultPII:   false,
		AttachStacktrace: true,
		BeforeSend:       scrubEvent,
	})
	if err != nil {
		return func() {}, err
	}

	return func() { sentry.Flush(2 * time.Second) }, nil
}

// CaptureException reports an unexpected error without changing application
// control flow. HTTP requests use the request-local hub installed by sentryhttp.
func CaptureException(ctx context.Context, err error) {
	if err == nil || errors.Is(err, context.Canceled) {
		return
	}
	hub := sentry.GetHubFromContext(ctx)
	if hub == nil {
		hub = sentry.CurrentHub()
	}
	hub.CaptureException(err)
}

// CaptureMessage sends a controlled diagnostic event, primarily for
// post-deploy smoke testing without exposing a public panic endpoint.
func CaptureMessage(ctx context.Context, message string) {
	hub := sentry.GetHubFromContext(ctx)
	if hub == nil {
		hub = sentry.CurrentHub()
	}
	hub.CaptureMessage(message)
}

// CapturePanic reports a recovered panic while allowing the caller to decide
// whether the process should continue or repanic.
func CapturePanic(ctx context.Context, recovered any) {
	if recovered == nil {
		return
	}
	hub := sentry.GetHubFromContext(ctx)
	if hub == nil {
		hub = sentry.CurrentHub()
	}
	hub.RecoverWithContext(ctx, recovered)
}

// RecoverAndRepanic reports an unexpected worker panic before letting the
// process crash. The process supervisor can then restart the service instead
// of silently leaving a critical worker dead.
func RecoverAndRepanic(ctx context.Context) {
	if recovered := recover(); recovered != nil {
		CapturePanic(ctx, recovered)
		sentry.Flush(2 * time.Second)
		panic(recovered)
	}
}

func scrubEvent(event *sentry.Event, _ *sentry.EventHint) *sentry.Event {
	// Keep stack traces and route context, never request contents or identity.
	event.User = sentry.User{}
	if event.Request != nil {
		event.Request.Data = ""
		event.Request.QueryString = ""
		event.Request.Cookies = ""
		event.Request.Headers = nil
		event.Request.Env = nil
	}
	return event
}
