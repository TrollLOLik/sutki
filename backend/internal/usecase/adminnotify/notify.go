package adminnotify

import (
	"context"
	"log"
	"time"

	"github.com/TrollLOLik/sutki/backend/internal/domain"
)

const deliveryTimeout = time.Minute

// Send keeps operator notifications out of user-facing request latency while
// giving the Telegram client enough time for its bounded delivery retries.
func Send(notifier domain.AdminQueueNotifier, event domain.AdminQueueEvent, source string) {
	if notifier == nil {
		return
	}

	go func() {
		ctx, cancel := context.WithTimeout(context.Background(), deliveryTimeout)
		defer cancel()
		if err := notifier.NotifyAdminQueue(ctx, event); err != nil {
			log.Printf("%s admin queue notification for %s %d: %v", source, event.Kind, event.ID, err)
		}
	}()
}
