package email

import (
	"context"
	"log"
	"time"

	"github.com/TrollLOLik/sutki/backend/internal/domain"
)

// OutboxMessage is a rendered email queued for delivery.
type OutboxMessage struct {
	// DedupKey uniquely identifies a one-shot notification (e.g.
	// "booking_confirmed:42"). Empty for repeatable mail like login codes.
	DedupKey  string
	UserID    int32 // 0 when the recipient has no account (guest bookings)
	Recipient string
	EventType string
	Subject   string
	BodyText  string
	BodyHTML  string
}

// OutboxItem is a queued row loaded back for delivery.
type OutboxItem struct {
	ID        int64
	Recipient string
	EventType string
	Subject   string
	BodyText  string
	BodyHTML  string
	Attempts  int32
}

// OutboxRepository persists the durable email queue. Implemented in
// repository/postgres against the email_outbox table.
type OutboxRepository interface {
	// Enqueue inserts a queued row. Returns false (and no error) when the
	// dedup key already exists, meaning the notification was already sent
	// or queued.
	Enqueue(ctx context.Context, msg OutboxMessage) (bool, error)
	// DueBatch returns up to limit queued rows whose next_attempt_at has
	// passed, oldest first.
	DueBatch(ctx context.Context, limit int32) ([]OutboxItem, error)
	// MarkSent flips the row to sent and clears the bodies so plaintext
	// login codes don't accumulate in the table.
	MarkSent(ctx context.Context, id int64) error
	// MarkRetry records a failed attempt and schedules the next one.
	MarkRetry(ctx context.Context, id int64, lastError string, nextAttemptAt time.Time) error
	// MarkFailed records a permanently failed delivery (attempts exhausted).
	MarkFailed(ctx context.Context, id int64, lastError string) error
	// CountSentSince returns delivered-email count since the cutoff (for
	// the daily SMTP quota).
	CountSentSince(ctx context.Context, since time.Time) (int64, error)
	// Postpone reschedules a queued row without counting an attempt (quota
	// deferral, not a delivery failure).
	Postpone(ctx context.Context, id int64, until time.Time) error
	// Prune deletes terminal (sent/failed) rows created before the cutoff.
	Prune(ctx context.Context, before time.Time) (int64, error)
}

const (
	// batchSize bounds how many rows a single worker pass claims.
	batchSize int32 = 10
	// maxSendAttempts before a row is marked failed for good.
	maxSendAttempts = 3
	// sendInterval is the global throttle between two SMTP sends. It caps
	// throughput at ~60 emails/min — far below Yandex 360 daily limits while
	// keeping login codes near-instant.
	sendInterval = time.Second
	// pollInterval is the fallback ticker: even if a wake signal is lost the
	// worker re-checks the table this often (also picks up retries).
	pollInterval = 30 * time.Second
	// pruneInterval / pruneAfter control cleanup of delivered/failed rows.
	pruneInterval = time.Hour
	pruneAfter    = 30 * 24 * time.Hour
)

// retryBackoff returns the delay before the given (1-based) retry attempt.
func retryBackoff(attempt int32) time.Duration {
	switch attempt {
	case 1:
		return 30 * time.Second
	case 2:
		return 2 * time.Minute
	default:
		return 10 * time.Minute
	}
}

// Mailer is the durable email queue: Enqueue persists a message into the
// outbox (source of truth), and a single background worker drains the table.
// The wake channel is only a "check now" hint — after a restart the worker
// picks up whatever is still queued in the DB, so no P0 email is lost.
type Mailer struct {
	repo   OutboxRepository
	sender Sender
	wake   chan struct{}
	// dailyLimit caps SMTP sends per calendar day (server local time) to
	// stay under the Yandex 360 mailbox quota. 0 disables the cap.
	// Transactional login codes (otp_code) are exempt: they must always go
	// out; everything else is postponed to the next day when the cap hits.
	dailyLimit int64
}

func NewMailer(repo OutboxRepository, sender Sender, dailyLimit int64) *Mailer {
	return &Mailer{
		repo:       repo,
		sender:     sender,
		wake:       make(chan struct{}, 1),
		dailyLimit: dailyLimit,
	}
}

// Configured reports whether the underlying transport can send at all.
func (m *Mailer) Configured() bool { return m.sender.Configured() }

// Enqueue persists the message and nudges the worker. Returns false when the
// dedup key already exists (already sent/queued). Never blocks on SMTP.
func (m *Mailer) Enqueue(ctx context.Context, msg OutboxMessage) (bool, error) {
	inserted, err := m.repo.Enqueue(ctx, msg)
	if err != nil {
		return false, err
	}
	if inserted {
		select {
		case m.wake <- struct{}{}:
		default: // a wake-up is already pending
		}
	}
	return inserted, nil
}

