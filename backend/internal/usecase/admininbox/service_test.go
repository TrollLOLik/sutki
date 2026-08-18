package admininbox

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/TrollLOLik/sutki/backend/internal/domain"
)

type inboxRepoStub struct {
	includeModeration bool
	filter            domain.AdminInboxFilter
	detailKind        string
	detailID          int64
	action            domain.AdminInboxAction
	mediaKind         string
	mediaItemID       int64
	mediaID           int64
	mediaVariant      string
	mediaObject       domain.AdminInboxMediaObject
	mediaErr          error
	searchFilter      domain.AdminSearchFilter
	searchKind        string
	searchID          int64
}

func (s *inboxRepoStub) ApplyAdminInboxAction(_ context.Context, action domain.AdminInboxAction) (domain.AdminInboxActionResult, error) {
	s.action = action
	result := domain.AdminInboxActionResult{
		Kind: action.Kind, ID: action.ID, Status: "done", Sanctions: action.Sanctions,
		RevokedSanctionIDs: action.SanctionIDs,
	}
	if action.Action == domain.AdminInboxActionRevoke {
		result.Sanctions = []string{domain.AdminInboxSanctionHideMessage}
	}
	for _, sanction := range action.Sanctions {
		if sanction == domain.AdminInboxSanctionDisableUser {
			result.RevokedSessionIDs = []int64{21, 22}
		}
	}
	return result, nil
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

func (s *inboxRepoStub) SearchAdminItems(_ context.Context, filter domain.AdminSearchFilter) (domain.AdminSearchPage, error) {
	s.searchFilter = filter
	return domain.AdminSearchPage{Items: []domain.AdminInboxItem{}}, nil
}

func (s *inboxRepoStub) GetAdminSearchItem(_ context.Context, kind string, id int64) (domain.AdminInboxDetail, error) {
	s.searchKind = kind
	s.searchID = id
	return domain.AdminInboxDetail{Item: domain.AdminInboxItem{Kind: kind, ID: id}}, nil
}

func (s *inboxRepoStub) GetAdminSearchMedia(
	ctx context.Context, kind string, id, mediaID int64, variant string,
) (domain.AdminInboxMediaObject, error) {
	return s.GetAdminInboxMedia(ctx, kind, id, mediaID, variant)
}

func (s *inboxRepoStub) GetAdminInboxMedia(
	_ context.Context,
	kind string,
	id, mediaID int64,
	variant string,
) (domain.AdminInboxMediaObject, error) {
	s.mediaKind = kind
	s.mediaItemID = id
	s.mediaID = mediaID
	s.mediaVariant = variant
	return s.mediaObject, s.mediaErr
}

type mediaPresignerStub struct {
	key string
	ttl time.Duration
	url string
	err error
}

func (s *mediaPresignerStub) PresignGet(_ context.Context, key string, ttl time.Duration) (string, error) {
	s.key = key
	s.ttl = ttl
	return s.url, s.err
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

func TestAdminSearchNormalizesExactUserLookup(t *testing.T) {
	repo := &inboxRepoStub{}
	svc := New(repo)

	if _, err := svc.Search(context.Background(), domain.AdminRoleSupport, domain.AdminSearchFilter{
		Kind: domain.AdminInboxKindUser, Query: "+7 (982) 322-50-60",
	}); err != nil {
		t.Fatalf("support user search: %v", err)
	}
	if repo.searchFilter.Phone != "79823225060" || repo.searchFilter.Query != "+7 (982) 322-50-60" {
		t.Fatalf("normalized filter = %#v", repo.searchFilter)
	}
	if _, err := svc.Search(context.Background(), domain.AdminRoleSupport, domain.AdminSearchFilter{
		Kind: domain.AdminInboxKindMessage, Query: "15",
	}); !errors.Is(err, ErrForbidden) {
		t.Fatalf("support message search = %v, want ErrForbidden", err)
	}
}

func TestModeratorSearchRequiresPositiveObjectID(t *testing.T) {
	repo := &inboxRepoStub{}
	svc := New(repo)
	if _, err := svc.Search(context.Background(), domain.AdminRoleModerator, domain.AdminSearchFilter{
		Kind: domain.AdminInboxKindListing, Query: "не-id",
	}); !errors.Is(err, ErrInvalidFilter) {
		t.Fatalf("invalid listing search = %v, want ErrInvalidFilter", err)
	}
	if _, err := svc.Search(context.Background(), domain.AdminRoleModerator, domain.AdminSearchFilter{
		Kind: domain.AdminInboxKindMessage, Query: "42",
	}); err != nil {
		t.Fatalf("message search: %v", err)
	}
	if repo.searchFilter.ID != 42 {
		t.Fatalf("search ID = %d, want 42", repo.searchFilter.ID)
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

func TestMediaURLUsesRelationCheckedPublicObject(t *testing.T) {
	repo := &inboxRepoStub{mediaObject: domain.AdminInboxMediaObject{
		Key: "listings/12/photo.jpg", Storage: domain.AdminInboxMediaStoragePublic,
	}}
	publicStorage := &mediaPresignerStub{url: "https://media.example/signed"}
	privateStorage := &mediaPresignerStub{url: "https://private.example/signed"}
	svc := New(repo)
	svc.SetMediaStorages(publicStorage, privateStorage)

	got, err := svc.MediaURL(
		context.Background(), domain.AdminRoleModerator,
		domain.AdminInboxKindListing, 12, 33, "",
	)
	if err != nil {
		t.Fatalf("MediaURL: %v", err)
	}
	if got != publicStorage.url || publicStorage.key != repo.mediaObject.Key || publicStorage.ttl != mediaURLTTL {
		t.Fatalf("unexpected public presign: url=%q storage=%#v", got, publicStorage)
	}
	if privateStorage.key != "" {
		t.Fatalf("private storage unexpectedly used: %#v", privateStorage)
	}
	if repo.mediaKind != domain.AdminInboxKindListing || repo.mediaItemID != 12 || repo.mediaID != 33 ||
		repo.mediaVariant != domain.AdminInboxMediaVariantOriginal {
		t.Fatalf("repository relation arguments = %#v", repo)
	}
}

func TestMediaURLUsesPrivateThumbnailForReport(t *testing.T) {
	repo := &inboxRepoStub{mediaObject: domain.AdminInboxMediaObject{
		Key: "chat/thumbs/91.jpg", Storage: domain.AdminInboxMediaStoragePrivate,
	}}
	privateStorage := &mediaPresignerStub{url: "https://private.example/thumbnail"}
	svc := New(repo)
	svc.SetMediaStorages(&mediaPresignerStub{}, privateStorage)

	got, err := svc.MediaURL(
		context.Background(), domain.AdminRoleSupport,
		domain.AdminInboxKindReport, 7, 91, domain.AdminInboxMediaVariantThumbnail,
	)
	if err != nil {
		t.Fatalf("MediaURL: %v", err)
	}
	if got != privateStorage.url || privateStorage.key != repo.mediaObject.Key ||
		repo.mediaVariant != domain.AdminInboxMediaVariantThumbnail {
		t.Fatalf("unexpected private presign: url=%q repo=%#v storage=%#v", got, repo, privateStorage)
	}
}

func TestMediaURLEnforcesRoleAndInputBeforeRepository(t *testing.T) {
	repo := &inboxRepoStub{}
	svc := New(repo)

	if _, err := svc.MediaURL(
		context.Background(), domain.AdminRoleSupport,
		domain.AdminInboxKindAttachment, 91, 91, "",
	); !errors.Is(err, ErrForbidden) {
		t.Fatalf("support attachment media = %v, want ErrForbidden", err)
	}
	if repo.mediaID != 0 {
		t.Fatal("repository was called for forbidden media")
	}
	if _, err := svc.MediaURL(
		context.Background(), domain.AdminRoleOwner,
		domain.AdminInboxKindReport, 1, 2, "raw_storage_key",
	); !errors.Is(err, ErrInvalidFilter) {
		t.Fatalf("invalid variant = %v, want ErrInvalidFilter", err)
	}
}

func TestMediaURLFailsClosedWithoutConfiguredStorage(t *testing.T) {
	repo := &inboxRepoStub{mediaObject: domain.AdminInboxMediaObject{
		Key: "chat/files/91.pdf", Storage: domain.AdminInboxMediaStoragePrivate,
	}}
	svc := New(repo)
	if _, err := svc.MediaURL(
		context.Background(), domain.AdminRoleModerator,
		domain.AdminInboxKindAttachment, 91, 91, "",
	); !errors.Is(err, ErrMediaUnavailable) {
		t.Fatalf("missing storage = %v, want ErrMediaUnavailable", err)
	}
}

func TestMediaURLDoesNotPresignUnrelatedMedia(t *testing.T) {
	repo := &inboxRepoStub{mediaErr: domain.ErrNotFound}
	storage := &mediaPresignerStub{url: "https://private.example/should-not-be-used"}
	svc := New(repo)
	svc.SetMediaStorages(storage, storage)

	if _, err := svc.MediaURL(
		context.Background(), domain.AdminRoleModerator,
		domain.AdminInboxKindReport, 7, 999, "",
	); !errors.Is(err, domain.ErrNotFound) {
		t.Fatalf("unrelated media = %v, want ErrNotFound", err)
	}
	if storage.key != "" {
		t.Fatalf("unrelated object was presigned: %#v", storage)
	}
}

func TestMediaURLMapsPresignFailureToUnavailable(t *testing.T) {
	repo := &inboxRepoStub{mediaObject: domain.AdminInboxMediaObject{
		Key: "chat/files/91.pdf", Storage: domain.AdminInboxMediaStoragePrivate,
	}}
	svc := New(repo)
	svc.SetMediaStorages(nil, &mediaPresignerStub{err: errors.New("storage timeout")})

	if _, err := svc.MediaURL(
		context.Background(), domain.AdminRoleModerator,
		domain.AdminInboxKindAttachment, 91, 91, "",
	); !errors.Is(err, ErrMediaUnavailable) {
		t.Fatalf("presign failure = %v, want ErrMediaUnavailable", err)
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

type sessionInvalidatorStub struct{ ids []int64 }

func (s *sessionInvalidatorStub) InvalidateSessions(ids []int64) {
	s.ids = append([]int64(nil), ids...)
}

func TestReportSanctionsAreExplicitNormalizedAndInvalidateSessions(t *testing.T) {
	repo := &inboxRepoStub{}
	invalidator := &sessionInvalidatorStub{}
	svc := New(repo)
	svc.SetSessionInvalidator(invalidator)

	result, err := svc.Act(context.Background(), domain.AdminRoleModerator, domain.AdminInboxAction{
		Kind: domain.AdminInboxKindReport, ID: 10, Action: domain.AdminInboxActionResolve,
		Reason: "Подтверждено оператором", ActorAdminID: 7, ActorUserID: 9,
		Sanctions: []string{
			" " + domain.AdminInboxSanctionHideMessage + " ",
			domain.AdminInboxSanctionDisableUser,
			domain.AdminInboxSanctionDisableUser,
		},
	})
	if err != nil {
		t.Fatalf("resolve with sanctions: %v", err)
	}
	if len(repo.action.Sanctions) != 2 || repo.action.Sanctions[0] != domain.AdminInboxSanctionHideMessage ||
		repo.action.Sanctions[1] != domain.AdminInboxSanctionDisableUser {
		t.Fatalf("normalized sanctions = %#v", repo.action.Sanctions)
	}
	if len(result.Sanctions) != 2 || len(invalidator.ids) != 2 || invalidator.ids[0] != 21 {
		t.Fatalf("result=%#v invalidated=%#v", result, invalidator.ids)
	}
}

func TestReportSanctionsRequireModeratorAndResolveAction(t *testing.T) {
	base := domain.AdminInboxAction{
		Kind: domain.AdminInboxKindReport, ID: 10, Action: domain.AdminInboxActionResolve,
		Reason: "Подтверждено", ActorAdminID: 7, ActorUserID: 9,
		Sanctions: []string{domain.AdminInboxSanctionDisableUser},
	}
	if _, err := New(&inboxRepoStub{}).Act(context.Background(), domain.AdminRoleSupport, base); !errors.Is(err, ErrForbidden) {
		t.Fatalf("support sanction = %v, want ErrForbidden", err)
	}

	base.Action = domain.AdminInboxActionDismiss
	if _, err := New(&inboxRepoStub{}).Act(context.Background(), domain.AdminRoleModerator, base); !errors.Is(err, ErrInvalidAction) {
		t.Fatalf("dismiss sanction = %v, want ErrInvalidAction", err)
	}

	base.Action = domain.AdminInboxActionResolve
	base.Sanctions = []string{"ban_everyone"}
	if _, err := New(&inboxRepoStub{}).Act(context.Background(), domain.AdminRoleOwner, base); !errors.Is(err, ErrInvalidAction) {
		t.Fatalf("unknown sanction = %v, want ErrInvalidAction", err)
	}
}

func TestReportSanctionRevocationNormalizesIDsAndRequiresModerator(t *testing.T) {
	repo := &inboxRepoStub{}
	svc := New(repo)
	action := domain.AdminInboxAction{
		Kind: domain.AdminInboxKindReport, ID: 10, Action: domain.AdminInboxActionRevoke,
		Reason: "Решение пересмотрено", ActorAdminID: 7, ActorUserID: 9,
		SanctionIDs: []int64{31, 31, 32},
	}

	if _, err := svc.Act(context.Background(), domain.AdminRoleSupport, action); !errors.Is(err, ErrForbidden) {
		t.Fatalf("support revoke = %v, want ErrForbidden", err)
	}
	result, err := svc.Act(context.Background(), domain.AdminRoleModerator, action)
	if err != nil {
		t.Fatalf("moderator revoke: %v", err)
	}
	if len(repo.action.SanctionIDs) != 2 || repo.action.SanctionIDs[0] != 31 || repo.action.SanctionIDs[1] != 32 {
		t.Fatalf("normalized sanction IDs = %#v", repo.action.SanctionIDs)
	}
	if len(result.RevokedSanctionIDs) != 2 || len(result.Sanctions) != 1 {
		t.Fatalf("revoke result = %#v", result)
	}
}

func TestReportSanctionRevocationRejectsMissingOrExcessiveIDs(t *testing.T) {
	base := domain.AdminInboxAction{
		Kind: domain.AdminInboxKindReport, ID: 10, Action: domain.AdminInboxActionRevoke,
		Reason: "Решение пересмотрено", ActorAdminID: 7, ActorUserID: 9,
	}
	svc := New(&inboxRepoStub{})
	if _, err := svc.Act(context.Background(), domain.AdminRoleOwner, base); !errors.Is(err, ErrInvalidAction) {
		t.Fatalf("missing IDs = %v, want ErrInvalidAction", err)
	}
	base.SanctionIDs = []int64{1, 2, 3}
	if _, err := svc.Act(context.Background(), domain.AdminRoleOwner, base); !errors.Is(err, ErrInvalidAction) {
		t.Fatalf("too many IDs = %v, want ErrInvalidAction", err)
	}
	base.SanctionIDs = []int64{0}
	if _, err := svc.Act(context.Background(), domain.AdminRoleOwner, base); !errors.Is(err, ErrInvalidAction) {
		t.Fatalf("invalid ID = %v, want ErrInvalidAction", err)
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
