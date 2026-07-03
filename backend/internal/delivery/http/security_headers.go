package http

import "net/http"

// securityHeaders sets baseline hardening headers appropriate for a JSON API:
//   - nosniff prevents browsers from MIME-sniffing JSON responses into
//     executable content;
//   - no-store keeps auth/PII-bearing responses out of shared caches and
//     browser history;
//   - DENY blocks the API's error pages from being framed in clickjacking
//     attempts (harmless for the mobile app, protects any web consumers).
func securityHeaders(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		h := w.Header()
		h.Set("X-Content-Type-Options", "nosniff")
		h.Set("Cache-Control", "no-store")
		h.Set("X-Frame-Options", "DENY")
		next.ServeHTTP(w, r)
	})
}
