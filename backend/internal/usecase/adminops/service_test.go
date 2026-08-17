package adminops

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/TrollLOLik/sutki/backend/internal/domain"
)

type repoStub struct {
	createChange domain.AdminStaffChange
	updateChange domain.AdminStaffChange
	auditFilter  domain.AdminAuditFilter
	err          error
}

func (r *repoStub) ListAdminAccounts(context.Context) ([]domain.AdminAccount, error) {
	return nil, r.err
}

func (r *repoStub) CreateAdminAccount(_ context.Context, change domain.AdminStaffChange) (domain.AdminAccount, error) {
	r.createChange = change
	return domain.AdminAccount{ID: 7, Email: change.Email, Role: change.Role, Enabled: true}, r.err
}

func (r *repoStub) UpdateAdminAccount(_ context.Context, change domain.AdminStaffChange) (domain.AdminAccount, error) {
	r.updateChange = change
	return domain.AdminAccount{ID: change.TargetAdminID, Role: change.Role, Enabled: change.Enabled}, r.err
}

func (r *repoStub) ListAdminAudit(_ context.Context, filter domain.AdminAuditFilter) (domain.AdminAuditPage, error) {
	r.auditFilter = filter
	return domain.AdminAuditPage{Limit: filter.Limit, Offset: filter.Offset}, r.err
}

func TestCreateStaffNormalizesEmailAndMetadata(t *testing.T) {
	repo := &repoStub{}
	svc := New(repo)
	svc.now = func() time.Time { return time.Date(2026, 8, 17, 12, 0, 0, 0, time.UTC) }

	account, err := svc.CreateStaff(context.Background(), 3, "  OPERATOR@WIGAJ.RU ", domain.AdminRoleModerator, ClientMeta{
		IPAddress: " 127.0.0.1 ", UserAgent: " test-agent ",
	})
	if err != nil {
		t.Fatal(err)
	}
	if account.Email != "operator@wigaj.ru" || repo.createChange.ActorAdminID != 3 {
		t.Fatalf("unexpected create change: %+v", repo.createChange)
	}
	if repo.createChange.IPAddress != "127.0.0.1" || repo.createChange.UserAgent != "test-agent" {
		t.Fatalf("metadata was not normalized: %+v", repo.createChange)
	}
}

func TestUpdateStaffRejectsSelfChange(t *testing.T) {
	repo := &repoStub{}
	svc := New(repo)

	_, err := svc.UpdateStaff(context.Background(), 9, 9, domain.AdminRoleOwner, true, ClientMeta{})
	if !errors.Is(err, ErrSelfChange) {
		t.Fatalf("expected ErrSelfChange, got %v", err)
	}
}

func TestListAuditNormalizesPage(t *testing.T) {
	repo := &repoStub{}
	svc := New(repo)

	page, err := svc.ListAudit(context.Background(), " admin.staff ", 500, 10)
	if err != nil {
		t.Fatal(err)
	}
	if page.Limit != maxLimit || repo.auditFilter.Action != "admin.staff" || repo.auditFilter.Offset != 10 {
		t.Fatalf("unexpected filter: %+v", repo.auditFilter)
	}
}

func TestCreateStaffRejectsInvalidRole(t *testing.T) {
	svc := New(&repoStub{})
	_, err := svc.CreateStaff(context.Background(), 1, "operator@wigaj.ru", "root", ClientMeta{})
	if !errors.Is(err, ErrInvalidInput) {
		t.Fatalf("expected ErrInvalidInput, got %v", err)
	}
}
