package listing

import (
	"context"
	"fmt"
	"log"
	"strings"
	"time"

	"github.com/TrollLOLik/sutki/backend/internal/domain"
)

const (
	summaryMaxAttempts  = 4 // 1 initial + 3 retries
	summaryBatchSize    = 10
	summaryPollInterval = 15 * time.Second
)

var summaryRetryBackoff = []time.Duration{15 * time.Second, 1 * time.Minute, 5 * time.Minute}

// Wake nudges the location summary worker to poll immediately.
func (s *Service) Wake() {
	if s.wake != nil {
		select {
		case s.wake <- struct{}{}:
		default:
		}
	}
}

// StartLocationSummaryWorker launches the background worker loop. Call once from main.
func (s *Service) StartLocationSummaryWorker(ctx context.Context) {
	// Initialize wake channel if not already done
	if s.wake == nil {
		s.wake = make(chan struct{}, 1)
	}

	go func() {
		ticker := time.NewTicker(summaryPollInterval)
		defer ticker.Stop()
		for {
			select {
			case <-ctx.Done():
				return
			case <-ticker.C:
			case <-s.wake:
			}
			s.processDue(ctx)
		}
	}()
	log.Printf("location summary worker: started (poll %s, batch %d)", summaryPollInterval, summaryBatchSize)
}

func (s *Service) processDue(ctx context.Context) {
	if s.locationSummaryRepo == nil || s.aiSummarizer == nil {
		return
	}
	for {
		batch, err := s.locationSummaryRepo.DueBatch(ctx, summaryBatchSize)
		if err != nil {
			log.Printf("location summary worker: claim batch: %v", err)
			return
		}
		if len(batch) == 0 {
			return
		}
		for _, job := range batch {
			if ctx.Err() != nil {
				return
			}
			s.processJob(ctx, job)
		}
	}
}

func (s *Service) processJob(ctx context.Context, job domain.LocationSummaryJob) {
	pois := job.POIs
	if len(pois) == 0 && s.nearbyPOIs != nil && job.Lat != nil && job.Lng != nil {
		var err error
		pois, err = s.nearbyPOIs.Nearby(ctx, *job.Lat, *job.Lng, 8)
		if err != nil {
			s.handleJobFailure(ctx, job, fmt.Errorf("find nearby POIs: %w", err))
			return
		}
		updated, err := s.locationSummaryRepo.SavePOIs(ctx, job, pois)
		if err != nil {
			s.handleJobFailure(ctx, job, fmt.Errorf("save nearby POIs: %w", err))
			return
		}
		if !updated {
			log.Printf("location summary worker: job %d became stale before POI save", job.ID)
			return
		}
	}

	// Generate summary
	summary, err := s.aiSummarizer.GenerateLocationSummary(ctx, job.City, job.Street, "", pois)
	if err != nil {
		s.handleJobFailure(ctx, job, err)
		return
	}

	updated, err := s.locationSummaryRepo.Complete(ctx, job, pois, summary)
	if err != nil {
		s.handleJobFailure(ctx, job, fmt.Errorf("save location enrichment: %w", err))
		return
	}
	if !updated {
		log.Printf("location summary worker: job %d became stale", job.ID)
	}
}

func (s *Service) handleJobFailure(ctx context.Context, job domain.LocationSummaryJob, err error) {
	log.Printf("location summary worker: job %d failed: %v", job.ID, err)
	if int(job.Attempts) >= summaryMaxAttempts {
		log.Printf("location summary worker: job %d exhausted attempts, marking failed", job.ID)
		_ = s.locationSummaryRepo.MarkFailed(ctx, job.ID, job.Revision, err.Error())
		return
	}

	backoff := retryBackoff(job.Attempts, err)
	nextAttempt := time.Now().Add(backoff)
	_ = s.locationSummaryRepo.MarkRetry(ctx, job.ID, job.Revision, err.Error(), nextAttempt)
}

func retryBackoff(attempts int32, err error) time.Duration {
	message := err.Error()
	if strings.Contains(message, "overpass status: 429") ||
		strings.Contains(message, "overpass status: 504") ||
		strings.Contains(message, "Client.Timeout") {
		backoff := []time.Duration{2 * time.Minute, 5 * time.Minute, 15 * time.Minute}
		return backoff[min(int(attempts)-1, len(backoff)-1)]
	}
	return summaryRetryBackoff[min(int(attempts)-1, len(summaryRetryBackoff)-1)]
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}
