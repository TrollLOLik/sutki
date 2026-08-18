package admininbox

import (
	"context"
	"errors"
	"fmt"
	"log"
	"strconv"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/TrollLOLik/sutki/backend/internal/domain"
)

const (
	defaultLimit int32 = 20
	maxLimit     int32 = 100
	mediaURLTTL        = 2 * time.Minute
)

var (
	ErrForbidden        = errors.New("admin inbox access forbidden")
	ErrInvalidFilter    = errors.New("invalid admin inbox filter")
	ErrInvalidAction    = errors.New("invalid admin inbox action")
	ErrReasonRequired   = errors.New("admin action reason is required")
	ErrMediaUnavailable = errors.New("admin inbox media unavailable")
)

const maxActionReasonRunes = 2000

type attachmentRetryWaker interface {
	Wake()
}

type sessionInvalidator interface {
	InvalidateSessions(sessionIDs []int64)
}

type mediaPresigner interface {
	PresignGet(ctx context.Context, key string, ttl time.Duration) (string, error)
}

type Service struct {
	repo                 domain.AdminInboxRepository
	attachmentRetryWaker attachmentRetryWaker
	sessionInvalidator   sessionInvalidator
	userEvents           domain.UserEventPublisher
	publicStorage        mediaPresigner
	privateStorage       mediaPresigner
}

func (s *Service) SetUserEvents(events domain.UserEventPublisher) {
	s.userEvents = events
}

func (s *Service) SetAttachmentRetryWaker(waker attachmentRetryWaker) {
	s.attachmentRetryWaker = waker
}

func (s *Service) SetSessionInvalidator(invalidator sessionInvalidator) {
	s.sessionInvalidator = invalidator
}

