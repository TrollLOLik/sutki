package http

import (
	"testing"
	"time"
)

func TestSlidingWindowLimiterAllowN(t *testing.T) {
	limiter := NewSlidingWindowLimiter(time.Hour)

	if !limiter.AllowN("user:1", 5, 3) {
		t.Fatal("first weighted spend should pass")
	}
	if limiter.AllowN("user:1", 5, 3) {
		t.Fatal("weighted spend must not exceed the remaining budget")
	}
	if !limiter.AllowN("user:1", 5, 2) {
		t.Fatal("exact remaining budget should pass")
	}
	if limiter.Allow("user:1", 5) {
		t.Fatal("exhausted budget should reject a regular spend")
	}
	if !limiter.AllowN("user:2", 5, 5) {
		t.Fatal("keys must have independent budgets")
	}
}

func TestSlidingWindowLimiterAllowNRejectsInvalidCost(t *testing.T) {
	limiter := NewSlidingWindowLimiter(time.Hour)

	for _, cost := range []int{-1, 0, 6} {
		if limiter.AllowN("user:1", 5, cost) {
			t.Fatalf("cost %d should be rejected", cost)
		}
	}
}
