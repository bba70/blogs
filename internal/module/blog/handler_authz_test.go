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
	return newAuthzEnvWithStore(t, seededStore())
}

// newAuthzEnvWithStore 允许指定种子数据，用于覆盖可见性矩阵。
func newAuthzEnvWithStore(t *testing.T, store *fakeStore) *authzEnv {
	t.Helper()

	hash, err := bcrypt.GenerateFromPassword([]byte(authzTestPassword), bcrypt.MinCost)
	if err != nil {
		t.Fatalf("generate hash: %v", err)
	}
	authSvc, err := auth.NewService(string(hash), authzTestSecret)
	if err != nil {
		t.Fatalf("auth.NewService: %v", err)
	}

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

type postEnvelope struct {
	Data struct {
		Slug   string `json:"slug"`
		Status string `json:"status"`
		Kind   string `json:"kind"`
	} `json:"data"`
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

// 访客只能浏览已发布文章，不能读取随笔、草稿或管理范围。
func TestListPostsAnonymousScopeBoundary(t *testing.T) {
	env := newAuthzEnvWithStore(t, seededContentStore())

	for _, target := range []string{
		"/api/v1/posts?kind=essay",
		"/api/v1/posts?kind=essay&status=published",
		"/api/v1/posts?kind=essay&tag=%E5%B8%83%E5%B1%80%E6%B5%8B%E8%AF%95",
		"/api/v1/posts?kind=essay&status=all",
		"/api/v1/posts?kind=essay&status=draft",
		"/api/v1/posts?kind=article&status=all",
	} {
		if rec := env.do(t, http.MethodGet, target, "", ""); rec.Code != http.StatusUnauthorized {
			t.Errorf("%s = %d, want 401", target, rec.Code)
		}
	}

	for _, kind := range []string{KindArticle} {
		rec := env.do(t, http.MethodGet, "/api/v1/posts?kind="+kind, "", "")
		if rec.Code != http.StatusOK {
			t.Fatalf("anonymous %s list = %d, body = %s", kind, rec.Code, rec.Body.String())
		}
		if slugs := slugsFromListBody(t, rec.Body.String()); len(slugs) != 1 || slugs[0] != "public-"+kind {
			t.Errorf("anonymous %s slugs = %v, want [public-%s]", kind, slugs, kind)
		}
	}
	if rec := env.do(t, http.MethodGet, "/api/v1/posts?kind=invalid", "", ""); rec.Code != http.StatusBadRequest {
		t.Errorf("invalid kind status = %d, want 400", rec.Code)
	}
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

// 随笔无论是否发布都仅作者可见，匿名详情统一返回 404。
func TestGetPostRouteContentStatusMatrix(t *testing.T) {
	env := newAuthzEnvWithStore(t, seededContentStore())

	cases := []struct {
		slug       string
		owner      bool
		wantStatus int
	}{
		{"public-article", false, http.StatusOK},
		{"draft-article", false, http.StatusNotFound},
		{"public-essay", false, http.StatusNotFound},
		{"draft-essay", false, http.StatusNotFound},
		{"draft-article", true, http.StatusOK},
		{"public-essay", true, http.StatusOK},
		{"draft-essay", true, http.StatusOK},
	}

	for _, tc := range cases {
		cookie := ""
		if tc.owner {
			cookie = env.ownerCookie(t)
		}
		rec := env.do(t, http.MethodGet, "/api/v1/posts/"+tc.slug, "", cookie)
		if rec.Code != tc.wantStatus {
			t.Errorf("owner=%v slug=%s status = %d, want %d", tc.owner, tc.slug, rec.Code, tc.wantStatus)
		}
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

func TestCreatePostKindAndPublicRead(t *testing.T) {
	env := newAuthzEnv(t)
	cookie := env.ownerCookie(t)

	t.Run("defaults to article and draft", func(t *testing.T) {
		rec := env.do(t, http.MethodPost, "/api/v1/posts",
			`{"title":"默认","slug":"defaults","content":"正文","status":"draft"}`, cookie)
		if rec.Code != http.StatusCreated {
			t.Fatalf("create = %d, body = %s", rec.Code, rec.Body.String())
		}
		var envelope postEnvelope
		if err := json.Unmarshal(rec.Body.Bytes(), &envelope); err != nil {
			t.Fatalf("decode: %v", err)
		}
		if envelope.Data.Kind != KindArticle || envelope.Data.Status != StatusDraft {
			t.Errorf("defaults kind=%q status=%q, want article/draft", envelope.Data.Kind, envelope.Data.Status)
		}
	})

	t.Run("published essay remains owner-only", func(t *testing.T) {
		rec := env.do(t, http.MethodPost, "/api/v1/posts",
			`{"title":"随笔","slug":"essay-1","content":"正文","status":"published","kind":"essay"}`, cookie)
		if rec.Code != http.StatusCreated {
			t.Fatalf("create = %d, body = %s", rec.Code, rec.Body.String())
		}
		var envelope postEnvelope
		if err := json.Unmarshal(rec.Body.Bytes(), &envelope); err != nil {
			t.Fatalf("decode: %v", err)
		}
		if envelope.Data.Kind != KindEssay || envelope.Data.Status != StatusPublished {
			t.Errorf("created kind=%q status=%q, want essay/published", envelope.Data.Kind, envelope.Data.Status)
		}
		if strings.Contains(rec.Body.String(), `"visibility"`) {
			t.Error("obsolete visibility field must not appear in the response")
		}
		rec = env.do(t, http.MethodGet, "/api/v1/posts/essay-1", "", "")
		if rec.Code != http.StatusNotFound {
			t.Fatalf("anonymous published essay read = %d, want 404", rec.Code)
		}
		rec = env.do(t, http.MethodGet, "/api/v1/posts/essay-1", "", cookie)
		if rec.Code != http.StatusOK {
			t.Fatalf("owner published essay read = %d, want 200", rec.Code)
		}
	})

	t.Run("rejects unknown enum values", func(t *testing.T) {
		for _, body := range []string{
			`{"title":"x","slug":"bad-kind","kind":"banana"}`,
			`{"title":"x","slug":"bad-status","status":"secret"}`,
		} {
			if rec := env.do(t, http.MethodPost, "/api/v1/posts", body, cookie); rec.Code != http.StatusBadRequest {
				t.Errorf("body=%s status = %d, want 400", body, rec.Code)
			}
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

func TestTagsKindFilterAuthorization(t *testing.T) {
	store := newFakeStore()
	store.tags = []Tag{{ID: 1, Name: "article-tag"}, {ID: 2, Name: "essay-draft-tag"}, {ID: 3, Name: "essay-tag"}}
	store.seedPost(Post{Slug: "article", Kind: KindArticle, Status: StatusPublished, Tags: []string{"article-tag"}})
	store.seedPost(Post{Slug: "essay-draft", Kind: KindEssay, Status: StatusDraft, Tags: []string{"essay-draft-tag"}})
	store.seedPost(Post{Slug: "essay", Kind: KindEssay, Status: StatusPublished, Tags: []string{"essay-tag"}})
	env := newAuthzEnvWithStore(t, store)

	rec := env.do(t, http.MethodGet, "/api/v1/tags?kind=essay", "", env.ownerCookie(t))
	if rec.Code != http.StatusOK {
		t.Fatalf("owner essay tags status = %d, body = %s", rec.Code, rec.Body.String())
	}
	if names := namesFromTagsBody(t, rec.Body.String()); len(names) != 2 || names[0] != "essay-draft-tag" || names[1] != "essay-tag" {
		t.Fatalf("owner essay tags = %v, want draft and published essay tags", names)
	}
	rec = env.do(t, http.MethodGet, "/api/v1/tags?kind=essay", "", "")
	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("anonymous essay tags status = %d, want 401", rec.Code)
	}
	if strings.Contains(rec.Body.String(), "essay-tag") || strings.Contains(rec.Body.String(), "essay-draft-tag") {
		t.Fatal("anonymous essay tag request leaked tags")
	}
	for _, tc := range []struct {
		target string
		status int
	}{
		{"/api/v1/tags?kind=invalid", http.StatusBadRequest},
	} {
		rec := env.do(t, http.MethodGet, tc.target, "", "")
		if rec.Code != tc.status {
			t.Errorf("%s status = %d, want %d", tc.target, rec.Code, tc.status)
		}
		if strings.Contains(rec.Body.String(), "essay-tag") {
			t.Errorf("%s unexpectedly returned tags for invalid kind", tc.target)
		}
	}
}
