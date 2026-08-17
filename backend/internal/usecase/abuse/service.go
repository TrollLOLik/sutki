package abuse

import (
	"context"
	"errors"
	"log"
	"strconv"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/TrollLOLik/sutki/backend/internal/domain"
)

const (
	defaultPageLimit int32 = 20
	maxPageLimit     int32 = 100
	maxReportsPerDay int32 = 20
	maxReportDetails       = 1000
	maxUserAgent           = 500
)

var (
	ErrInvalidTargetType = errors.New("invalid report target type")
	ErrInvalidReason     = errors.New("invalid report reason")
	ErrInvalidTargetID   = errors.New("invalid report target id")
	ErrDetailsTooLong    = errors.New("report details too long")
)

type Service struct {
	repo       domain.AbuseRepository
	userEvents domain.UserEventPublisher
	adminQueue domain.AdminQueueNotifier
}

func New(repo domain.AbuseRepository) *Service {
	return &Service{repo: repo}
}

func (s *Service) SetUserEvents(publisher domain.UserEventPublisher) {
	s.userEvents = publisher
}

func (s *Service) SetAdminQueueNotifier(notifier domain.AdminQueueNotifier) {
	s.adminQueue = notifier
}

func (s *Service) Report(ctx context.Context, in domain.CreateAbuseReport) (domain.AbuseReport, error) {
	in.TargetType = strings.ToLower(strings.TrimSpace(in.TargetType))
	in.Reason = strings.ToLower(strings.TrimSpace(in.Reason))
	in.Details = strings.TrimSpace(in.Details)
	in.Source = normalizeSource(in.Source)
	in.AppVersion = strings.TrimSpace(in.AppVersion)
	in.IPAddress = strings.TrimSpace(in.IPAddress)
	in.UserAgent = truncateUTF8(strings.TrimSpace(in.UserAgent), maxUserAgent)

	if in.TargetID <= 0 {
		return domain.AbuseReport{}, ErrInvalidTargetID
	}
	if !validTargetType(in.TargetType) {
		return domain.AbuseReport{}, ErrInvalidTargetType
	}
	if !validReason(in.Reason) {
		return domain.AbuseReport{}, ErrInvalidReason
	}
	if utf8.RuneCountInString(in.Details) > maxReportDetails {
		return domain.AbuseReport{}, ErrDetailsTooLong
	}

	report, err := s.repo.CreateReport(ctx, in, maxReportsPerDay)
	if err != nil {
		return domain.AbuseReport{}, err
	}
	if s.adminQueue != nil {
		go func() {
			notifyCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
			defer cancel()
			subjectUserID := report.ReportedUserID
			if err := s.adminQueue.NotifyAdminQueue(notifyCtx, domain.AdminQueueEvent{
				Kind: domain.AdminInboxKindReport, ID: report.ID,
				Title:  report.TargetType + " #" + strconv.FormatInt(report.TargetID, 10),
				Reason: report.Reason, SubjectUserID: &subjectUserID,
			}); err != nil {
				log.Printf("abuse admin queue notification for report %d: %v", report.ID, err)
			}
		}()
	}
	return report, nil
}

func (s *Service) Block(ctx context.Context, blockerUserID, blockedUserID int32) (domain.BlockedUser, error) {
	if blockerUserID == blockedUserID {
		return domain.BlockedUser{}, domain.ErrSelfBlock
	}
	blocked, err := s.repo.BlockUser(ctx, blockerUserID, blockedUserID)
	if err != nil {
		return domain.BlockedUser{}, err
	}
	s.publishBlockStates(ctx, blockerUserID, blockedUserID, "blocked")
	return blocked, nil
}

func (s *Service) Unblock(ctx context.Context, blockerUserID, blockedUserID int32) error {
	if blockerUserID == blockedUserID {
		return domain.ErrSelfBlock
	}
	if err := s.repo.UnblockUser(ctx, blockerUserID, blockedUserID); err != nil {
		return err
	}
	s.publishBlockStates(ctx, blockerUserID, blockedUserID, "unblocked")
	return nil
}

// publishBlockStates pushes the authoritative pair state to both private user
// channels. The two views intentionally differ: only the user who created an
// active block may see the unblock action.
func (s *Service) publishBlockStates(ctx context.Context, firstUserID, secondUserID int32, action string) {
	if s.userEvents == nil {
		return
	}

	firstState, err := s.repo.BlockState(ctx, firstUserID, secondUserID)
	if err != nil {
		log.Printf("abuse realtime: read block state for user %d: %v", firstUserID, err)
		return
	}
	secondState, err := s.repo.BlockState(ctx, secondUserID, firstUserID)
	if err != nil {
		log.Printf("abuse realtime: read block state for user %d: %v", secondUserID, err)
		return
	}

	type recipientState struct {
		userID      int32
		otherUserID int32
		state       domain.UserBlockState
	}
	recipients := []recipientState{
		{userID: firstUserID, otherUserID: secondUserID, state: firstState},
		{userID: secondUserID, otherUserID: firstUserID, state: secondState},
	}

	go func() {
		publishCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		for _, recipient := range recipients {
			err := s.userEvents.PublishUserEvent(publishCtx, recipient.userID, domain.UserEvent{
				Type:     "user.block.changed",
				Action:   action,
				EntityID: int64(recipient.otherUserID),
				Payload: map[string]any{
					"other_user_id": recipient.otherUserID,
					"blocked":       recipient.state.Blocked,
					"blocked_by_me": recipient.state.BlockedByMe,
				},
				OccurredAt: time.Now().UTC(),
			})
			if err != nil {
				log.Printf("abuse realtime: publish block state to user %d: %v", recipient.userID, err)
			}
		}
	}()
}

func (s *Service) ListBlocked(ctx context.Context, userID, limit, offset int32) (domain.BlockedUsersPage, error) {
	if limit <= 0 {
		limit = defaultPageLimit
	}
	if limit > maxPageLimit {
		limit = maxPageLimit
	}
	if offset < 0 {
		offset = 0
	}
	return s.repo.ListBlockedUsers(ctx, userID, limit, offset)
}

func (s *Service) IsBlockedBetween(ctx context.Context, firstUserID, secondUserID int32) (bool, error) {
	if firstUserID == secondUserID {
		return false, nil
	}
	return s.repo.IsBlockedBetween(ctx, firstUserID, secondUserID)
}

func (s *Service) BlockState(ctx context.Context, viewerUserID, otherUserID int32) (domain.UserBlockState, error) {
	if viewerUserID == otherUserID {
		return domain.UserBlockState{}, nil
	}
	return s.repo.BlockState(ctx, viewerUserID, otherUserID)
}

func validTargetType(value string) bool {
	switch value {
	case domain.ReportTargetUser, domain.ReportTargetListing, domain.ReportTargetMessage, domain.ReportTargetReview:
		return true
	default:
		return false
	}
}

func validReason(value string) bool {
	switch value {
	case domain.ReportReasonSpam,
		domain.ReportReasonFraud,
		domain.ReportReasonHarassment,
		domain.ReportReasonInappropriateContent,
		domain.ReportReasonPersonalData,
		domain.ReportReasonOther:
		return true
	default:
		return false
	}
}

func normalizeSource(value string) string {
	switch strings.ToLower(strings.TrimSpace(value)) {
	case "android":
		return "android"
	case "ios":
		return "ios"
	case "web":
		return "web"
	default:
		return "unknown"
	}
}

func truncateUTF8(value string, maxRunes int) string {
	if utf8.RuneCountInString(value) <= maxRunes {
		return value
	}
	runes := []rune(value)
	return string(runes[:maxRunes])
}
