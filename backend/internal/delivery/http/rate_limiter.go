package http

import (
	"net"
	"net/http"
	"os"
	"strconv"
	"strings"
	"sync"
	"time"
)

type SlidingWindowLimiter struct {
	mu      sync.Mutex
	records map[string][]time.Time
	window  time.Duration
}

func NewSlidingWindowLimiter(window time.Duration) *SlidingWindowLimiter {
	l := &SlidingWindowLimiter{
		records: make(map[string][]time.Time),
		window:  window,
	}
	// Start a background goroutine to clean up expired entries every 10 minutes
	go func() {
		ticker := time.NewTicker(10 * time.Minute)
		for range ticker.C {
			l.Cleanup()
		}
	}()
	return l
}

func (l *SlidingWindowLimiter) Allow(key string, limit int) bool {
	if key == "" {
		return true
	}
	l.mu.Lock()
	defer l.mu.Unlock()

	now := time.Now()
	cutoff := now.Add(-l.window)

	timestamps := l.records[key]
	validCount := 0
	for _, ts := range timestamps {
		if ts.After(cutoff) {
			timestamps[validCount] = ts
			validCount++
		}
	}
	timestamps = timestamps[:validCount]

	if len(timestamps) >= limit {
		l.records[key] = timestamps
		return false
	}

	timestamps = append(timestamps, now)
	l.records[key] = timestamps
	return true
}

func (l *SlidingWindowLimiter) Cleanup() {
	l.mu.Lock()
	defer l.mu.Unlock()

	cutoff := time.Now().Add(-l.window)
	for key, timestamps := range l.records {
		validCount := 0
		for _, ts := range timestamps {
			if ts.After(cutoff) {
				timestamps[validCount] = ts
				validCount++
			}
		}
		timestamps = timestamps[:validCount]
		if len(timestamps) == 0 {
			delete(l.records, key)
		} else {
			l.records[key] = timestamps
		}
	}
}

// Global instances for rate limiters
var (
	// OTP Rate Limiters (1 hour window)
	OTPEmailLimiter   = NewSlidingWindowLimiter(time.Hour)
	OTPPhoneLimiter   = NewSlidingWindowLimiter(time.Hour)
	OTPGuestIDLimiter = NewSlidingWindowLimiter(time.Hour)
	OTPIPLimiter      = NewSlidingWindowLimiter(time.Hour)

	// OTP verification limiters. The per-challenge attempt budget in the
	// database is the hard stop for one code; these bound how many *codes* an
	// attacker may work through. Without them, requesting a fresh code after
	// each exhausted budget gives unlimited guesses against a 4-digit space.
	//
	// Per-identifier (phone/email) is the meaningful key — it survives IP
	// rotation, which is cheap. The per-IP window is a coarse second net, and
	// the per-challenge one keeps a single code from being hammered even if the
	// database guard is ever weakened.
	//
	// NOTE(multi-instance): like every limiter here, these are per-process and
	// reset on deploy. They must move to a shared store before a second replica.
	OTPVerifyChallengeLimiter = NewSlidingWindowLimiter(time.Hour)
	OTPVerifyIdentityLimiter  = NewSlidingWindowLimiter(time.Hour)
	OTPVerifyIPLimiter        = NewSlidingWindowLimiter(time.Hour)

	// Booking Rate Limiters (1 hour window)
	BookingPhoneLimiter   = NewSlidingWindowLimiter(time.Hour)
	BookingGuestIDLimiter = NewSlidingWindowLimiter(time.Hour)
	BookingIPLimiter      = NewSlidingWindowLimiter(time.Hour)

	// Chat conversation-creation limiter (1 hour window, anti-spam)
	ChatConversationLimiter = NewSlidingWindowLimiter(time.Hour)
	// Ephemeral typing publications. Normal clients emit at most once every
	// two seconds, so this still leaves generous reconnect headroom.
	ChatTypingLimiter = NewSlidingWindowLimiter(time.Minute)
	// AI reply suggestions. Bounds how often one user can trigger a paid model
	// call by opening chats.
	ChatSuggestionLimiter = NewSlidingWindowLimiter(time.Hour)
	// Manual media moderation retries. The failed->pending transition is also
	// atomic, while this cap limits repeated paid attempts during an outage.
	ChatAttachmentRetryLimiter = NewSlidingWindowLimiter(time.Minute)

	ViewIdentityLimiter = NewSlidingWindowLimiter(time.Hour)
	ViewIPLimiter       = NewSlidingWindowLimiter(time.Hour)
)

