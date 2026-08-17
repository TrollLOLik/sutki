package abuse

import (
	"context"
	"errors"
	"strings"
	"testing"

	"github.com/TrollLOLik/sutki/backend/internal/domain"
)

type fakeAbuseRepo struct {
	createInput domain.CreateAbuseReport
	createLimit int32
	createErr   error
	blockCalls  int
	listLimit   int32
	listOffset  int32
}

func (f *fakeAbuseRepo) CreateReport(_ context.Context, in domain.CreateAbuseReport, limit int32) (domain.AbuseReport, error) {
	f.createInput = in
	f.createLimit = limit
	if f.createErr != nil {
		return domain.AbuseReport{}, f.createErr
	}
	return domain.AbuseReport{ID: 7, TargetType: in.TargetType, TargetID: in.TargetID, Reason: in.Reason}, nil
}

func (f *fakeAbuseRepo) BlockUser(_ context.Context, _, blockedUserID int32) (domain.BlockedUser, error) {
	f.blockCalls++
	return domain.BlockedUser{UserID: blockedUserID}, nil
}

func (f *fakeAbuseRepo) UnblockUser(context.Context, int32, int32) error { return nil }

func (f *fakeAbuseRepo) ListBlockedUsers(_ context.Context, _ int32, limit, offset int32) (domain.BlockedUsersPage, error) {
	f.listLimit = limit
	f.listOffset = offset
	return domain.BlockedUsersPage{Items: []domain.BlockedUser{}, Limit: limit, Offset: offset}, nil
}

func (f *fakeAbuseRepo) IsBlockedBetween(context.Context, int32, int32) (bool, error) {
	return false, nil
}

func (f *fakeAbuseRepo) BlockState(context.Context, int32, int32) (domain.UserBlockState, error) {
	return domain.UserBlockState{}, nil
}

func TestReportNormalizesAndForwardsServerMetadata(t *testing.T) {
	repo := &fakeAbuseRepo{}
	svc := New(repo)

	_, err := svc.Report(context.Background(), domain.CreateAbuseReport{
		ReporterUserID: 11,
		TargetType:     " MESSAGE ",
		TargetID:       42,
		Reason:         " HARASSMENT ",
		Details:        "  описание  ",
		Source:         "ANDROID",
		AppVersion:     " 1.0.0 ",
		IPAddress:      " 127.0.0.1 ",
		UserAgent:      strings.Repeat("я", 600),
	})
	if err != nil {
		t.Fatalf("Report() error = %v", err)
	}

	if repo.createInput.TargetType != domain.ReportTargetMessage {
		t.Fatalf("target type = %q", repo.createInput.TargetType)
	}
	if repo.createInput.Reason != domain.ReportReasonHarassment {
		t.Fatalf("reason = %q", repo.createInput.Reason)
	}
	if repo.createInput.Details != "описание" {
		t.Fatalf("details = %q", repo.createInput.Details)
	}
	if repo.createInput.Source != "android" || repo.createInput.AppVersion != "1.0.0" {
		t.Fatalf("metadata = source %q version %q", repo.createInput.Source, repo.createInput.AppVersion)
	}
	if got := len([]rune(repo.createInput.UserAgent)); got != maxUserAgent {
		t.Fatalf("user agent rune count = %d, want %d", got, maxUserAgent)
	}
	if repo.createLimit != maxReportsPerDay {
		t.Fatalf("daily limit = %d, want %d", repo.createLimit, maxReportsPerDay)
	}
}

func TestReportRejectsInvalidInputBeforeRepository(t *testing.T) {
	tests := []struct {
		name string
		in   domain.CreateAbuseReport
		want error
	}{
		{name: "target id", in: domain.CreateAbuseReport{TargetType: "user", Reason: "spam"}, want: ErrInvalidTargetID},
		{name: "target type", in: domain.CreateAbuseReport{TargetType: "payment", TargetID: 1, Reason: "spam"}, want: ErrInvalidTargetType},
		{name: "reason", in: domain.CreateAbuseReport{TargetType: "user", TargetID: 1, Reason: "dislike"}, want: ErrInvalidReason},
		{name: "details", in: domain.CreateAbuseReport{TargetType: "user", TargetID: 1, Reason: "spam", Details: strings.Repeat("я", maxReportDetails+1)}, want: ErrDetailsTooLong},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			repo := &fakeAbuseRepo{}
			_, err := New(repo).Report(context.Background(), tt.in)
			if !errors.Is(err, tt.want) {
				t.Fatalf("Report() error = %v, want %v", err, tt.want)
			}
			if repo.createLimit != 0 {
				t.Fatal("repository was called for invalid input")
			}
		})
	}
}

func TestBlockRejectsSelf(t *testing.T) {
	repo := &fakeAbuseRepo{}
	_, err := New(repo).Block(context.Background(), 5, 5)
	if !errors.Is(err, domain.ErrSelfBlock) {
		t.Fatalf("Block() error = %v, want ErrSelfBlock", err)
	}
	if repo.blockCalls != 0 {
		t.Fatal("repository was called for a self-block")
	}
}

func TestListBlockedClampsPagination(t *testing.T) {
	repo := &fakeAbuseRepo{}
	svc := New(repo)

	if _, err := svc.ListBlocked(context.Background(), 1, 1000, -5); err != nil {
		t.Fatalf("ListBlocked() error = %v", err)
	}
	if repo.listLimit != maxPageLimit || repo.listOffset != 0 {
		t.Fatalf("pagination = %d/%d, want %d/0", repo.listLimit, repo.listOffset, maxPageLimit)
	}

	if _, err := svc.ListBlocked(context.Background(), 1, 0, 3); err != nil {
		t.Fatalf("ListBlocked(default) error = %v", err)
	}
	if repo.listLimit != defaultPageLimit || repo.listOffset != 3 {
		t.Fatalf("default pagination = %d/%d, want %d/3", repo.listLimit, repo.listOffset, defaultPageLimit)
	}
}
