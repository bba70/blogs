package auth

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/go-chi/chi/v5"
)

const handlerTestPassword = "test-password"

type authEnv struct {
	router chi.Router
	svc    *Service
}

func newAuthEnv(t *testing.T) *authEnv {
	t.Helper()

	svc := newTestService(t, handlerTestPassword, testSecret)
	h := NewHandler(svc, NewLoginLimiter(), false)
	mw := NewMiddleware(svc)

	r := chi.NewRouter()
	r.Use(mw.Identity)
	r.Mount("/auth", h.Routes())
	r.With(mw.RequireOwner).Get("/protected", func(w http.ResponseWriter, _ *http.Request) {
		w.Write([]byte("owner-area"))
	})

	return &authEnv{router: r, svc: svc}
}

func doJSON(t *testing.T, env *authEnv, method, target, body, cookie string) *httptest.ResponseRecorder {
	t.Helper()
	var req *http.Request
	if body != "" {
		req = httptest.NewRequest(method, target, strings.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
	} else {
		req = httptest.NewRequest(method, target, nil)
	}
	req.RemoteAddr = "203.0.113.1:40000"
	if cookie != "" {
		req.Header.Set("Cookie", cookie)
	}
	rec := httptest.NewRecorder()
	env.router.ServeHTTP(rec, req)
	return rec
}

func sessionCookieFrom(t *testing.T, rec *httptest.ResponseRecorder) string {
	t.Helper()
	for _, c := range rec.Result().Cookies() {
		if c.Name == CookieName {
			return CookieName + "=" + c.Value
		}
	}
	t.Fatalf("response has no %s cookie", CookieName)
	return ""
}

func decodeAuthStatus(t *testing.T, rec *httptest.ResponseRecorder) bool {
	t.Helper()
	var envelope struct {
		Code int `json:"code"`
		Data struct {
			Authenticated bool `json:"authenticated"`
		} `json:"data"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &envelope); err != nil {
		t.Fatalf("decode body %q: %v", rec.Body.String(), err)
	}
	return envelope.Data.Authenticated
}

func TestLoginSuccessSetsSessionCookie(t *testing.T) {
	env := newAuthEnv(t)

	rec := doJSON(t, env, http.MethodPost, "/auth/login",
		`{"password":"`+handlerTestPassword+`"}`, "")
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, body = %s", rec.Code, rec.Body.String())
	}
	if !decodeAuthStatus(t, rec) {
		t.Error("login response must report authenticated=true")
	}
	if got := rec.Header().Get("Cache-Control"); got != "no-store" {
		t.Errorf("Cache-Control = %q, want no-store", got)
	}

	cookie := sessionCookieFrom(t, rec)
	token := strings.TrimPrefix(cookie, CookieName+"=")
	if err := env.svc.ValidateToken(token); err != nil {
		t.Errorf("cookie token must be valid: %v", err)
	}
}

func TestLoginWrongPassword(t *testing.T) {
	env := newAuthEnv(t)

	rec := doJSON(t, env, http.MethodPost, "/auth/login", `{"password":"wrong"}`, "")
	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("status = %d, want 401", rec.Code)
	}
	for _, c := range rec.Result().Cookies() {
		if c.Name == CookieName && c.Value != "" {
			t.Error("failed login must not set a session cookie")
		}
	}
}

func TestLoginInvalidBody(t *testing.T) {
	env := newAuthEnv(t)

	rec := doJSON(t, env, http.MethodPost, "/auth/login", `not-json`, "")
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, want 400", rec.Code)
	}
}

func TestMeAndProtectedRoutes(t *testing.T) {
	env := newAuthEnv(t)

	t.Run("anonymous", func(t *testing.T) {
		rec := doJSON(t, env, http.MethodGet, "/auth/me", "", "")
		if rec.Code != http.StatusOK || decodeAuthStatus(t, rec) {
			t.Errorf("anonymous /me = %d authenticated=%v, want 200 false", rec.Code, decodeAuthStatus(t, rec))
		}

		rec = doJSON(t, env, http.MethodGet, "/protected", "", "")
		if rec.Code != http.StatusUnauthorized {
			t.Errorf("anonymous /protected = %d, want 401", rec.Code)
		}
	})

	t.Run("owner", func(t *testing.T) {
		login := doJSON(t, env, http.MethodPost, "/auth/login",
			`{"password":"`+handlerTestPassword+`"}`, "")
		cookie := sessionCookieFrom(t, login)

		rec := doJSON(t, env, http.MethodGet, "/auth/me", "", cookie)
		if rec.Code != http.StatusOK || !decodeAuthStatus(t, rec) {
			t.Error("owner /me must report authenticated=true")
		}

		rec = doJSON(t, env, http.MethodGet, "/protected", "", cookie)
		if rec.Code != http.StatusOK || rec.Body.String() != "owner-area" {
			t.Errorf("owner /protected = %d %q", rec.Code, rec.Body.String())
		}
	})

	t.Run("tampered cookie", func(t *testing.T) {
		rec := doJSON(t, env, http.MethodGet, "/auth/me", "", CookieName+"=tampered.token.value")
		if decodeAuthStatus(t, rec) {
			t.Error("tampered cookie must not authenticate")
		}
		rec = doJSON(t, env, http.MethodGet, "/protected", "", CookieName+"=tampered.token.value")
		if rec.Code != http.StatusUnauthorized {
			t.Errorf("tampered cookie /protected = %d, want 401", rec.Code)
		}
	})
}

func TestLogoutClearsCookie(t *testing.T) {
	env := newAuthEnv(t)

	login := doJSON(t, env, http.MethodPost, "/auth/login",
		`{"password":"`+handlerTestPassword+`"}`, "")
	cookie := sessionCookieFrom(t, login)

	rec := doJSON(t, env, http.MethodPost, "/auth/logout", "", cookie)
	if rec.Code != http.StatusOK {
		t.Fatalf("logout status = %d", rec.Code)
	}

	var cleared bool
	for _, c := range rec.Result().Cookies() {
		if c.Name == CookieName && c.MaxAge < 0 {
			cleared = true
		}
	}
	if !cleared {
		t.Error("logout must write an expired cookie with the same name")
	}

	// 退出幂等：匿名调用同样成功。
	rec = doJSON(t, env, http.MethodPost, "/auth/logout", "", "")
	if rec.Code != http.StatusOK {
		t.Errorf("anonymous logout status = %d, want 200", rec.Code)
	}
}

func TestLoginRateLimit(t *testing.T) {
	env := newAuthEnv(t)

	for i := 1; i <= LimiterMaxFailures; i++ {
		rec := doJSON(t, env, http.MethodPost, "/auth/login", `{"password":"wrong"}`, "")
		if rec.Code != http.StatusUnauthorized {
			t.Fatalf("attempt %d status = %d, want 401", i, rec.Code)
		}
	}

	// 第 6 次起返回 429，即使密码正确。
	rec := doJSON(t, env, http.MethodPost, "/auth/login", `{"password":"wrong"}`, "")
	if rec.Code != http.StatusTooManyRequests {
		t.Fatalf("6th attempt status = %d, want 429", rec.Code)
	}
	rec = doJSON(t, env, http.MethodPost, "/auth/login",
		`{"password":"`+handlerTestPassword+`"}`, "")
	if rec.Code != http.StatusTooManyRequests {
		t.Fatalf("correct password while rate limited = %d, want 429", rec.Code)
	}
}
