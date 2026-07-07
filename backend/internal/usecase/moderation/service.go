// Package moderation implements the LLM-assisted listing moderation
// pipeline: rule prefilter -> durable LLM verdict queue -> status flip.
//
// Invariants:
//   - The LLM never blocks a user-facing request: Submit only runs the cheap
//     prefilter synchronously; the LLM verdict is asynchronous.
//   - A junk LLM answer can only yield "review", never approve/reject.
//   - When the LLM is down (circuit open), prefilter-clean listings publish
//     provisionally and are re-checked when the LLM recovers; flagged ones
//     wait in pending_moderation. The pipeline never freezes.
package moderation

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"log"
	"strings"
	"sync"
	"time"

	"github.com/TrollLOLik/sutki/backend/internal/domain"
	"github.com/TrollLOLik/sutki/backend/internal/infrastructure/llm"
)

const (
	maxAttempts      = 4 // 1 initial + 3 retries
	batchSize        = 10
	pollInterval     = 30 * time.Second
	breakerThreshold = 3 // consecutive LLM failures before degraded mode

	// Auto-reject only on confident verdicts; anything weaker goes to a human.
	rejectConfidenceThreshold = 0.9

	// An owner with this many rejects in 30 days loses auto-approve.
	flaggedUserRejects = 3
	flaggedUserWindow  = 30 * 24 * time.Hour

	// Daily create/update submissions per owner.
	dailySubmissionLimit = 15

	// Review queue size that triggers an admin alert.
	reviewQueueAlertSize = 10

	phashMaxDistance = 8 // Hamming distance for "same photo"
)

var retryBackoff = []time.Duration{30 * time.Second, 2 * time.Minute, 10 * time.Minute}

// LLMClient is the narrow slice of llm.Client the moderator needs.
type LLMClient interface {
	Generate(ctx context.Context, systemPrompt, userPrompt string, maxTokens int, temperature float64) (string, error)
}

// AdminAlerter sends operational alerts (degraded mode, queue growth) to the
// admin mailbox. Implemented by the email notifier; may be nil.
type AdminAlerter interface {
	SendAdminAlert(ctx context.Context, dedupKey, subject, body string) error
}

// OwnerNotifier informs listing owners about moderation outcomes. May be nil.
type OwnerNotifier interface {
	NotifyListingApproved(ctx context.Context, ownerID int32, ownerEmail string, houseID int32, address string) error
	NotifyListingRejected(ctx context.Context, ownerID int32, ownerEmail string, houseID int32, address, reason string) error
}

// Service implements domain.ListingModerator plus the background worker.
type Service struct {
	repo    domain.ModerationRepository
	llm     LLMClient
	alerter AdminAlerter
	owners  OwnerNotifier
	photo   *photoDeps // optional, see SetPhotoPipeline

	wake chan struct{}

	// circuit breaker state
	mu           sync.Mutex
	consecFails  int
	degraded     bool
	lastQueueLen int64
}

func New(repo domain.ModerationRepository, llmClient LLMClient, alerter AdminAlerter, owners OwnerNotifier) *Service {
	return &Service{
		repo:    repo,
		llm:     llmClient,
		alerter: alerter,
		owners:  owners,
		wake:    make(chan struct{}, 1),
	}
}

// ContentHash returns the sha256 of the moderated free-text bundle. All
// owner-controlled text participates: address, description, price. Custom
// rule strings are validated to enum values upstream so they carry no free
// text, but description is the main channel anyway.
func ContentHash(h domain.ModerationHouse) string {
	sum := sha256.Sum256([]byte(strings.Join([]string{
		h.City, h.Street, h.HouseNumber, h.Description, fmt.Sprintf("%d", h.Price),
	}, "\x00")))
	return hex.EncodeToString(sum[:])
}

// moderatedText builds the text bundle shown to prefilter and LLM.
func moderatedText(h domain.ModerationHouse) string {
	return fmt.Sprintf("Адрес: %s, %s %s\nЦена за сутки: %d ₽\nОписание: %s",
		h.City, h.Street, h.HouseNumber, h.Price, h.Description)
}

