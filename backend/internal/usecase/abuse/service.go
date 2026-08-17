package abuse

import (
	"context"
	"errors"
	"strings"
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
	repo domain.AbuseRepository
}

func New(repo domain.AbuseRepository) *Service {
	return &Service{repo: repo}
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

	return s.repo.CreateReport(ctx, in, maxReportsPerDay)
}

func (s *Service) Block(ctx context.Context, blockerUserID, blockedUserID int32) (domain.BlockedUser, error) {
	if blockerUserID == blockedUserID {
		return domain.BlockedUser{}, domain.ErrSelfBlock
	}
	return s.repo.BlockUser(ctx, blockerUserID, blockedUserID)
}

func (s *Service) Unblock(ctx context.Context, blockerUserID, blockedUserID int32) error {
	if blockerUserID == blockedUserID {
		return domain.ErrSelfBlock
	}
	return s.repo.UnblockUser(ctx, blockerUserID, blockedUserID)
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
