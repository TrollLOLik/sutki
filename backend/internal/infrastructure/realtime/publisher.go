package realtime

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/TrollLOLik/sutki/backend/internal/domain"
)

type Publisher struct {
	pool   *pgxpool.Pool
	url    string
	apiKey string
	client *http.Client
}

func NewPublisher(pool *pgxpool.Pool, url, apiKey string) *Publisher {
	return &Publisher{
		pool: pool, url: strings.TrimRight(url, "/"), apiKey: apiKey,
		client: &http.Client{Timeout: 5 * time.Second},
	}
}

func (p *Publisher) PublishUserEvent(ctx context.Context, userID int32, event domain.UserEvent) error {
	if userID <= 0 {
		return nil
	}
	if event.OccurredAt.IsZero() {
		event.OccurredAt = time.Now().UTC()
	}
	if event.MarkUnread {
		if !domain.ValidActivityScope(event.Scope) || strings.TrimSpace(event.EventKey) == "" {
			return fmt.Errorf("invalid durable user event")
		}
		payload, err := json.Marshal(event.Payload)
		if err != nil {
			return err
		}
		_, err = p.pool.Exec(ctx, `INSERT INTO user_activity_event(event_key,user_id,scope,event_type,entity_id,action,payload,created_at)
VALUES($1,$2,$3,$4,NULLIF($5,0),$6,$7,$8) ON CONFLICT(user_id,event_key) DO NOTHING`,
			event.EventKey, userID, event.Scope, event.Type, event.EntityID, event.Action, payload, event.OccurredAt)
		if err != nil {
			return fmt.Errorf("persist user activity: %w", err)
		}
	}
	if p.url == "" {
		return nil
	}
	body, err := json.Marshal(map[string]any{
		"method": "publish",
		"params": map[string]any{
			"channel": fmt.Sprintf("user:#%d", userID),
			"data":    event,
		},
	})
	if err != nil {
		return err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, p.url+"/api", bytes.NewReader(body))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	if p.apiKey != "" {
		req.Header.Set("X-API-Key", p.apiKey)
	}
	resp, err := p.client.Do(req)
	if err != nil {
		return fmt.Errorf("publish user event: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("publish user event: centrifugo status %d", resp.StatusCode)
	}
	var result struct {
		Error *struct {
			Code    int    `json:"code"`
			Message string `json:"message"`
		} `json:"error"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return fmt.Errorf("publish user event: decode centrifugo response: %w", err)
	}
	if result.Error != nil {
		return fmt.Errorf("publish user event: centrifugo error %d: %s", result.Error.Code, result.Error.Message)
	}
	return nil
}

func (p *Publisher) Counters(ctx context.Context, userID int32) (domain.ActivityCounters, error) {
	var counters domain.ActivityCounters
	rows, err := p.pool.Query(ctx, `SELECT scope,count(*) FROM user_activity_event WHERE user_id=$1 AND seen_at IS NULL GROUP BY scope`, userID)
	if err != nil {
		return counters, err
	}
	defer rows.Close()
	for rows.Next() {
		var scope string
		var count int64
		if err := rows.Scan(&scope, &count); err != nil {
			return counters, err
		}
		counters.Notifications += count
		switch scope {
		case domain.ActivityScopeBookings:
			counters.Bookings = count
		case domain.ActivityScopeIncoming:
			counters.Incoming = count
		case domain.ActivityScopeListings:
			counters.Listings = count
		case domain.ActivityScopeReviews:
			counters.Reviews = count
		}
	}
	if err := rows.Err(); err != nil {
		return counters, err
	}
	err = p.pool.QueryRow(ctx, `SELECT count(*) FROM conversation_participant cp JOIN message m ON m.conversation_id=cp.conversation_id WHERE cp.user_id=$1 AND m.id>cp.last_read_message_id`, userID).Scan(&counters.Messages)
	return counters, err
}

func (p *Publisher) ListNotifications(ctx context.Context, userID, limit, offset int32) ([]domain.UserNotification, int64, error) {
	rows, err := p.pool.Query(ctx, `SELECT id,scope,event_type,entity_id,action,payload,created_at,seen_at
FROM user_activity_event WHERE user_id=$1 ORDER BY created_at DESC,id DESC LIMIT $2 OFFSET $3`, userID, limit, offset)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()
	items := make([]domain.UserNotification, 0, limit)
	for rows.Next() {
		var item domain.UserNotification
		if err := rows.Scan(&item.ID, &item.Scope, &item.Type, &item.EntityID, &item.Action, &item.Payload, &item.CreatedAt, &item.ReadAt); err != nil {
			return nil, 0, err
		}
		items = append(items, item)
	}
	if err := rows.Err(); err != nil {
		return nil, 0, err
	}
	var total int64
	if err := p.pool.QueryRow(ctx, `SELECT count(*) FROM user_activity_event WHERE user_id=$1`, userID).Scan(&total); err != nil {
		return nil, 0, err
	}
	return items, total, nil
}

func (p *Publisher) MarkNotificationRead(ctx context.Context, userID int32, notificationID int64) error {
	_, err := p.pool.Exec(ctx, `UPDATE user_activity_event SET seen_at=COALESCE(seen_at,now()) WHERE id=$1 AND user_id=$2`, notificationID, userID)
	return err
}

func (p *Publisher) MarkAllNotificationsRead(ctx context.Context, userID int32) error {
	_, err := p.pool.Exec(ctx, `UPDATE user_activity_event SET seen_at=now() WHERE user_id=$1 AND seen_at IS NULL`, userID)
	return err
}

func (p *Publisher) MarkEntityNotificationsRead(ctx context.Context, userID int32, scope string, entityID int64) error {
	if !domain.ValidActivityScope(scope) || entityID <= 0 {
		return fmt.Errorf("invalid notification entity")
	}
	_, err := p.pool.Exec(ctx, `UPDATE user_activity_event SET seen_at=now() WHERE user_id=$1 AND scope=$2 AND entity_id=$3 AND seen_at IS NULL`, userID, scope, entityID)
	return err
}

func (p *Publisher) MarkScopeRead(ctx context.Context, userID int32, scope string) error {
	if !domain.ValidActivityScope(scope) {
		return fmt.Errorf("invalid activity scope")
	}
	_, err := p.pool.Exec(ctx, `UPDATE user_activity_event SET seen_at=now() WHERE user_id=$1 AND scope=$2 AND seen_at IS NULL`, userID, scope)
	return err
}