func (s *Service) SetMediaStorages(publicStorage, privateStorage mediaPresigner) {
	s.publicStorage = publicStorage
	s.privateStorage = privateStorage
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

// Search performs exact administrative lookup outside the actionable queue.
// Support may inspect bounded account diagnostics; arbitrary user content is
// reserved for moderators and owners.
func (s *Service) Search(
	ctx context.Context,
	role string,
	filter domain.AdminSearchFilter,
) (domain.AdminSearchPage, error) {
	includeModeration, err := moderationAccess(role)
	if err != nil {
		return domain.AdminSearchPage{}, err
	}
	filter.Kind = strings.TrimSpace(filter.Kind)
	filter.Query = strings.TrimSpace(filter.Query)
	if !validSearchKind(filter.Kind) || filter.Query == "" || utf8.RuneCountInString(filter.Query) > 254 {
		return domain.AdminSearchPage{}, ErrInvalidFilter
	}
	if !includeModeration && filter.Kind != domain.AdminInboxKindUser {
		return domain.AdminSearchPage{}, ErrForbidden
	}
	if filter.Kind == domain.AdminInboxKindUser {
		filter.Phone = searchDigits(filter.Query)
		if parsedID, parseErr := strconv.ParseInt(filter.Query, 10, 64); parseErr == nil && parsedID > 0 {
			filter.ID = parsedID
		}
	} else {
		filter.ID, err = strconv.ParseInt(filter.Query, 10, 64)
		if err != nil || filter.ID <= 0 {
			return domain.AdminSearchPage{}, ErrInvalidFilter
		}
	}
	return s.repo.SearchAdminItems(ctx, filter)
}

func (s *Service) GetSearch(
	ctx context.Context,
	role, kind string,
	id int64,
) (domain.AdminInboxDetail, error) {
	includeModeration, err := moderationAccess(role)
	if err != nil {
		return domain.AdminInboxDetail{}, err
	}
	kind = strings.TrimSpace(kind)
	if !validSearchKind(kind) || id <= 0 {
		return domain.AdminInboxDetail{}, ErrInvalidFilter
	}
	if !includeModeration && kind != domain.AdminInboxKindUser {
		return domain.AdminInboxDetail{}, ErrForbidden
	}
	return s.repo.GetAdminSearchItem(ctx, kind, id)
}

// MediaURL issues a short-lived URL only after the repository has proved
// that mediaID belongs to the requested queue item. Storage keys are never
// accepted from the HTTP client.
func (s *Service) MediaURL(
	ctx context.Context,
	role, kind string,
	id, mediaID int64,
	variant string,
) (string, error) {
	includeModeration, err := moderationAccess(role)
	if err != nil {
		return "", err
	}
	kind = strings.TrimSpace(kind)
	variant = strings.TrimSpace(variant)
	if variant == "" {
		variant = domain.AdminInboxMediaVariantOriginal
	}
	if !validKind(kind) || kind == "" || id <= 0 || mediaID <= 0 ||
		(variant != domain.AdminInboxMediaVariantOriginal && variant != domain.AdminInboxMediaVariantThumbnail) {
		return "", ErrInvalidFilter
	}
	if !includeModeration && kind != domain.AdminInboxKindReport {
		return "", ErrForbidden
	}

	object, err := s.repo.GetAdminInboxMedia(ctx, kind, id, mediaID, variant)
	if err != nil {
		return "", err
	}
	return s.presignMedia(ctx, object)
}

func (s *Service) SearchMediaURL(
	ctx context.Context,
	role, kind string,
	id, mediaID int64,
	variant string,
) (string, error) {
	includeModeration, err := moderationAccess(role)
	if err != nil {
		return "", err
	}
	kind = strings.TrimSpace(kind)
	variant = strings.TrimSpace(variant)
	if variant == "" {
		variant = domain.AdminInboxMediaVariantOriginal
	}
	if !includeModeration || (kind != domain.AdminInboxKindListing && kind != domain.AdminInboxKindMessage) ||
		id <= 0 || mediaID <= 0 ||
		(variant != domain.AdminInboxMediaVariantOriginal && variant != domain.AdminInboxMediaVariantThumbnail) {
		if !includeModeration {
			return "", ErrForbidden
		}
		return "", ErrInvalidFilter
	}
	object, err := s.repo.GetAdminSearchMedia(ctx, kind, id, mediaID, variant)
	if err != nil {
		return "", err
	}
	return s.presignMedia(ctx, object)
}

func (s *Service) presignMedia(ctx context.Context, object domain.AdminInboxMediaObject) (string, error) {
	var storage mediaPresigner
	switch object.Storage {
	case domain.AdminInboxMediaStoragePublic:
		storage = s.publicStorage
	case domain.AdminInboxMediaStoragePrivate:
		storage = s.privateStorage
	default:
		return "", ErrMediaUnavailable
	}
	if storage == nil || strings.TrimSpace(object.Key) == "" {
		return "", ErrMediaUnavailable
	}
	url, err := storage.PresignGet(ctx, object.Key, mediaURLTTL)
	if err != nil {
		return "", fmt.Errorf("%w: presign object: %v", ErrMediaUnavailable, err)
	}
	if strings.TrimSpace(url) == "" {
		return "", ErrMediaUnavailable
	}
	return url, nil
}

func (s *Service) Act(ctx context.Context, role string, action domain.AdminInboxAction) (domain.AdminInboxActionResult, error) {
	includeModeration, err := moderationAccess(role)
	if err != nil {
		return domain.AdminInboxActionResult{}, err
	}
	action.Kind = strings.TrimSpace(action.Kind)
	action.Action = strings.TrimSpace(action.Action)
	action.Reason = strings.TrimSpace(action.Reason)
	action.Sanctions, err = normalizeSanctions(action.Kind, action.Action, action.Sanctions)
	if err != nil {
		return domain.AdminInboxActionResult{}, err
	}
	action.SanctionIDs, err = normalizeSanctionIDs(action.Kind, action.Action, action.SanctionIDs)
	if err != nil {
		return domain.AdminInboxActionResult{}, err
	}
	if action.ID <= 0 || action.ActorAdminID <= 0 || action.ActorUserID <= 0 ||
		!validAction(action.Kind, action.Action) {
		return domain.AdminInboxActionResult{}, ErrInvalidAction
	}
	if !includeModeration && action.Kind != domain.AdminInboxKindReport {
		return domain.AdminInboxActionResult{}, ErrForbidden
	}
	if len(action.Sanctions) > 0 && !includeModeration {
		return domain.AdminInboxActionResult{}, ErrForbidden
	}
	if len(action.SanctionIDs) > 0 && !includeModeration {
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
	if len(result.RevokedSessionIDs) > 0 && s.sessionInvalidator != nil {
		s.sessionInvalidator.InvalidateSessions(result.RevokedSessionIDs)
	}
	s.publishDecision(action, result)
	return result, nil
}

func normalizeSanctions(kind, action string, sanctions []string) ([]string, error) {
	if len(sanctions) == 0 {
		return []string{}, nil
	}
	if kind != domain.AdminInboxKindReport || action != domain.AdminInboxActionResolve {
		return nil, ErrInvalidAction
	}

	normalized := make([]string, 0, 2)
	seen := make(map[string]struct{}, len(sanctions))
	contentSanctions := 0
	for _, raw := range sanctions {
		sanction := strings.TrimSpace(raw)
		if _, ok := seen[sanction]; ok {
			continue
		}
		switch sanction {
		case domain.AdminInboxSanctionRejectListing,
			domain.AdminInboxSanctionHideReview,
			domain.AdminInboxSanctionHideMessage:
			contentSanctions++
		case domain.AdminInboxSanctionDisableUser:
		default:
			return nil, ErrInvalidAction
		}
		if contentSanctions > 1 {
			return nil, ErrInvalidAction
		}
		seen[sanction] = struct{}{}
		normalized = append(normalized, sanction)
	}
	if len(normalized) > 2 {
		return nil, ErrInvalidAction
	}
	return normalized, nil
}

func normalizeSanctionIDs(kind, action string, ids []int64) ([]int64, error) {
	if len(ids) == 0 {
		if action == domain.AdminInboxActionRevoke {
			return nil, ErrInvalidAction
		}
		return []int64{}, nil
	}
	if kind != domain.AdminInboxKindReport || action != domain.AdminInboxActionRevoke {
		return nil, ErrInvalidAction
	}
	normalized := make([]int64, 0, 2)
	seen := make(map[int64]struct{}, len(ids))
	for _, id := range ids {
		if id <= 0 {
			return nil, ErrInvalidAction
		}
		if _, ok := seen[id]; ok {
			continue
		}
		seen[id] = struct{}{}
		normalized = append(normalized, id)
	}
	if len(normalized) == 0 || len(normalized) > 2 {
		return nil, ErrInvalidAction
	}
	return normalized, nil
}

func (s *Service) publishDecision(action domain.AdminInboxAction, result domain.AdminInboxActionResult) {
	if s.userEvents == nil || result.SubjectUserID == nil || *result.SubjectUserID <= 0 {
		return
	}
	eventType, scope := "", ""
	eventEntityID := action.ID
	switch action.Kind {
	case domain.AdminInboxKindListing:
		eventType, scope = "listing.changed", domain.ActivityScopeListings
	case domain.AdminInboxKindReview, domain.AdminInboxKindReviewReply:
		eventType, scope = "review.changed", domain.ActivityScopeReviews
	case domain.AdminInboxKindReport:
		eventEntityID = result.TargetID
		switch result.TargetType {
		case domain.ReportTargetListing:
			if containsSanction(result.Sanctions, domain.AdminInboxSanctionRejectListing) {
				eventType, scope = "listing.changed", domain.ActivityScopeListings
			}
		case domain.ReportTargetReview:
			if containsSanction(result.Sanctions, domain.AdminInboxSanctionHideReview) {
				eventType, scope = "review.changed", domain.ActivityScopeReviews
			}
		case domain.ReportTargetMessage:
			if containsSanction(result.Sanctions, domain.AdminInboxSanctionHideMessage) {
				eventType, scope = "message.changed", domain.ActivityScopeMessages
			}
		}
	default:
		return
	}
	if eventType == "" {
		return
	}
	payload := map[string]any{"status": result.Status, "target_type": action.Kind}
	if len(result.Sanctions) > 0 {
		payload["sanctions"] = result.Sanctions
	}
	if action.Reason != "" {
		payload["reason"] = action.Reason
	}
	eventAction := "moderated"
	if action.Action == domain.AdminInboxActionRevoke {
		eventAction = "restored"
		payload["restored"] = true
		payload["revoked_sanction_ids"] = result.RevokedSanctionIDs
	}
	userID := *result.SubjectUserID
	eventKey := fmt.Sprintf(
		"admin:%d:%s:%d:%s:%s:%v",
		action.ActorAdminID, action.Kind, action.ID, action.Action, result.Status, result.RevokedSanctionIDs,
	)
	go func() {
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		if err := s.userEvents.PublishUserEvent(ctx, userID, domain.UserEvent{
			EventKey: eventKey,
			Type:     eventType, Scope: scope, Action: eventAction, EntityID: eventEntityID,
			Payload: payload, OccurredAt: time.Now().UTC(), MarkUnread: true,
		}); err != nil {
			log.Printf("admin inbox realtime decision for %s %d: %v", action.Kind, action.ID, err)
		}
	}()
}

func containsSanction(sanctions []string, wanted string) bool {
	for _, sanction := range sanctions {
		if sanction == wanted {
			return true
		}
	}
	return false
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

func validSearchKind(kind string) bool {
	switch kind {
	case domain.AdminInboxKindUser, domain.AdminInboxKindListing,
		domain.AdminInboxKindReview, domain.AdminInboxKindMessage:
		return true
	default:
		return false
	}
}

func searchDigits(value string) string {
	var result strings.Builder
	result.Grow(len(value))
	for _, char := range value {
		if char >= '0' && char <= '9' {
			result.WriteRune(char)
		}
	}
	return result.String()
}

func validAction(kind, action string) bool {
	switch kind {
	case domain.AdminInboxKindReport:
		return action == domain.AdminInboxActionStartReview ||
			action == domain.AdminInboxActionResolve ||
			action == domain.AdminInboxActionDismiss ||
			action == domain.AdminInboxActionRevoke
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
			(action == domain.AdminInboxActionResolve || action == domain.AdminInboxActionDismiss || action == domain.AdminInboxActionRevoke))
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
