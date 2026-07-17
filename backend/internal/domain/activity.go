package domain

import (
	"context"
	"encoding/json"
	"time"
)

const (
	ActivityScopeBookings = "bookings"
	ActivityScopeIncoming = "incoming"
	ActivityScopeListings = "listings"
	ActivityScopeReviews  = "reviews"
	ActivityScopeMessages = "messages"
)

// UserEvent is published to the authenticated user's private realtime
// channel. MarkUnread also persists the event for cross-device counters.
type UserEvent struct {
	EventKey   string         `json:"-"`
	Type       string         `json:"type"`
	Scope      string         `json:"scope,omitempty"`
	Action     string         `json:"action"`
	EntityID   int64          `json:"entity_id,omitempty"`
	Payload    map[string]any `json:"payload,omitempty"`
	OccurredAt time.Time      `json:"occurred_at"`
	MarkUnread bool           `json:"-"`
}

type ActivityCounters struct {
	Messages      int64 `json:"messages"`
	Bookings      int64 `json:"bookings"`
	Incoming      int64 `json:"incoming"`
	Listings      int64 `json:"listings"`
	Reviews       int64 `json:"reviews"`
	Notifications int64 `json:"notifications"`
}

type UserNotification struct {
	ID        int64           `json:"id"`
	Scope     string          `json:"scope"`
	Type      string          `json:"type"`
	EntityID  *int64          `json:"entity_id,omitempty"`
	Action    string          `json:"action"`
	Payload   json.RawMessage `json:"payload"`
	CreatedAt time.Time       `json:"created_at"`
	ReadAt    *time.Time      `json:"read_at,omitempty"`
}

func (c ActivityCounters) ProfileTotal() int64 {
	return c.Bookings + c.Incoming + c.Listings + c.Reviews
}

type UserEventPublisher interface {
	PublishUserEvent(ctx context.Context, userID int32, event UserEvent) error
}

type UserActivityRepository interface {
	Counters(ctx context.Context, userID int32) (ActivityCounters, error)
	MarkScopeRead(ctx context.Context, userID int32, scope string) error
	ListNotifications(ctx context.Context, userID, limit, offset int32) ([]UserNotification, int64, error)
	MarkNotificationRead(ctx context.Context, userID int32, notificationID int64) error
	MarkAllNotificationsRead(ctx context.Context, userID int32) error
}

type UserNotificationReader interface {
	MarkEntityNotificationsRead(ctx context.Context, userID int32, scope string, entityID int64) error
}

func ValidActivityScope(scope string) bool {
	switch scope {
	case ActivityScopeMessages, ActivityScopeBookings, ActivityScopeIncoming, ActivityScopeListings, ActivityScopeReviews:
		return true
	default:
		return false
	}
}