// AllowSubmission enforces the per-owner daily rate limit (anti-flood and
// anti prompt-probing). Fail-open on DB errors: listing creation must not
// break because a counter query hiccuped.
func (s *Service) AllowSubmission(ctx context.Context, ownerID int32) (bool, error) {
	n, err := s.repo.CountOwnerSubmissions(ctx, ownerID, time.Now().Add(-24*time.Hour))
	if err != nil {
		log.Printf("moderation: rate limit count for owner %d: %v", ownerID, err)
		return true, nil
	}
	return n < dailySubmissionLimit, nil
}

// Submit runs the synchronous prefilter for a created/updated listing and
// enqueues the async LLM job. Returns the house status it set.
func (s *Service) Submit(ctx context.Context, houseID int32) (string, error) {
	h, err := s.repo.GetHouseForModeration(ctx, houseID)
	if err != nil {
		return "", fmt.Errorf("load house %d for moderation: %w", houseID, err)
	}

	hash := ContentHash(h)
	text := moderatedText(h)

	// 1. Rule prefilter: unambiguous violations skip the LLM entirely.
	if hits := runPrefilter(text); len(hits) > 0 {
		hit := hits[0]
		if err := s.repo.RecordVerdict(ctx, domain.ModerationVerdict{
			HouseID: houseID, ContentHash: hash,
			Source: domain.ModerationSourcePrefilter, Decision: domain.ModerationReview,
			Category: hit.Category, Reason: hit.Reason,
		}, nil); err != nil {
			log.Printf("moderation: record prefilter verdict for house %d: %v", houseID, err)
		}
		if err := s.repo.SetHouseModeration(ctx, houseID, domain.HouseStatusModerationReview, ""); err != nil {
			return "", err
		}
		s.checkReviewQueueAlert(ctx)
		return domain.HouseStatusModerationReview, nil
	}

	// 2. Cross-owner duplicate text = likely copied listing.
	if dup, err := s.repo.FindDuplicateText(ctx, houseID, h.OwnerID, hash); err != nil {
		log.Printf("moderation: duplicate text check for house %d: %v", houseID, err)
	} else if dup {
		if err := s.repo.RecordVerdict(ctx, domain.ModerationVerdict{
			HouseID: houseID, ContentHash: hash,
			Source: domain.ModerationSourcePrefilter, Decision: domain.ModerationReview,
			Category: "duplicate", Reason: "Текст совпадает с активным объявлением другого владельца",
		}, nil); err != nil {
			log.Printf("moderation: record duplicate verdict for house %d: %v", houseID, err)
		}
		if err := s.repo.SetHouseModeration(ctx, houseID, domain.HouseStatusModerationReview, ""); err != nil {
			return "", err
		}
		s.checkReviewQueueAlert(ctx)
		return domain.HouseStatusModerationReview, nil
	}

	// 3. Flagged owner (3+ rejects in 30 days): no auto-approve, straight to
	// the human queue, but the LLM verdict is still produced as advice.
	flagged := false
	if n, err := s.repo.CountRecentRejects(ctx, h.OwnerID, time.Now().Add(-flaggedUserWindow)); err != nil {
		log.Printf("moderation: recent rejects count for owner %d: %v", h.OwnerID, err)
	} else if n >= flaggedUserRejects {
		flagged = true
	}

	// 4. Enqueue the durable LLM job (idempotent per house+content).
	enqueued, err := s.repo.EnqueueLLM(ctx, houseID, hash)
	if err != nil {
		log.Printf("moderation: enqueue llm for house %d: %v", houseID, err)
	}
	// Update with unchanged text: a job for this exact content already exists
	// (queued -> house is already pending; done -> verdict already applied).
	// Carrying the current status over avoids re-hiding an approved listing.
	if !enqueued && !flagged {
		s.Wake()
		// Photos may have changed even when the text did not.
		s.spawnPhotoCheck(houseID)
		return h.Status, nil
	}

	target := domain.HouseStatusPendingModeration
	if flagged {
		target = domain.HouseStatusModerationReview
		if err := s.repo.RecordVerdict(ctx, domain.ModerationVerdict{
			HouseID: houseID, ContentHash: hash,
			Source: domain.ModerationSourcePrefilter, Decision: domain.ModerationReview,
			Category: "flagged_user", Reason: "Владелец с повторными отклонениями за последние 30 дней",
		}, nil); err != nil {
			log.Printf("moderation: record flagged_user verdict for house %d: %v", houseID, err)
		}
	} else if s.isDegraded() {
		// LLM outage: prefilter-clean listings publish provisionally; the
		// queued job re-checks them once the circuit closes.
		target = domain.HouseStatusActive
		log.Printf("moderation: degraded mode, provisional publish for house %d", houseID)
	}

	if err := s.repo.SetHouseModeration(ctx, houseID, target, ""); err != nil {
		return "", err
	}
	s.Wake()
	s.spawnPhotoCheck(houseID)
	return target, nil
}

