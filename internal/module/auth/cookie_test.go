package auth

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestSetSessionCookie(t *testing.T) {
	for _, secure := range []bool{true, false} {
		rec := httptest.NewRecorder()
		SetSessionCookie(rec, "token-value", secure)

		cookies := rec.Result().Cookies()
		if len(cookies) != 1 {
			t.Fatalf("secure=%v: expected 1 cookie, got %d", secure, len(cookies))
		}
		c := cookies[0]

		if c.Name != CookieName {
			t.Errorf("name = %q, want %q", c.Name, CookieName)
		}
		if c.Value != "token-value" {
			t.Errorf("value = %q, want token-value", c.Value)
		}
		if !c.HttpOnly {
			t.Error("cookie must be HttpOnly")
		}
		if c.Secure != secure {
			t.Errorf("secure=%v: Secure flag = %v", secure, c.Secure)
		}
		if c.SameSite != http.SameSiteStrictMode {
			t.Errorf("SameSite = %v, want Strict", c.SameSite)
		}
		if c.Path != "/" {
			t.Errorf("path = %q, want /", c.Path)
		}
		wantMaxAge := int(SessionTTL.Seconds())
		if c.MaxAge != wantMaxAge {
			t.Errorf("max-age = %d, want %d (7 days)", c.MaxAge, wantMaxAge)
		}
	}
}

func TestClearSessionCookie(t *testing.T) {
	rec := httptest.NewRecorder()
	ClearSessionCookie(rec, true)

	cookies := rec.Result().Cookies()
	if len(cookies) != 1 {
		t.Fatalf("expected 1 cookie, got %d", len(cookies))
	}
	c := cookies[0]

	if c.Name != CookieName {
		t.Errorf("name = %q, want %q", c.Name, CookieName)
	}
	if c.Value != "" {
		t.Errorf("cleared cookie must be empty, got %q", c.Value)
	}
	if c.MaxAge >= 0 {
		t.Errorf("cleared cookie must expire immediately, MaxAge = %d", c.MaxAge)
	}
	if c.Path != "/" || !c.HttpOnly {
		t.Error("cleared cookie must keep same Path and HttpOnly attributes")
	}
}
