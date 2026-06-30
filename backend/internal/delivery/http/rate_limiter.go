package http

import (
	"net/http"
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
	OTPGuestIDLimiter = NewSlidingWindowLimiter(time.Hour)
	OTPIPLimiter      = NewSlidingWindowLimiter(time.Hour)

	// Booking Rate Limiters (1 hour window)
	BookingEmailLimiter   = NewSlidingWindowLimiter(time.Hour)
	BookingGuestIDLimiter = NewSlidingWindowLimiter(time.Hour)
	BookingIPLimiter      = NewSlidingWindowLimiter(time.Hour)
)

// Extract client IP address supporting proxy headers
func getClientIP(r *http.Request) string {
	if xff := r.Header.Get("X-Forwarded-For"); xff != "" {
		parts := strings.Split(xff, ",")
		if len(parts) > 0 {
			return strings.TrimSpace(parts[0])
		}
	}
	if xri := r.Header.Get("X-Real-IP"); xri != "" {
		return strings.TrimSpace(xri)
	}
	ip := r.RemoteAddr
	if idx := strings.LastIndex(ip, ":"); idx != -1 {
		ip = ip[:idx]
	}
	return strings.Trim(ip, "[]")
}
