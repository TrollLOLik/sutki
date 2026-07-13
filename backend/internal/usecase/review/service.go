package review

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/TrollLOLik/sutki/backend/internal/domain"
)

const (
	defaultLimit int32 = 20
	maxLimit     int32 = 100
	// maxBodyLen mirrors the legacy `review.body` varchar(1500) limit.
	maxBodyLen = 1500
)

// Service implements the listing reviews use cases.
type Service struct {
	repo         domain.ReviewRepository
	listingRepo  domain.ListingRepository
	aiSummarizer domain.AISummarizer
	users        domain.UserRepository
	notifier     domain.EmailNotifier
	llm          reviewLLM
	wake         chan struct{}
}

type reviewLLM interface {
	Generate(context.Context, string, string, int, float64) (string, error)
}

// New wires the review service. users and notifier may be nil (tests, or
// email disabled): the "new review" owner email is then skipped.
func New(repo domain.ReviewRepository, listingRepo domain.ListingRepository, aiSummarizer domain.AISummarizer, users domain.UserRepository, notifier domain.EmailNotifier, llm reviewLLM) *Service {
	return &Service{repo: repo, listingRepo: listingRepo, aiSummarizer: aiSummarizer, users: users, notifier: notifier, llm: llm, wake: make(chan struct{}, 1)}
}

// ListResult is a page of a listing's reviews plus the rating summary.
type ListResult struct {
	Items   []domain.Review
	Summary domain.RatingSummary
	Total   int64
	Limit   int32
	Offset  int32
}

func clamp(limit, offset int32) (int32, int32) {
	if limit <= 0 {
		limit = defaultLimit
	}
	if limit > maxLimit {
		limit = maxLimit
	}
	if offset < 0 {
		offset = 0
	}
	return limit, offset
}

// List returns a page of houseID's published reviews plus the rating summary
// (average, count, star distribution). The listing must exist.
func (s *Service) List(ctx context.Context, houseID, limit, offset int32) (ListResult, error) {
	exists, err := s.repo.HouseExists(ctx, houseID)
	if err != nil {
		return ListResult{}, err
	}
	if !exists {
		return ListResult{}, domain.ErrNotFound
	}
	limit, offset = clamp(limit, offset)
	items, err := s.repo.ListByHouse(ctx, houseID, limit, offset)
	if err != nil {
		return ListResult{}, err
	}
	total, err := s.repo.CountByHouse(ctx, houseID)
	if err != nil {
		return ListResult{}, err
	}
	summary, err := s.repo.Summary(ctx, houseID)
	if err != nil {
		return ListResult{}, err
	}
	return ListResult{Items: items, Summary: summary, Total: total, Limit: limit, Offset: offset}, nil
}

// Create validates and stores a review authored by r.AuthorID for r.HouseID.
// Rating must be 1..5 and the body non-empty; the listing must exist.
func (s *Service) Create(ctx context.Context, r domain.NewReview) (domain.Review, error) {
	r.Body = strings.TrimSpace(r.Body)
	if r.Rating < 1 || r.Rating > 5 || r.Body == "" || utf8.RuneCountInString(r.Body) > maxBodyLen {
		return domain.Review{}, domain.ErrInvalidReview
	}
	if r.RequestID <= 0 {
		return domain.Review{}, domain.ErrReviewNotAllowed
	}
	inspection := inspectText(r.Body)
	created, err := s.repo.CreatePending(ctx, r, reviewContentHash("review", r.Body), inspection.MaskedBody, inspection.Categories)
	if err != nil {
		return domain.Review{}, err
	}
	select {
	case s.wake <- struct{}{}:
	default:
	}
	return created, nil
}

func (s *Service) Eligibility(ctx context.Context, requestID, userID int32) (domain.ReviewEligibility, error) {
	return s.repo.Eligibility(ctx, requestID, userID)
}
func (s *Service) ListEligibility(ctx context.Context, userID int32) ([]domain.ReviewEligibility, error) {
	return s.repo.ListEligibility(ctx, userID)
}

func (s *Service) CreateReply(ctx context.Context, reviewID, ownerID int32, body string) (domain.ReviewReply, error) {
	body = strings.TrimSpace(body)
	if body == "" || utf8.RuneCountInString(body) > maxBodyLen {
		return domain.ReviewReply{}, domain.ErrInvalidReview
	}
	inspection := inspectText(body)
	reply, err := s.repo.CreateReply(ctx, reviewID, ownerID, body, reviewContentHash("reply", body), inspection.MaskedBody, inspection.Categories)
	if err == nil {
		select {
		case s.wake <- struct{}{}:
		default:
		}
	}
	return reply, err
}

