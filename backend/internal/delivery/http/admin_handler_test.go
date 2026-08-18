package http

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/go-chi/chi/v5"

	"github.com/TrollLOLik/sutki/backend/internal/domain"
	"github.com/TrollLOLik/sutki/backend/internal/usecase/admininbox"
)

type adminMediaRepoStub struct {
	object domain.AdminInboxMediaObject
	detail domain.AdminInboxDetail
}

func (s *adminMediaRepoStub) AdminInboxSummary(context.Context, bool) (domain.AdminInboxSummary, error) {
	return domain.AdminInboxSummary{}, nil
}

func (s *adminMediaRepoStub) ListAdminInbox(context.Context, domain.AdminInboxFilter, bool) (domain.AdminInboxPage, error) {
	return domain.AdminInboxPage{}, nil
}

func (s *adminMediaRepoStub) GetAdminInboxItem(context.Context, string, int64) (domain.AdminInboxDetail, error) {
	return s.detail, nil
}

func (s *adminMediaRepoStub) SearchAdminItems(context.Context, domain.AdminSearchFilter) (domain.AdminSearchPage, error) {
	return domain.AdminSearchPage{}, nil
}

func (s *adminMediaRepoStub) GetAdminSearchItem(context.Context, string, int64) (domain.AdminInboxDetail, error) {
	return s.detail, nil
}

func TestAdminInboxDetailIncludesBoundedUserDiagnostics(t *testing.T) {
	createdAt := time.Date(2026, time.August, 18, 10, 30, 0, 0, time.UTC)
	repo := &adminMediaRepoStub{detail: domain.AdminInboxDetail{
		Item: domain.AdminInboxItem{Kind: domain.AdminInboxKindReport, ID: 17, Status: domain.ReportStatusNew},
		Users: []domain.AdminInboxUser{{
			Relation: domain.AdminInboxUserRelationSubject, ID: 24, Name: "Александр",
			Email: "user@wigaj.ru", PhoneVerified: true, CreatedAt: createdAt,
			ListingsTotal: 3, ReportsReceived: 2,
		}},
	}}
	h := &AdminHandler{inbox: admininbox.New(repo)}
	req := httptest.NewRequest(http.MethodGet, "/api/admin/v1/inbox/report/17", nil)
	routeContext := chi.NewRouteContext()
	routeContext.URLParams.Add("kind", domain.AdminInboxKindReport)
	routeContext.URLParams.Add("id", "17")
	ctx := context.WithValue(req.Context(), chi.RouteCtxKey, routeContext)
	ctx = context.WithValue(ctx, adminSessionKey, domain.AdminSession{
		Account: domain.AdminAccount{ID: 7, UserID: 11, Role: domain.AdminRoleModerator},
	})
	req = req.WithContext(ctx)

	response := httptest.NewRecorder()
	h.getInboxItem(response, req)
	if response.Code != http.StatusOK {
		t.Fatalf("detail returned %d, want 200: %s", response.Code, response.Body.String())
	}
	var body domain.AdminInboxDetail
	if err := json.Unmarshal(response.Body.Bytes(), &body); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if len(body.Users) != 1 || body.Users[0].ID != 24 || body.Users[0].ReportsReceived != 2 {
		t.Fatalf("users = %#v", body.Users)
	}
	if body.Users[0].Email != "user@wigaj.ru" || !body.Users[0].PhoneVerified {
		t.Fatalf("diagnostics = %#v", body.Users[0])
	}
}

func (s *adminMediaRepoStub) GetAdminInboxMedia(context.Context, string, int64, int64, string) (domain.AdminInboxMediaObject, error) {
	return s.object, nil
}

func (s *adminMediaRepoStub) GetAdminSearchMedia(context.Context, string, int64, int64, string) (domain.AdminInboxMediaObject, error) {
	return s.object, nil
}

func (s *adminMediaRepoStub) ApplyAdminInboxAction(context.Context, domain.AdminInboxAction) (domain.AdminInboxActionResult, error) {
	return domain.AdminInboxActionResult{}, nil
}

type adminMediaPresignerStub struct{ url string }

func (s *adminMediaPresignerStub) PresignGet(context.Context, string, time.Duration) (string, error) {
	return s.url, nil
}

