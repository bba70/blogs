package profile

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/go-chi/chi/v5"

	"github.com/bba70/blogs/internal/module/auth"
)

const (
	firstAvatar  = "/api/v1/media/0123456789abcdef0123456789abcdef.png"
	secondAvatar = "/api/v1/media/fedcba9876543210fedcba9876543210.jpg"
)

type fakeStore struct {
	profile   Profile
	updateErr error
}

func (f *fakeStore) Get(context.Context) (*Profile, error) {
	current := f.profile
	return &current, nil
}

func (f *fakeStore) UpdateAvatarURL(_ context.Context, avatarURL string) (*Profile, error) {
	if f.updateErr != nil {
		return nil, f.updateErr
	}
	f.profile = Profile{AvatarURL: avatarURL, UpdatedAt: time.Now()}
	current := f.profile
	return &current, nil
}

type fakeFiles struct {
	deleted []string
	failErr error
}

func (f *fakeFiles) ValidURL(value string) bool {
	return strings.HasPrefix(value, "/api/v1/media/") && !strings.Contains(value, "..")
}

func (f *fakeFiles) DeleteURL(_ context.Context, value string) error {
	if f.failErr != nil {
		return f.failErr
	}
	f.deleted = append(f.deleted, value)
	return nil
}

func testRouter(store Store, files AvatarFiles) http.Handler {
	return NewHandler(NewService(store, files)).Routes(auth.NewMiddleware(nil).RequireOwner)
}

func avatarRequest(t *testing.T, method, avatarURL string, owner bool) *http.Request {
	t.Helper()
	body, err := json.Marshal(UpdateReq{AvatarURL: avatarURL})
	if err != nil {
		t.Fatal(err)
	}
	req := httptest.NewRequest(method, "/", strings.NewReader(string(body)))
	if owner {
		req = req.WithContext(auth.ContextWithOwner(req.Context()))
	}
	return req
}

func decodeProfile(t *testing.T, rec *httptest.ResponseRecorder) Profile {
	t.Helper()
	var result struct {
		Data Profile `json:"data"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &result); err != nil {
		t.Fatal(err)
	}
	return result.Data
}

func TestGetProfileIsPublic(t *testing.T) {
	router := testRouter(&fakeStore{}, &fakeFiles{})
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/", nil))
	if rec.Code != http.StatusOK {
		t.Fatalf("read status=%d", rec.Code)
	}
	if body := decodeProfile(t, rec); body.AvatarURL != "" {
		t.Fatalf("unset avatar=%q", body.AvatarURL)
	}
}

// 作者资料挂载在 /api/v1/profile 下，前端调用不带尾斜杠的地址，两种形式都要可达。
func TestRoutesMountAtAPIPath(t *testing.T) {
	router := chi.NewRouter()
	router.Mount("/api/v1/profile", testRouter(&fakeStore{profile: Profile{AvatarURL: firstAvatar}}, &fakeFiles{}))

	for _, path := range []string{"/api/v1/profile", "/api/v1/profile/"} {
		rec := httptest.NewRecorder()
		router.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, path, nil))
		if rec.Code != http.StatusOK {
			t.Fatalf("GET %s status=%d", path, rec.Code)
		}
		if body := decodeProfile(t, rec); body.AvatarURL != firstAvatar {
			t.Fatalf("GET %s avatar=%q", path, body.AvatarURL)
		}
	}
}

func TestUpdateAvatarRequiresOwner(t *testing.T) {
	router := testRouter(&fakeStore{}, &fakeFiles{})
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, avatarRequest(t, http.MethodPut, firstAvatar, false))
	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("anonymous update=%d", rec.Code)
	}
}

func TestUpdateAvatarRejectsForeignURL(t *testing.T) {
	store := &fakeStore{}
	files := &fakeFiles{}
	router := testRouter(store, files)

	for _, value := range []string{"https://example.com/avatar.png", "/uploads/avatar.png", "/api/v1/media/../secret.png"} {
		rec := httptest.NewRecorder()
		router.ServeHTTP(rec, avatarRequest(t, http.MethodPut, value, true))
		if rec.Code != http.StatusBadRequest {
			t.Fatalf("accepted %q with status %d", value, rec.Code)
		}
	}
	if store.profile.AvatarURL != "" {
		t.Fatalf("rejected url was stored: %q", store.profile.AvatarURL)
	}
	if len(files.deleted) != 0 {
		t.Fatalf("rejected update deleted files: %v", files.deleted)
	}
}

func TestUpdateAvatarReplacesAndCleansUpPreviousFile(t *testing.T) {
	store := &fakeStore{profile: Profile{AvatarURL: firstAvatar}}
	files := &fakeFiles{}
	router := testRouter(store, files)

	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, avatarRequest(t, http.MethodPut, secondAvatar, true))
	if rec.Code != http.StatusOK {
		t.Fatalf("update status=%d body=%s", rec.Code, rec.Body.String())
	}
	if body := decodeProfile(t, rec); body.AvatarURL != secondAvatar {
		t.Fatalf("stored avatar=%q", body.AvatarURL)
	}
	if len(files.deleted) != 1 || files.deleted[0] != firstAvatar {
		t.Fatalf("deleted=%v", files.deleted)
	}
}

func TestRemoveAvatarKeepsResultWhenCleanupFails(t *testing.T) {
	store := &fakeStore{profile: Profile{AvatarURL: firstAvatar}}
	files := &fakeFiles{failErr: errors.New("remove failed")}
	router := testRouter(store, files)

	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, avatarRequest(t, http.MethodPut, "", true))
	if rec.Code != http.StatusOK {
		t.Fatalf("clear avatar status=%d body=%s", rec.Code, rec.Body.String())
	}
	if body := decodeProfile(t, rec); body.AvatarURL != "" {
		t.Fatalf("avatar not cleared: %q", body.AvatarURL)
	}
}

func TestUpdateAvatarHidesStoreErrors(t *testing.T) {
	router := testRouter(&fakeStore{updateErr: errors.New("db down")}, &fakeFiles{})
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, avatarRequest(t, http.MethodPut, firstAvatar, true))
	if rec.Code != http.StatusInternalServerError {
		t.Fatalf("status=%d", rec.Code)
	}
	if strings.Contains(rec.Body.String(), "db down") {
		t.Fatalf("internal error leaked: %s", rec.Body.String())
	}
}