// notifyOwner queues the "new review" email for the listing owner. Errors
// are logged and dropped: the review is already published.
func (s *Service) notifyOwner(ctx context.Context, house domain.House, rev domain.Review) {
	defer func() {
		if r := recover(); r != nil {
			log.Printf("review notify panic recovered: %v", r)
		}
	}()

	owner, err := s.users.GetByID(ctx, house.OwnerID)
	if err != nil {
		log.Printf("review notify: owner %d lookup for review %d: %v", house.OwnerID, rev.ID, err)
		return
	}
	if owner.Email == "" {
		return
	}

	address := strings.TrimSpace(strings.Join(nonEmpty(house.City, strings.TrimSpace(house.Street+" "+house.HouseNumber)), ", "))
	if err := s.notifier.NotifyReviewReceived(ctx, owner.ID, owner.Email, int64(rev.ID), rev.Rating, address); err != nil {
		log.Printf("review notify: queue email for review %d: %v", rev.ID, err)
	}
}

// nonEmpty filters out empty strings, keeping order.
func nonEmpty(parts ...string) []string {
	out := parts[:0]
	for _, p := range parts {
		if p != "" {
			out = append(out, p)
		}
	}
	return out
}

func (s *Service) regenerateReviewsSummary(ctx context.Context, houseID int32) error {
	count, err := s.repo.CountByHouse(ctx, houseID)
	if err != nil {
		return err
	}
	if count < 3 {
		return nil
	}

	// Fetch the last 15 reviews
	reviews, err := s.repo.ListByHouse(ctx, houseID, 15, 0)
	if err != nil {
		return err
	}

	var reviewTexts []string
	for _, rev := range reviews {
		reviewTexts = append(reviewTexts, rev.Body)
	}

	summary, err := s.aiSummarizer.GenerateReviewsSummary(ctx, reviewTexts)
	if err != nil {
		return err
	}

	return s.listingRepo.UpdateReviewsSummary(ctx, houseID, &summary)
}

type reviewVerdict struct {
	Decision   string  `json:"decision"`
	Category   string  `json:"category"`
	Reason     string  `json:"reason"`
	Confidence float32 `json:"confidence"`
}

const reviewModerationPrompt = `Ты модерируешь отзывы и ответы владельцев на российской платформе аренды жилья. Верни только JSON: {"decision":"approve|approve_masked|reject|review","category":"clean|profanity|abuse|privacy|spam|off_topic","reason":"краткая причина","confidence":0.0}.
approve — безопасный содержательный текст. approve_masked — содержательный текст с легкой ненормативной лексикой, если система сообщила, что детерминированная маска доступна. reject — угрозы, травля, дискриминация, публикация контактов, спам либо текст, состоящий из оскорблений без полезного опыта. review используй только при реальной неоднозначности. Никогда не переписывай и не возвращай пользовательский текст.`

func (s *Service) StartWorker(ctx context.Context) {
	go func() {
		ticker := time.NewTicker(15 * time.Second)
		defer ticker.Stop()
		s.processModeration(ctx)
		s.processSummaries(ctx)
		for {
			select {
			case <-ctx.Done():
				return
			case <-ticker.C:
				s.processModeration(ctx)
				s.processSummaries(ctx)
			case <-s.wake:
				s.processModeration(ctx)
			}
		}
	}()
	log.Println("review moderation worker: started (fail-closed)")
}

func (s *Service) processModeration(ctx context.Context) {
	if s.llm == nil {
		return
	}
	for {
		jobs, err := s.repo.DueModerationJobs(ctx, 10)
		if err != nil {
			log.Printf("review moderation: claim: %v", err)
			return
		}
		if len(jobs) == 0 {
			return
		}
		for _, job := range jobs {
			if err := s.processModerationJob(ctx, job); err != nil {
				delay := time.Duration(job.Attempts+1) * time.Minute
				if delay > 15*time.Minute {
					delay = 15 * time.Minute
				}
				_ = s.repo.RetryModeration(ctx, job, err.Error(), time.Now().Add(delay))
				log.Printf("review moderation: job %d: %v", job.ID, err)
			}
		}
	}
}

