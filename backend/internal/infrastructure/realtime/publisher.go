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

func (p *Publisher) MarkScopeRead(ctx context.Context, userID int32, scope string) error {
	if !domain.ValidActivityScope(scope) {
		return fmt.Errorf("invalid activity scope")
	}
	_, err := p.pool.Exec(ctx, `UPDATE user_activity_event SET seen_at=now() WHERE user_id=$1 AND scope=$2 AND seen_at IS NULL`, userID, scope)
	return err
}