// Start launches the single delivery worker. One worker keeps the global
// send-rate throttle trivially correct (sends are serialized).
func (m *Mailer) Start(ctx context.Context) {
	go func() {
		defer func() {
			if r := recover(); r != nil {
				log.Printf("email worker: panic recovered, restarting: %v", r)
				// Restart the loop after a short pause so a poisoned row
				// cannot take the worker down permanently.
				time.Sleep(5 * time.Second)
				m.Start(ctx)
			}
		}()

		ticker := time.NewTicker(pollInterval)
		defer ticker.Stop()
		lastPrune := time.Now()

		// Drain anything left over from before the restart right away.
		m.processDue(ctx)

		for {
			select {
			case <-ctx.Done():
				return
			case <-m.wake:
				m.processDue(ctx)
			case <-ticker.C:
				m.processDue(ctx)
				if time.Since(lastPrune) >= pruneInterval {
					lastPrune = time.Now()
					if n, err := m.repo.Prune(ctx, time.Now().Add(-pruneAfter)); err != nil {
						log.Printf("email worker: prune: %v", err)
					} else if n > 0 {
						log.Printf("email worker: pruned %d old outbox rows", n)
					}
				}
			}
		}
	}()
}

// processDue drains due rows in batches until the table has no more work.
func (m *Mailer) processDue(ctx context.Context) {
	sentToday := m.sentToday(ctx)

	for {
		items, err := m.repo.DueBatch(ctx, batchSize)
		if err != nil {
			log.Printf("email worker: load due batch: %v", err)
			return
		}
		if len(items) == 0 {
			return
		}
		for _, item := range items {
			if ctx.Err() != nil {
				return
			}

			// Daily quota: transactional login codes always go out; other
			// events are postponed to just after local midnight. Postponing
			// removes the row from the due set, so the drain loop cannot
			// spin on it.
			if m.dailyLimit > 0 && sentToday >= m.dailyLimit && item.EventType != EventOTPCode {
				next := nextMidnight()
				if err := m.repo.Postpone(ctx, item.ID, next); err != nil {
					log.Printf("email worker: postpone id=%d: %v", item.ID, err)
					return // avoid a hot loop if postponing itself fails
				}
				log.Printf("email worker: daily limit %d reached, postponed %s to %s until %s",
					m.dailyLimit, item.EventType, domain.MaskEmail(item.Recipient),
					next.Format(time.RFC3339))
				continue
			}

			m.deliver(ctx, item)
			sentToday++
			// One-shot alert when crossing 80% of the daily quota.
			if threshold := m.dailyLimit * 4 / 5; m.dailyLimit > 0 &&
				sentToday >= threshold && sentToday-1 < threshold {
				log.Printf("email worker: WARNING sent volume at 80%% of daily limit (%d/%d)",
					sentToday, m.dailyLimit)
			}
			// Global throttle between sends (single worker => serialized).
			time.Sleep(sendInterval)
		}
	}
}

// sentToday counts today's deliveries (server local midnight). On error the
// count is treated as 0: better to risk brushing the provider limit than to
// stop sending login codes because of a transient DB hiccup.
func (m *Mailer) sentToday(ctx context.Context) int64 {
	if m.dailyLimit <= 0 {
		return 0
	}
	now := time.Now()
	midnight := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, now.Location())
	n, err := m.repo.CountSentSince(ctx, midnight)
	if err != nil {
		log.Printf("email worker: count sent today: %v", err)
		return 0
	}
	return n
}

// nextMidnight returns the start of the next local day plus a small offset
// so postponed mail does not all fire at exactly 00:00:00.
func nextMidnight() time.Time {
	now := time.Now()
	return time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, now.Location()).
		Add(24*time.Hour + 5*time.Minute)
}

func (m *Mailer) deliver(ctx context.Context, item OutboxItem) {
	err := m.sender.Send(item.Recipient, item.Subject, item.BodyText, item.BodyHTML)
	if err == nil {
		if err := m.repo.MarkSent(ctx, item.ID); err != nil {
			log.Printf("email worker: mark sent id=%d: %v", item.ID, err)
		}
		log.Printf("email worker: sent %s to %s", item.EventType, domain.MaskEmail(item.Recipient))
		return
	}

	attempt := item.Attempts + 1
	if attempt >= maxSendAttempts {
		if mErr := m.repo.MarkFailed(ctx, item.ID, err.Error()); mErr != nil {
			log.Printf("email worker: mark failed id=%d: %v", item.ID, mErr)
		}
		log.Printf("email worker: giving up on %s to %s after %d attempts: %v",
			item.EventType, domain.MaskEmail(item.Recipient), attempt, err)
		return
	}

	next := time.Now().Add(retryBackoff(attempt))
	if mErr := m.repo.MarkRetry(ctx, item.ID, err.Error(), next); mErr != nil {
		log.Printf("email worker: mark retry id=%d: %v", item.ID, mErr)
	}
	log.Printf("email worker: send %s to %s failed (attempt %d/%d), retry at %s: %v",
		item.EventType, domain.MaskEmail(item.Recipient), attempt, maxSendAttempts,
		next.Format(time.RFC3339), err)
}