func (s *Service) processModerationJob(ctx context.Context, job domain.ReviewModerationJob) error {
	target, err := s.repo.LoadModerationTarget(ctx, job)
	if errors.Is(err, domain.ErrNotFound) || errors.Is(err, context.Canceled) {
		return err
	}
	if err != nil {
		return err
	}
	input := fmt.Sprintf("Тип: %s\nPrefilter: %s\nДетерминированная маска доступна: %t\n<user_content>\n%s\n</user_content>", target.TargetType, strings.Join(target.Categories, ","), target.MaskedBody != "" && target.MaskedBody != target.Body, target.Body)
	answer, err := s.llm.Generate(ctx, reviewModerationPrompt, input, 220, 0)
	if err != nil {
		return err
	}
	verdict, err := parseReviewVerdict(answer)
	if err != nil {
		return err
	}
	if verdict.Decision == "review" {
		second, secondErr := s.llm.Generate(ctx, reviewModerationPrompt+"\nЭто повторная строгая проверка. Выбери approve/reject/approve_masked, если это безопасно; review оставь только для действительно неразрешимого случая.", input, 220, 0)
		if secondErr == nil {
			if parsed, parseErr := parseReviewVerdict(second); parseErr == nil {
				verdict = parsed
				answer = second
			}
		}
	}
	if verdict.Decision == "approve_masked" && (target.MaskedBody == "" || target.MaskedBody == target.Body) {
		verdict.Decision = "reject"
		verdict.Category = "unsafe_mask"
		verdict.Reason = "Текст содержит выражения, которые не удалось безопасно скрыть"
	}
	raw, _ := json.Marshal(map[string]string{"answer": answer})
	if err = s.repo.CompleteModeration(ctx, job, verdict.Decision, verdict.Category, verdict.Reason, verdict.Confidence, raw); err != nil {
		return err
	}
	if target.TargetType == "review" && (verdict.Decision == "approve" || verdict.Decision == "approve_masked") && s.listingRepo != nil && s.notifier != nil && s.users != nil {
		if house, getErr := s.listingRepo.GetByID(context.Background(), target.HouseID); getErr == nil {
			go s.notifyOwner(context.Background(), house, domain.Review{ID: target.ReviewID, Rating: target.Rating})
		}
	}
	return nil
}

func parseReviewVerdict(answer string) (reviewVerdict, error) {
	trimmed := strings.TrimSpace(answer)
	if start := strings.Index(trimmed, "{"); start >= 0 {
		if end := strings.LastIndex(trimmed, "}"); end >= start {
			trimmed = trimmed[start : end+1]
		}
	}
	var verdict reviewVerdict
	if err := json.Unmarshal([]byte(trimmed), &verdict); err != nil {
		return verdict, fmt.Errorf("parse review verdict: %w", err)
	}
	switch verdict.Decision {
	case "approve", "approve_masked", "reject", "review":
	default:
		return verdict, fmt.Errorf("invalid review decision %q", verdict.Decision)
	}
	return verdict, nil
}

func (s *Service) processSummaries(ctx context.Context) {
	if s.aiSummarizer == nil {
		return
	}
	houses, err := s.repo.DueSummaryHouses(ctx, 5)
	if err != nil {
		log.Printf("review summary: claim: %v", err)
		return
	}
	for _, houseID := range houses {
		if err := s.regenerateReviewsSummary(ctx, houseID); err != nil {
			_ = s.repo.RetrySummary(ctx, houseID, err.Error(), time.Now().Add(10*time.Minute))
			continue
		}
		_ = s.repo.CompleteSummary(ctx, houseID)
	}
}

// UserReviewsResult is a page of reviews left by a user or received by a host.
type UserReviewsResult struct {
	Items  []domain.Review `json:"items"`
	Total  int64           `json:"total"`
	Limit  int32           `json:"limit"`
	Offset int32           `json:"offset"`
}

func (s *Service) ListByAuthor(ctx context.Context, userID, limit, offset int32) (UserReviewsResult, error) {
	limit, offset = clamp(limit, offset)
	items, err := s.repo.ListByAuthor(ctx, userID, limit, offset)
	if err != nil {
		return UserReviewsResult{}, err
	}
	total, err := s.repo.CountByAuthor(ctx, userID)
	if err != nil {
		return UserReviewsResult{}, err
	}
	return UserReviewsResult{Items: items, Total: total, Limit: limit, Offset: offset}, nil
}

func (s *Service) ListForHost(ctx context.Context, userID, limit, offset int32) (UserReviewsResult, error) {
	limit, offset = clamp(limit, offset)
	items, err := s.repo.ListForHost(ctx, userID, limit, offset)
	if err != nil {
		return UserReviewsResult{}, err
	}
	total, err := s.repo.CountForHost(ctx, userID)
	if err != nil {
		return UserReviewsResult{}, err
	}
	return UserReviewsResult{Items: items, Total: total, Limit: limit, Offset: offset}, nil
}

func (s *Service) ListForHostWithSummary(ctx context.Context, hostID, limit, offset int32) (ListResult, error) {
	limit, offset = clamp(limit, offset)
	items, err := s.repo.ListForHost(ctx, hostID, limit, offset)
	if err != nil {
		return ListResult{}, err
	}
	total, err := s.repo.CountForHost(ctx, hostID)
	if err != nil {
		return ListResult{}, err
	}
	summary, err := s.repo.SummaryForHost(ctx, hostID)
	if err != nil {
		return ListResult{}, err
	}
	return ListResult{Items: items, Summary: summary, Total: total, Limit: limit, Offset: offset}, nil
}
