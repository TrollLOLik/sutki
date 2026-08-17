package admininbox

import (
	"context"
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
)

var (
	ErrForbidden      = errors.New("admin inbox access forbidden")
	ErrInvalidFilter  = errors.New("invalid admin inbox filter")
	ErrInvalidAction  = errors.New("invalid admin inbox action")
	ErrReasonRequired = errors.New("admin action reason is required")
)

const maxActionReasonRunes = 2000

type attachmentRetryWaker interface {
	Wake()
}

type Service struct {
	repo                 domain.AdminInboxRepository
	attachmentRetryWaker attachmentRetryWaker
	userEvents           domain.UserEventPublisher
}

func (s *Service) SetUserEvents(events domain.UserEventPublisher) {
	s.userEvents = events
}

func (s *Service) SetAttachmentRetryWaker(waker attachmentRetryWaker) {
	s.attachmentRetryWaker = waker
}

func New(repo domain.AdminInboxRepository) *Service {
	return &Service{repo: repo}
}

func (s *Service) Summary(ctx context.Context, role string) (domain.AdminInboxSummary, error) {
	includeModeration, err := moderationAccess(role)
	if err != nil {
		return domain.AdminInboxSummary{}, err
	}
	return s.repo.AdminInboxSummary(ctx, includeModeration)
}

func (s *Service) List(ctx context.Context, role string, filter domain.AdminInboxFilter) (domain.AdminInboxPage, error) {
	includeModeration, err := moderationAccess(role)
	if err != nil {
		return domain.AdminInboxPage{}, err
	}
	filter.Kind = strings.TrimSpace(filter.Kind)
	if !validKind(filter.Kind) {
		return domain.AdminInboxPage{}, ErrInvalidFilter
	}
	if !includeModeration && filter.Kind != "" && filter.Kind != domain.AdminInboxKindReport {
		return domain.AdminInboxPage{}, ErrForbidden
	}
	filter.Limit, filter.Offset = normalizePage(filter.Limit, filter.Offset)
	return s.repo.ListAdminInbox(ctx, filter, includeModeration)
}

func (s *Service) Get(ctx context.Context, role, kind string, id int64) (domain.AdminInboxDetail, error) {
	includeModeration, err := moderationAccess(role)
	if err != nil {
		return domain.AdminInboxDetail{}, err
	}
	kind = strings.TrimSpace(kind)
	if !validKind(kind) || kind == "" || id <= 0 {
		return domain.AdminInboxDetail{}, ErrInvalidFilter
	}
	if !includeModeration && kind != domain.AdminInboxKindReport {
		return domain.AdminInboxDetail{}, ErrForbidden
	}
	return s.repo.GetAdminInboxItem(ctx, kind, id)
}

func (s *Service) Act(ctx context.Context, role string, action domain.AdminInboxAction) (domain.AdminInboxActionResult, error) {
	includeModeration, err := moderationAccess(role)
	if err != nil {
		return domain.AdminInboxActionResult{}, err
	}
	action.Kind = strings.TrimSpace(action.Kind)
	action.Action = strings.TrimSpace(action.Action)
	action.Reason = strings.TrimSpace(action.Reason)
	if action.ID <= 0 || action.ActorAdminID <= 0 || action.ActorUserID <= 0 ||
		!validAction(action.Kind, action.Action) {
		return domain.AdminInboxActionResult{}, ErrInvalidAction
	}
	if !includeModeration && action.Kind != domain.AdminInboxKindReport {
		return domain.AdminInboxActionResult{}, ErrForbidden
	}
	if requiresReason(action.Kind, action.Action) && action.Reason == "" {
		return domain.AdminInboxActionResult{}, ErrReasonRequired
	}
	if utf8.RuneCountInString(action.Reason) > maxActionReasonRunes {
		return domain.AdminInboxActionResult{}, ErrInvalidAction
	}

	result, err := s.repo.ApplyAdminInboxAction(ctx, action)
	if err != nil {
		return domain.AdminInboxActionResult{}, err
	}
	if action.Kind == domain.AdminInboxKindAttachment && action.Action == domain.AdminInboxActionRetry && s.attachmentRetryWaker != nil {
		s.attachmentRetryWaker.Wake()
	}
	s.publishDecision(action, result)
	return result, nil
}

func (s *Service) publishDecision(action domain.AdminInboxAction, result domain.AdminInboxActionResult) {
	if s.userEvents == nil || result.SubjectUserID == nil || *result.SubjectUserID <= 0 {
		return
	}
	eventType, scope := "", ""
	switch action.Kind {
	case domain.AdminInboxKindListing:
		eventType, scope = "listing.changed", domain.ActivityScopeListings
	case domain.AdminInboxKindReview, domain.AdminInboxKindReviewReply:
		eventType, scope = "review.changed", domain.ActivityScopeReviews
	default:
		return
	}
	payload := map[string]any{"status": result.Status, "target_type": action.Kind}
	if action.Reason != "" {
		payload["reason"] = action.Reason
	}
	userID := *result.SubjectUserID
	go func() {
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		if err := s.userEvents.PublishUserEvent(ctx, userID, domain.UserEvent{
			EventKey: fmt.Sprintf("admin:%d:%s:%d:%s", action.ActorAdminID, action.Kind, action.ID, result.Status),
			Type:     eventType, Scope: scope, Action: "moderated", EntityID: action.ID,
			Payload: payload, OccurredAt: time.Now().UTC(), MarkUnread: true,
		}); err != nil {
			log.Printf("admin inbox realtime decision for %s %d: %v", action.Kind, action.ID, err)
		}
	}()
}

func moderationAccess(role string) (bool, error) {
	switch role {
	case domain.AdminRoleSupport:
		return false, nil
	case domain.AdminRoleModerator, domain.AdminRoleOwner:
		return true, nil
	default:
		return false, ErrForbidden
	}
}

func validKind(kind string) bool {
	switch kind {
	case "", domain.AdminInboxKindReport, domain.AdminInboxKindListing,
		domain.AdminInboxKindReview, domain.AdminInboxKindReviewReply,
		domain.AdminInboxKindAttachment:
		return true
	default:
		return false
	}
}

func validAction(kind, action string) bool {
	switch kind {
	case domain.AdminInboxKindReport:
		return action == domain.AdminInboxActionStartReview ||
			action == domain.AdminInboxActionResolve ||
			action == domain.AdminInboxActionDismiss
	case domain.AdminInboxKindListing, domain.AdminInboxKindReview, domain.AdminInboxKindReviewReply:
		return action == domain.AdminInboxActionApprove || action == domain.AdminInboxActionReject
	case domain.AdminInboxKindAttachment:
		return action == domain.AdminInboxActionRetry
	default:
		return false
	}
}

func requiresReason(kind, action string) bool {
	return action == domain.AdminInboxActionReject ||
		(kind == domain.AdminInboxKindReport &&
			(action == domain.AdminInboxActionResolve || action == domain.AdminInboxActionDismiss))
}

func normalizePage(limit, offset int32) (int32, int32) {
	if limit <= 0 {
		limit = defaultLimit
	} else if limit > maxLimit {
		limit = maxLimit
	}
	if offset < 0 {
		offset = 0
	}
	return limit, offset
}
