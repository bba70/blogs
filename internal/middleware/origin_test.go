package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

func runOriginGuard(t *testing.T, allowed []string, method, origin string) int {
	t.Helper()

	handler := OriginGuard(allowed)(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))

	req := httptest.NewRequest(method, "/api/v1/posts", nil)
	if origin != "" {
		req.Header.Set("Origin", origin)
	}
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)
	return rec.Code
}

func TestOriginGuard(t *testing.T) {
	allowed := []string{"http://localhost:3000"}

	unsafeMethods := []string{http.MethodPost, http.MethodPut, http.MethodPatch, http.MethodDelete}
	for _, method := range unsafeMethods {
		if code := runOriginGuard(t, allowed, method, "http://localhost:3000"); code != http.StatusOK {
			t.Errorf("%s with allowed origin = %d, want 200", method, code)
		}
		if code := runOriginGuard(t, allowed, method, "https://evil.example"); code != http.StatusForbidden {
			t.Errorf("%s with disallowed origin = %d, want 403", method, code)
		}
		if code := runOriginGuard(t, allowed, method, "null"); code != http.StatusForbidden {
			t.Errorf("%s with origin null = %d, want 403", method, code)
		}
		if code := runOriginGuard(t, allowed, method, ""); code != http.StatusOK {
			t.Errorf("%s without Origin (non-browser client) = %d, want 200", method, code)
		}
	}

	// 安全方法不受来源校验影响。
	for _, method := range []string{http.MethodGet, http.MethodHead, http.MethodOptions} {
		if code := runOriginGuard(t, allowed, method, "https://evil.example"); code != http.StatusOK {
			t.Errorf("%s = %d, want 200", method, code)
		}
	}
}
