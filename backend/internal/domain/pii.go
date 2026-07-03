package domain

import "strings"

// MaskEmail redacts an email address for log output ("ab***@example.com") so
// application logs don't accumulate plaintext PII (152-FZ hygiene).
func MaskEmail(email string) string {
	at := strings.IndexByte(email, '@')
	if at <= 0 {
		return "***"
	}
	local := email[:at]
	if len(local) <= 2 {
		return local[:1] + "***" + email[at:]
	}
	return local[:2] + "***" + email[at:]
}
