package blog

import (
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/go-chi/chi/v5"
	"golang.org/x/crypto/bcrypt"

	"github.com/bba70/blogs/internal/module/auth"
)

const authzTestPassword = "test-password"

var authzTestSecret = strings.Repeat("k", auth.MinSecretLen)

type authzEnv struct {
	router chi.Router
	svc    *auth.Service
	store  *fakeStore
}

// newAuthzEnv 构造与生产一致的路由结构：Identity 解析可选身份，
// 写路由挂 RequireOwner，读路由由 service 依据身份决定可见范围。
func newAuthzEnv(t *testing.T) *authzEnv {
	t.Helper()

	hash, err := bcrypt.GenerateFromPassword([]byte(authzTestPassword), bcrypt.MinCost)
	if err != nil {
		t.Fatalf("generate hash: %v", err)
	}
	authSvc, err := auth.NewService(string(hash), authzTestSecret)
	if err != nil {
		t.Fatalf("auth.NewService: %v", err)
	}

	store := seededStore()
	mw := auth.NewMiddleware(authSvc)

	r := chi.NewRouter()
	r.Route("/api/v1", func(r chi.Router) {
		r.Use(mw.Identity)
		RegisterRoutes(r, NewHandler(NewService(store)), mw.RequireOwner)
	})

	return &authzEnv{router: r, svc: authSvc, store: store}
}

func (e *authzEnv) ownerCookie(t *testing.T) string {
	t.Helper()
	token, err := e.svc.IssueToken()
	if err != nil {
		t.Fatalf("IssueToken: %v", err)
	}
	return auth.CookieName + "=" + token
}

func (e *authzEnv) do(t *testing.T, method, target, body, cookie string) *httptest.ResponseRecorder {
	t.Helper()
	var reader io.Reader
	if body != "" {
		reader = strings.NewReader(body)
	}
	req := httptest.NewRequest(method, target, reader)
	req.RemoteAddr = "203.0.113.1:40000"
	if body != "" {
		req.Header.Set("Content-Type", "application/json")
	}
	if cookie != "" {
		req.Header.Set("Cookie", cookie)
	}
	rec := httptest.NewRecorder()
	e.router.ServeHTTP(rec, req)
	return rec
}

func slugsFromListBody(t *testing.T, body string) []string {
	t.Helper()
	var envelope struct {
		Data []struct {
			Slug string `json:"slug"`
		} `json:"data"`
	}
	if err := json.Unmarshal([]byte(body), &envelope); err != nil {
		t.Fatalf("decode list body %q: %v", body, err)
	}
	var slugs []string
	for _, p := range envelope.Data {
		slugs = append(slugs, p.Slug)
	}
	return slugs
}

func namesFromTagsBody(t *testing.T, body string) []string {
	t.Helper()
	var envelope struct {
		Data []struct {
			Name string `json:"name"`
		} `json:"data"`
	}
	if err := json.Unmarshal([]byte(body), &envelope); err != nil {
		t.Fatalf("decode tags body %q: %v", body, err)
	}
	var names []string
	for _, tag := range envelope.Data {
		names = append(names, tag.Name)
	}
	return names
}

func TestListPostsAuthorization(t *testing.T) {
	env := newAuthzEnv(t)

	t.Run("anonymous default returns only published", func(t *testing.T) {
		rec := env.do(t, http.MethodGet, "/api/v1/posts", "", "")
		if rec.Code != http.StatusOK {
			t.Fatalf("status = %d", rec.Code)
		}
		slugs := slugsFromListBody(t, rec.Body.String())
		if len(slugs) != 1 || slugs[0] != "hello" {
			t.Errorf("slugs = %v, want [hello]", slugs)
		}
	})

	t.Run("anonymous admin status returns 401", func(t *testing.T) {
		for _, status := range []string{"all", "draft"} {
			rec := env.do(t, http.MethodGet, "/api/v1/posts?status="+status, "", "")
			if rec.Code != http.StatusUnauthorized {
				t.Errorf("status=%s: %d, want 401", status, rec.Code)
			}
		}
	})

	t.Run("anonymous explicit published is allowed", func(t *testing.T) {
		rec := env.do(t, http.MethodGet, "/api/v1/posts?status=published", "", "")
		if rec.Code != http.StatusOK {
			t.Errorf("status=published: %d, want 200", rec.Code)
		}
	})

	t.Run("owner can list all and drafts", func(t *testing.T) {
		cookie := env.ownerCookie(t)

		rec := env.do(t, http.MethodGet, "/api/v1/posts?status=all", "", cookie)
		if rec.Code != http.StatusOK {
			t.Fatalf("owner status=all: %d", rec.Code)
		}
		if slugs := slugsFromListBody(t, rec.Body.String()); len(slugs) != 2 {
			t.Errorf("owner status=all slugs = %v, want 2 entries", slugs)
		}

		rec = env.do(t, http.MethodGet, "/api/v1/posts?status=draft", "", cookie)
		if rec.Code != http.StatusOK {
			t.Fatalf("owner status=draft: %d", rec.Code)
		}
		if slugs := slugsFromListBody(t, rec.Body.String()); len(slugs) != 1 || slugs[0] != "secret-draft" {
			t.Errorf("owner status=draft slugs = %v", slugs)
		}
	})
}

