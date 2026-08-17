package http

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

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
		if cookie.Path != "/api/admin/v1" || !cookie.Secure || cookie.SameSite != http.SameSiteStrictMode {
			t.Fatalf("cookie %s is not hardened: %#v", cookie.Name, cookie)
		}
	}
	if !byName[adminSessionCookie].HttpOnly {
		t.Fatal("admin session cookie must be HttpOnly")
	}
	if byName[adminCSRFCookie].HttpOnly {
		t.Fatal("CSRF double-submit cookie must be readable by the admin client")
	}
}