func TestAdminOriginGuard(t *testing.T) {
	h := &AdminHandler{cfg: AdminHandlerConfig{AllowedOrigin: "https://admin.wigaj.ru"}}
	next := http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) { w.WriteHeader(http.StatusNoContent) })

	for _, origin := range []string{"", "https://wigaj.ru", "https://admin.wigaj.ru.evil.example"} {
		req := httptest.NewRequest(http.MethodPost, "/api/admin/v1/auth/request-code", nil)
		req.Header.Set("Origin", origin)
		response := httptest.NewRecorder()
		h.originGuard(next).ServeHTTP(response, req)
		if response.Code != http.StatusForbidden {
			t.Fatalf("origin %q returned %d, want 403", origin, response.Code)
		}
	}

	req := httptest.NewRequest(http.MethodPost, "/api/admin/v1/auth/request-code", nil)
	req.Header.Set("Origin", "https://admin.wigaj.ru")
	response := httptest.NewRecorder()
	h.originGuard(next).ServeHTTP(response, req)
	if response.Code != http.StatusNoContent {
		t.Fatalf("allowed origin returned %d, want 204", response.Code)
	}
}

func TestAdminMeReturnsCSRFTokenForReloadedClient(t *testing.T) {
	h := &AdminHandler{}
	req := httptest.NewRequest(http.MethodGet, "/api/admin/v1/auth/me", nil)
	req.AddCookie(&http.Cookie{Name: adminCSRFCookie, Value: "csrf-token", Path: "/api/admin/v1"})
	req = req.WithContext(context.WithValue(req.Context(), adminSessionKey, domain.AdminSession{
		Account:   domain.AdminAccount{ID: 7, UserID: 11, Email: "admin@wigaj.ru", Role: domain.AdminRoleOwner},
		ExpiresAt: time.Now().Add(time.Hour),
	}))

	response := httptest.NewRecorder()
	h.me(response, req)
	if response.Code != http.StatusOK {
		t.Fatalf("me returned %d, want 200", response.Code)
	}
	var body map[string]any
	if err := json.Unmarshal(response.Body.Bytes(), &body); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if body["csrf_token"] != "csrf-token" {
		t.Fatalf("csrf_token = %#v, want csrf-token", body["csrf_token"])
	}
}

func TestAdminSessionCookiesAreSeparateAndHardened(t *testing.T) {
	h := &AdminHandler{cfg: AdminHandlerConfig{SecureCookies: true}}
	response := httptest.NewRecorder()
	h.setSessionCookies(response, "session", "csrf", time.Now().Add(time.Hour))

	cookies := response.Result().Cookies()
	if len(cookies) != 2 {
		t.Fatalf("got %d cookies, want 2", len(cookies))
	}
	byName := map[string]*http.Cookie{}
	for _, cookie := range cookies {
		byName[cookie.Name] = cookie
		if !cookie.Secure || cookie.SameSite != http.SameSiteStrictMode {
			t.Fatalf("cookie %s is not hardened: %#v", cookie.Name, cookie)
		}
	}
	if byName[adminSessionCookie].Path != "/api/admin/v1" || byName[adminCSRFCookie].Path != "/api/admin/v1" {
		t.Fatal("admin cookies must be scoped to /api/admin/v1")
	}
	if !byName[adminSessionCookie].HttpOnly {
		t.Fatal("admin session cookie must be HttpOnly")
	}
	if byName[adminCSRFCookie].HttpOnly {
		t.Fatal("CSRF double-submit cookie must be readable by the admin client")
	}
}

func TestAdminInboxMediaRedirectIsShortLivedAndNotCached(t *testing.T) {
	repo := &adminMediaRepoStub{object: domain.AdminInboxMediaObject{
		Key: "listings/12/photo.jpg", Storage: domain.AdminInboxMediaStoragePublic,
	}}
	inbox := admininbox.New(repo)
	inbox.SetMediaStorages(&adminMediaPresignerStub{url: "https://media.example/signed"}, nil)
	h := &AdminHandler{inbox: inbox}

	req := httptest.NewRequest(http.MethodGet, "/api/admin/v1/inbox/listing/12/media/33", nil)
	routeContext := chi.NewRouteContext()
	routeContext.URLParams.Add("kind", domain.AdminInboxKindListing)
	routeContext.URLParams.Add("id", "12")
	routeContext.URLParams.Add("mediaID", "33")
	ctx := context.WithValue(req.Context(), chi.RouteCtxKey, routeContext)
	ctx = context.WithValue(ctx, adminSessionKey, domain.AdminSession{
		Account: domain.AdminAccount{ID: 7, UserID: 11, Role: domain.AdminRoleModerator},
	})
	req = req.WithContext(ctx)

	response := httptest.NewRecorder()
	h.getInboxMedia(response, req)
	if response.Code != http.StatusTemporaryRedirect {
		t.Fatalf("media returned %d, want 307: %s", response.Code, response.Body.String())
	}
	if got := response.Header().Get("Location"); got != "https://media.example/signed" {
		t.Fatalf("Location = %q", got)
	}
	if got := response.Header().Get("Cache-Control"); got != "private, no-store" {
		t.Fatalf("Cache-Control = %q", got)
	}
}
