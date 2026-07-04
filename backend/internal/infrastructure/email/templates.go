package email

import (
	"embed"
	"fmt"
	htmltemplate "html/template"
	"strings"
	texttemplate "text/template"
)

//go:embed templates/*.html templates/*.txt
var templateFS embed.FS

// Event types double as template base names and dedup-key prefixes.
const (
	EventOTPCode          = "otp_code"
	EventBookingNew       = "booking_new"
	EventBookingConfirmed = "booking_confirmed"
	EventBookingRejected  = "booking_rejected"
)

var eventTypes = []string{
	EventOTPCode,
	EventBookingNew,
	EventBookingConfirmed,
	EventBookingRejected,
}

// renderer holds pre-parsed HTML and plain-text template sets per event.
// Both variants share the "layout" entry template; each event file defines
// the "content" block.
type renderer struct {
	html map[string]*htmltemplate.Template
	text map[string]*texttemplate.Template
}

func newRenderer() (*renderer, error) {
	r := &renderer{
		html: make(map[string]*htmltemplate.Template, len(eventTypes)),
		text: make(map[string]*texttemplate.Template, len(eventTypes)),
	}
	for _, ev := range eventTypes {
		ht, err := htmltemplate.ParseFS(templateFS, "templates/layout.html", "templates/"+ev+".html")
		if err != nil {
			return nil, fmt.Errorf("parse html template %s: %w", ev, err)
		}
		r.html[ev] = ht

		tt, err := texttemplate.ParseFS(templateFS, "templates/layout.txt", "templates/"+ev+".txt")
		if err != nil {
			return nil, fmt.Errorf("parse text template %s: %w", ev, err)
		}
		r.text[ev] = tt
	}
	return r, nil
}

// render produces the plain-text and HTML bodies for an event.
func (r *renderer) render(event string, data any) (textBody, htmlBody string, err error) {
	ht, ok := r.html[event]
	if !ok {
		return "", "", fmt.Errorf("unknown email event %q", event)
	}
	tt := r.text[event]

	var hb strings.Builder
	if err := ht.ExecuteTemplate(&hb, "layout", data); err != nil {
		return "", "", fmt.Errorf("render html %s: %w", event, err)
	}
	var tb strings.Builder
	if err := tt.ExecuteTemplate(&tb, "layout", data); err != nil {
		return "", "", fmt.Errorf("render text %s: %w", event, err)
	}
	return tb.String(), hb.String(), nil
}
