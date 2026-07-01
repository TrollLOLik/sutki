package http

import (
	"strings"
)

var mediaURLFunc func(string) string

// ConfigureMediaFormatter sets the function to resolve a stored key to a public URL.
func ConfigureMediaFormatter(f func(string) string) {
	mediaURLFunc = f
}

// resolveMediaURL formats a key into a public URL using the configured helper.
func resolveMediaURL(p string) string {
	if p == "" {
		return ""
	}
	if strings.HasPrefix(p, "http://") || strings.HasPrefix(p, "https://") {
		return p
	}
	if mediaURLFunc != nil {
		return mediaURLFunc(p)
	}
	return p
}
