package admininbox

import (
	"context"
	"errors"
	"testing"

	"github.com/TrollLOLik/sutki/backend/internal/domain"
)

type inboxRepoStub struct {
	includeModeration bool
	filter            domain.AdminInboxFilter
	detailKind        string
	detailID          int64
	action            domain.AdminInboxAction
}

func (s *inboxRepoStub) ApplyAdminInboxAction(_ context.Context, action domain.AdminInboxAction) (domain.AdminInboxActionResult, error) {
	s.action = action
	return domain.AdminInboxActionResult{Kind: action.Kind, ID: action.ID, Status: "done"}, nil
}

func (s *inboxRepoStub) AdminInboxSummary(context.Context, bool) (domain.AdminInboxSummary, error) {
	return domain.AdminInboxSummary{Reports: 2, Total: 2}, nil
}

func (s *inboxRepoStub) ListAdminInbox(_ context.Context, filter domain.AdminInboxFilter, includeModeration bool) (domain.AdminInboxPage, error) {
	s.filter = filter
	s.includeModeration = includeModeration
	return domain.AdminInboxPage{Items: []domain.AdminInboxItem{}, Limit: filter.Limit, Offset: filter.Offset}, nil
}

func (s *inboxRepoStub) GetAdminInboxItem(_ context.Context, kind string, id int64) (domain.AdminInboxDetail, error) {
	s.detailKind = kind
	s.detailID = id
	return domain.AdminInboxDetail{Item: domain.AdminInboxItem{Kind: kind, ID: id}}, nil
}

func TestSupportSeesReportsOnly(t *testing.T) {
	repo := &inboxRepoStub{}
	svc := New(repo)

	if _, err := svc.List(context.Background(), domain.AdminRoleSupport, domain.AdminInboxFilter{Kind: domain.AdminInboxKindListing}); !errors.Is(err, ErrForbidden) {
		t.Fatalf("support listing access = %v, want ErrForbidden", err)
	}
	page, err := svc.List(context.Background(), domain.AdminRoleSupport, domain.AdminInboxFilter{})
	if err != nil {
		t.Fatalf("support report list: %v", err)
	}
	if repo.includeModeration {
		t.Fatal("support list unexpectedly included moderation queues")
	}
	if page.Limit != defaultLimit || page.Offset != 0 {
		t.Fatalf("page = %#v", page)
	}
}

func TestModeratorGetsNormalizedPagination(t *testing.T) {
	repo := &inboxRepoStub{}
	svc := New(repo)

	_, err := svc.List(context.Background(), domain.AdminRoleModerator, domain.AdminInboxFilter{
		Kind: domain.AdminInboxKindReview, Limit: 1000, Offset: -5,
	})
	if err != nil {
		t.Fatalf("moderator list: %v", err)
	}
	if !repo.includeModeration || repo.filter.Limit != maxLimit || repo.filter.Offset != 0 {
		t.Fatalf("unexpected repository arguments: include=%v filter=%#v", repo.includeModeration, repo.filter)
	}
}

func TestInvalidKindAndDetailIDAreRejected(t *testing.T) {
	svc := New(&inboxRepoStub{})
	if _, err := svc.List(context.Background(), domain.AdminRoleOwner, domain.AdminInboxFilter{Kind: "payments"}); !errors.Is(err, ErrInvalidFilter) {
		t.Fatalf("invalid kind = %v", err)
	}
	if _, err := svc.Get(context.Background(), domain.AdminRoleOwner, domain.AdminInboxKindReport, 0); !errors.Is(err, ErrInvalidFilter) {
		t.Fatalf("invalid detail id = %v", err)
	}
}

func TestModeratorCanReadModerationDetail(t *testing.T) {
	repo := &inboxRepoStub{}
	svc := New(repo)
	got, err := svc.Get(context.Background(), domain.AdminRoleModerator, domain.AdminInboxKindAttachment, 91)
	if err != nil {
		t.Fatalf("Get: %v", err)
	}
	if got.Item.Kind != domain.AdminInboxKindAttachment || repo.detailID != 91 {
		t.Fatalf("unexpected detail: %#v repo=%#v", got, repo)
	}
}

func TestActionsEnforceRolesAndReasons(t *testing.T) {
	repo := &inboxRepoStub{}
	svc := New(repo)
	base := domain.AdminInboxAction{ID: 10, ActorAdminID: 7, ActorUserID: 9}

	listing := base
	listing.Kind = domain.AdminInboxKindListing
	listing.Action = domain.AdminInboxActionApprove
	if _, err := svc.Act(context.Background(), domain.AdminRoleSupport, listing); !errors.Is(err, ErrForbidden) {
		t.Fatalf("support listing action = %v, want ErrForbidden", err)
	}

	report := base
	report.Kind = domain.AdminInboxKindReport
	report.Action = domain.AdminInboxActionResolve
	if _, err := svc.Act(context.Background(), domain.AdminRoleSupport, report); !errors.Is(err, ErrReasonRequired) {
		t.Fatalf("report without reason = %v, want ErrReasonRequired", err)
	}
	report.Reason = "Проверено оператором"
	if _, err := svc.Act(context.Background(), domain.AdminRoleSupport, report); err != nil {
		t.Fatalf("support resolve report: %v", err)
	}
	if repo.action.Reason != report.Reason {
		t.Fatalf("repository action = %#v", repo.action)
	}
}

type wakeStub struct{ calls int }

func (w *wakeStub) Wake() { w.calls++ }

func TestAttachmentRetryWakesWorkerAfterCommit(t *testing.T) {
	repo := &inboxRepoStub{}
	svc := New(repo)
	waker := &wakeStub{}
	svc.SetAttachmentRetryWaker(waker)
	_, err := svc.Act(context.Background(), domain.AdminRoleModerator, domain.AdminInboxAction{
		Kind: domain.AdminInboxKindAttachment, ID: 91, Action: domain.AdminInboxActionRetry,
		ActorAdminID: 7, ActorUserID: 9,
	})
	if err != nil {
		t.Fatalf("retry attachment: %v", err)
	}
	if waker.calls != 1 {
		t.Fatalf("wake calls = %d, want 1", waker.calls)
	}
}
