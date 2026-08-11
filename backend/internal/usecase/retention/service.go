package retention

import (
	"context"
	"log"
	"time"

	"github.com/TrollLOLik/sutki/backend/internal/domain"
	"github.com/TrollLOLik/sutki/backend/internal/observability"
)

type Service struct {
	repo           domain.RetentionRepository
	chatStorage    domain.FileStorage
	listingStorage domain.FileStorage
}

func New(repo domain.RetentionRepository, chatStorage, listingStorage domain.FileStorage) *Service {
	return &Service{repo: repo, chatStorage: chatStorage, listingStorage: listingStorage}
}

func (s *Service) Start(ctx context.Context) {
	go func() {
		s.run(ctx)
		ticker := time.NewTicker(24 * time.Hour)
		defer ticker.Stop()
		for {
			select {
			case <-ctx.Done():
				return
			case <-ticker.C:
				s.run(ctx)
			}
		}
	}()
}

func (s *Service) run(ctx context.Context) {
	now := time.Now().UTC()
	chatKeys, err := s.repo.ExpiredChatObjectKeys(ctx, now.AddDate(0, -6, 0))
	if err != nil {
		observability.CaptureException(ctx, err)
		log.Printf("data retention worker: list chat objects: %v", err)
		return
	}
	deletedChatKeys := make([]string, 0, len(chatKeys))
	for _, key := range chatKeys {
		if err := s.chatStorage.Delete(ctx, key); err != nil {
			observability.CaptureException(ctx, err)
			log.Printf("data retention worker: delete %s: %v", key, err)
			continue
		}
		deletedChatKeys = append(deletedChatKeys, key)
	}
	listingKeys, err := s.repo.ExpiredListingObjectKeys(ctx, now.AddDate(-3, 0, 0))
	if err != nil {
		observability.CaptureException(ctx, err)
		log.Printf("data retention worker: list listing objects: %v", err)
		return
	}
	deletedListingKeys := make([]string, 0, len(listingKeys))
	for _, key := range listingKeys {
		if err := s.listingStorage.Delete(ctx, key); err != nil {
			observability.CaptureException(ctx, err)
			log.Printf("data retention worker: delete listing object %s: %v", key, err)
			continue
		}
		deletedListingKeys = append(deletedListingKeys, key)
	}
	result, err := s.repo.RunRetention(ctx, now, deletedChatKeys, deletedListingKeys)
	if err != nil {
		observability.CaptureException(ctx, err)
		log.Printf("data retention worker: %v", err)
		return
	}
	log.Printf("data retention worker: completed (%v)", result.Counts)
}