// spawnPhotoCheck runs the perceptual-hash duplicate scan in the background:
// photo downloads must never add latency to the create/update request.
func (s *Service) spawnPhotoCheck(houseID int32) {
	if s.photo == nil {
		return
	}
	go func() {
		ctx, cancel := context.WithTimeout(context.Background(), 2*time.Minute)
		defer cancel()
		s.CheckPhotos(ctx, houseID)
	}()
}

// Wake nudges the worker to poll immediately.
func (s *Service) Wake() {
	select {
	case s.wake <- struct{}{}:
	default:
	}
}

// StartWorker launches the background verdict loop. Call once from main.
func (s *Service) StartWorker(ctx context.Context) {
	go func() {
		ticker := time.NewTicker(pollInterval)
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
	log.Printf("moderation worker: started (poll %s, batch %d)", pollInterval, batchSize)
}

func (s *Service) processDue(ctx context.Context) {
	for {
		batch, err := s.repo.DueBatch(ctx, batchSize)
		if err != nil {
			log.Printf("moderation worker: claim batch: %v", err)
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

func (s *Service) processJob(ctx context.Context, job domain.ModerationVerdict) {
	h, err := s.repo.GetHouseForModeration(ctx, job.HouseID)
	if err != nil {
		// House deleted meanwhile: job is moot.
		_ = s.repo.FailLLM(ctx, job.ID, "house not found: "+err.Error())
		return
	}
	// Stale job: content changed since enqueue (a newer job exists).
	if ContentHash(h) != job.ContentHash {
		_ = s.repo.FailLLM(ctx, job.ID, "superseded by newer content")
		return
	}

	verdict, raw, err := s.askLLM(ctx, h)
	if err != nil {
		s.recordLLMFailure(ctx)
		if int(job.Attempts) >= maxAttempts {
			// Attempts exhausted. In degraded mode listings stay put
			// (provisional actives remain active, pending stays pending) and
			// the job reschedules far out so recovery re-processes it.
			log.Printf("moderation worker: job %d exhausted attempts: %v", job.ID, err)
			_ = s.repo.RescheduleLLM(ctx, job.ID, time.Now().Add(1*time.Hour), err.Error())
			return
		}
		backoff := retryBackoff[min(int(job.Attempts)-1, len(retryBackoff)-1)]
		_ = s.repo.RescheduleLLM(ctx, job.ID, time.Now().Add(backoff), err.Error())
		return
	}
	s.recordLLMSuccess(ctx)

	if err := s.repo.CompleteLLM(ctx, job.ID, verdict.Decision, verdict.Category, verdict.Reason, verdict.Confidence, raw); err != nil {
		log.Printf("moderation worker: complete job %d: %v", job.ID, err)
		return
	}

	s.applyVerdict(ctx, h, job, verdict)
}

// moderationLLMVerdict is the JSON contract with the model.
type moderationLLMVerdict struct {
	Decision   string  `json:"decision"`
	Category   string  `json:"category"`
	Reason     string  `json:"reason"`
	Confidence float32 `json:"confidence"`
}

const moderationSystemPrompt = `Ты — модератор объявлений о посуточной аренде жилья на платформе «ДомРядом» (Россия). Оцени текст объявления по правилам:
1) Запрещённые товары/услуги (наркотики, оружие, интим-услуги, поддельные документы).
2) Мошеннические паттерны: требование предоплаты на карту, внешние ссылки на оплату, аномально низкая цена в сочетании со срочностью.
3) Контакты или призывы увести сделку с платформы.
4) Спам или офтоп: текст не про аренду жилья.
5) Заведомо вводящие в заблуждение заявления.

Ответь ТОЛЬКО валидным JSON без пояснений:
{"decision":"approve|reject|review","category":"<категория нарушения или null>","reason":"<краткая причина по-русски>","confidence":0.0-1.0}

Правила решения:
- Обычное объявление об аренде без нарушений -> decision="approve".
- Явное грубое нарушение -> decision="reject" с высокой confidence.
- decision="review" используй РЕДКО — только когда есть конкретное подозрение, которое ты не можешь подтвердить. Не отправляй в review обычные объявления.`

func (s *Service) askLLM(ctx context.Context, h domain.ModerationHouse) (moderationLLMVerdict, []byte, error) {
	// PII is scrubbed before the text leaves our infrastructure; contact
	// detection already happened locally in the prefilter.
	userPrompt := "Объявление:\n" + llm.WrapUntrusted(llm.ScrubPII(moderatedText(h)))
	system := moderationSystemPrompt + llm.UntrustedInputRule

	callCtx, cancel := context.WithTimeout(ctx, 30*time.Second)
	defer cancel()

	answer, err := s.llm.Generate(callCtx, system, userPrompt, 250, 0)
	if err != nil {
		return moderationLLMVerdict{}, nil, err
	}

	v, trimmed, perr := parseLLMVerdict(answer)
	if perr != nil {
		// One repair attempt: re-ask insisting on pure JSON.
		answer2, err2 := s.llm.Generate(callCtx, system, userPrompt+"\n\nПредыдущий ответ не был валидным JSON. Ответь строго одним JSON-объектом.", 250, 0)
		if err2 != nil {
			return moderationLLMVerdict{}, nil, err2
		}
		v, trimmed, perr = parseLLMVerdict(answer2)
		if perr != nil {
			// Unparseable model output is NEVER trusted as approve or
			// reject — it degrades to a human review.
			log.Printf("moderation: unparseable LLM verdict, downgrading to review: %v", perr)
			
			errPayload := map[string]string{
				"raw_text":    answer2,
				"parse_error": perr.Error(),
			}
			rawJSON, _ := json.Marshal(errPayload)

			return moderationLLMVerdict{
				Decision: domain.ModerationReview,
				Category: "llm_unparseable",
				Reason:   "Ответ модели не распознан",
			}, rawJSON, nil
		}
		return v, []byte(trimmed), nil
	}
	return v, []byte(trimmed), nil
}

// parseLLMVerdict extracts and validates the JSON verdict. Only the parsed
// decision field is ever interpreted; free text is never executed as policy.
func parseLLMVerdict(answer string) (moderationLLMVerdict, string, error) {
	trimmed := strings.TrimSpace(answer)
	// Tolerate models that wrap JSON in code fences.
	trimmed = strings.TrimPrefix(trimmed, "```json")
	trimmed = strings.TrimPrefix(trimmed, "```")
	trimmed = strings.TrimSuffix(trimmed, "```")
	trimmed = strings.TrimSpace(trimmed)

	// Extract the outermost JSON object if extra prose surrounds it.
	if start := strings.Index(trimmed, "{"); start >= 0 {
		if end := strings.LastIndex(trimmed, "}"); end > start {
			trimmed = trimmed[start : end+1]
		}
	}

	var v moderationLLMVerdict
	if err := json.Unmarshal([]byte(trimmed), &v); err != nil {
		return moderationLLMVerdict{}, "", fmt.Errorf("unmarshal verdict: %w", err)
	}
	switch v.Decision {
	case domain.ModerationApprove, domain.ModerationReject, domain.ModerationReview:
	default:
		return moderationLLMVerdict{}, "", fmt.Errorf("invalid decision %q", v.Decision)
	}
	if v.Confidence < 0 || v.Confidence > 1 {
		v.Confidence = 0
	}
	return v, trimmed, nil
}

// applyVerdict flips the house status per policy and notifies the owner.
func (s *Service) applyVerdict(ctx context.Context, h domain.ModerationHouse, job domain.ModerationVerdict, v moderationLLMVerdict) {
	address := strings.TrimSpace(fmt.Sprintf("%s, %s %s", h.City, h.Street, h.HouseNumber))

	switch {
	case v.Decision == domain.ModerationApprove:
		if err := s.repo.SetHouseModeration(ctx, h.ID, domain.HouseStatusActive, ""); err != nil {
			log.Printf("moderation: activate house %d: %v", h.ID, err)
			return
		}
		if s.owners != nil && h.OwnerEmail != "" && h.Status != domain.HouseStatusActive {
			// Only mail when the listing was actually waiting (skip the
			// provisional-active case to avoid a redundant email).
			if err := s.owners.NotifyListingApproved(ctx, h.OwnerID, h.OwnerEmail, h.ID, address); err != nil {
				log.Printf("moderation: queue approved email for house %d: %v", h.ID, err)
			}
		}

	case v.Decision == domain.ModerationReject && v.Confidence >= rejectConfidenceThreshold:
		if err := s.repo.SetHouseModeration(ctx, h.ID, domain.HouseStatusRejected, v.Reason); err != nil {
			log.Printf("moderation: reject house %d: %v", h.ID, err)
			return
		}
		if s.owners != nil && h.OwnerEmail != "" {
			if err := s.owners.NotifyListingRejected(ctx, h.OwnerID, h.OwnerEmail, h.ID, address, v.Reason); err != nil {
				log.Printf("moderation: queue rejected email for house %d: %v", h.ID, err)
			}
		}

	default: // review, or reject below the confidence bar
		if err := s.repo.SetHouseModeration(ctx, h.ID, domain.HouseStatusModerationReview, ""); err != nil {
			log.Printf("moderation: send house %d to review: %v", h.ID, err)
			return
		}
		s.checkReviewQueueAlert(ctx)
	}
}

// --- circuit breaker -------------------------------------------------------

func (s *Service) isDegraded() bool {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.degraded
}

func (s *Service) recordLLMFailure(ctx context.Context) {
	s.mu.Lock()
	s.consecFails++
	justOpened := !s.degraded && s.consecFails >= breakerThreshold
	if justOpened {
		s.degraded = true
	}
	s.mu.Unlock()

	if justOpened {
		log.Printf("moderation: circuit OPEN after %d consecutive LLM failures — degraded mode", breakerThreshold)
		s.alertAdmin(ctx, "llm_degraded_"+time.Now().Format("2006-01-02"),
			"Модерация: LLM недоступен",
			"Сервис модерации перешёл в аварийный режим: объявления без нарушений публикуются без LLM-проверки и будут перепроверены после восстановления.")
	}
}

func (s *Service) recordLLMSuccess(ctx context.Context) {
	s.mu.Lock()
	wasDegraded := s.degraded
	s.consecFails = 0
	s.degraded = false
	s.mu.Unlock()

	if wasDegraded {
		log.Printf("moderation: circuit CLOSED — LLM recovered, catching up the queue")
		s.alertAdmin(ctx, "llm_recovered_"+time.Now().Format("2006-01-02T15"),
			"Модерация: LLM восстановлен",
			"Сервис модерации вышел из аварийного режима и догоняет очередь проверок.")
	}
}

// checkReviewQueueAlert emails the admin when the human review queue grows
// past the threshold. Deduped per size bucket per day via the outbox.
func (s *Service) checkReviewQueueAlert(ctx context.Context) {
	n, err := s.repo.CountReviewQueue(ctx)
	if err != nil {
		return
	}
	s.mu.Lock()
	s.lastQueueLen = n
	s.mu.Unlock()
	if n >= reviewQueueAlertSize {
		s.alertAdmin(ctx, fmt.Sprintf("review_queue_%s", time.Now().Format("2006-01-02")),
			"Модерация: растёт очередь ручной проверки",
			fmt.Sprintf("В очереди ручной модерации %d объявлений.", n))
	}
}

func (s *Service) alertAdmin(ctx context.Context, dedupKey, subject, body string) {
	if s.alerter == nil {
		return
	}
	if err := s.alerter.SendAdminAlert(ctx, dedupKey, subject, body); err != nil {
		log.Printf("moderation: admin alert %q: %v", dedupKey, err)
	}
}