// Verification budgets per hour. maxAttempts (5) codes' worth of guesses per
// identifier leaves ordinary mistyping unaffected — a real user needs a handful
// of tries, not tens.
const (
	otpVerifyPerChallenge = 10
	otpVerifyPerIdentity  = 25
	otpVerifyPerIP        = 60
)

// otpChallengeKey returns a per-challenge limiter key, or "" when the client
// did not supply a real challenge id.
//
// Legacy clients put a delivery-channel value (`phone_call`, …) in the field
// the challenge id is read from. Those are a low-cardinality enum shared by
// every user, so using one as a limiter key would collapse all callers into a
// single bucket and lock the whole endpoint after a handful of logins.
func otpChallengeKey(challengeID string) string {
	if strings.HasPrefix(challengeID, "phone_") {
		return ""
	}
	return challengeID
}

// allowOTPVerify applies the verification budgets and writes the 429 itself.
// identity is the normalized phone or email; challenge may be empty when the
// client did not send one.
func allowOTPVerify(w http.ResponseWriter, r *http.Request, identity, challenge string) bool {
	if challenge != "" && !OTPVerifyChallengeLimiter.Allow("otp_verify_challenge:"+challenge, otpVerifyPerChallenge) {
		writeError(w, http.StatusTooManyRequests, "Слишком много попыток ввода кода. Запросите новый код позже.")
		return false
	}
	if !OTPVerifyIdentityLimiter.Allow("otp_verify_id:"+identity, otpVerifyPerIdentity) {
		writeError(w, http.StatusTooManyRequests, "Слишком много попыток ввода кода. Пожалуйста, попробуйте позже.")
		return false
	}
	if !OTPVerifyIPLimiter.Allow("otp_verify_ip:"+getClientIP(r), otpVerifyPerIP) {
		writeError(w, http.StatusTooManyRequests, "Слишком много попыток с вашего IP. Пожалуйста, попробуйте позже.")
		return false
	}
	return true
}

// trustProxyHeaders controls whether X-Forwarded-For / X-Real-IP are honored.
// It must only be enabled (TRUST_PROXY_HEADERS=true) when the backend sits
// behind a trusted reverse proxy that overwrites/appends these headers.
// Otherwise any client could spoof its IP and bypass per-IP rate limits.
var trustProxyHeaders = func() bool {
	v, err := strconv.ParseBool(os.Getenv("TRUST_PROXY_HEADERS"))
	return err == nil && v
}()

// getClientIP extracts the client IP address. Proxy headers are only trusted
// when TRUST_PROXY_HEADERS=true; in that case the LAST X-Forwarded-For entry
// is used because it is the one appended by our own (single, trusted) proxy
// hop — earlier entries are attacker-controllable.
func getClientIP(r *http.Request) string {
	if trustProxyHeaders {
		if xff := r.Header.Get("X-Forwarded-For"); xff != "" {
			parts := strings.Split(xff, ",")
			if ip := strings.TrimSpace(parts[len(parts)-1]); ip != "" {
				return ip
			}
		}
		if xri := r.Header.Get("X-Real-IP"); xri != "" {
			return strings.TrimSpace(xri)
		}
	}
	ip := r.RemoteAddr
	if host, _, err := net.SplitHostPort(ip); err == nil {
		return host
	}
	return strings.Trim(ip, "[]")
}