func TestGetPostAuthorization(t *testing.T) {
	env := newAuthzEnv(t)

	cases := []struct {
		name       string
		slug       string
		owner      bool
		wantStatus int
	}{
		{"anonymous reads published", "hello", false, http.StatusOK},
		{"owner reads published", "hello", true, http.StatusOK},
		{"anonymous draft read hides existence", "secret-draft", false, http.StatusNotFound},
		{"owner reads draft", "secret-draft", true, http.StatusOK},
		{"anonymous missing slug", "missing", false, http.StatusNotFound},
		{"owner missing slug", "missing", true, http.StatusNotFound},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			cookie := ""
			if tc.owner {
				cookie = env.ownerCookie(t)
			}
			rec := env.do(t, http.MethodGet, "/api/v1/posts/"+tc.slug, "", cookie)
			if rec.Code != tc.wantStatus {
				t.Errorf("status = %d, body = %s, want %d", rec.Code, rec.Body.String(), tc.wantStatus)
			}
		})
	}
}

func TestWriteRoutesRequireOwner(t *testing.T) {
	env := newAuthzEnv(t)

	const createBody = `{"title":"新文章","slug":"new-post","content":"正文","status":"draft"}`

	t.Run("anonymous writes return 401", func(t *testing.T) {
		if rec := env.do(t, http.MethodPost, "/api/v1/posts", createBody, ""); rec.Code != http.StatusUnauthorized {
			t.Errorf("create = %d, want 401", rec.Code)
		}
		if rec := env.do(t, http.MethodPut, "/api/v1/posts/hello", `{"title":"改"}`, ""); rec.Code != http.StatusUnauthorized {
			t.Errorf("update = %d, want 401", rec.Code)
		}
		if rec := env.do(t, http.MethodDelete, "/api/v1/posts/hello", "", ""); rec.Code != http.StatusUnauthorized {
			t.Errorf("delete = %d, want 401", rec.Code)
		}
	})

	t.Run("owner writes succeed", func(t *testing.T) {
		cookie := env.ownerCookie(t)

		rec := env.do(t, http.MethodPost, "/api/v1/posts", createBody, cookie)
		if rec.Code != http.StatusCreated {
			t.Fatalf("create = %d, body = %s", rec.Code, rec.Body.String())
		}

		rec = env.do(t, http.MethodPut, "/api/v1/posts/new-post", `{"title":"改标题"}`, cookie)
		if rec.Code != http.StatusOK {
			t.Fatalf("update = %d, body = %s", rec.Code, rec.Body.String())
		}

		rec = env.do(t, http.MethodDelete, "/api/v1/posts/new-post", "", cookie)
		if rec.Code != http.StatusNoContent {
			t.Fatalf("delete = %d", rec.Code)
		}
	})
}

func TestTagsVisibility(t *testing.T) {
	env := newAuthzEnv(t)

	rec := env.do(t, http.MethodGet, "/api/v1/tags", "", "")
	if rec.Code != http.StatusOK {
		t.Fatalf("anonymous tags status = %d", rec.Code)
	}
	if names := namesFromTagsBody(t, rec.Body.String()); len(names) != 1 || names[0] != "public-tag" {
		t.Errorf("anonymous tags = %v, want [public-tag]", names)
	}

	rec = env.do(t, http.MethodGet, "/api/v1/tags", "", env.ownerCookie(t))
	if rec.Code != http.StatusOK {
		t.Fatalf("owner tags status = %d", rec.Code)
	}
	if names := namesFromTagsBody(t, rec.Body.String()); len(names) != 2 {
		t.Errorf("owner tags = %v, want all tags", names)
	}
}
