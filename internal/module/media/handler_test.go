package media

import (
	"bytes"
	"context"
	"errors"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/bba70/blogs/internal/module/auth"
)

type failedStorage struct{}

func (failedStorage) Save(context.Context, []byte, string) (string, error) {
	return "", errors.New("private/storage/path failed")
}

func uploadRequest(t *testing.T, data []byte) *http.Request {
	t.Helper()
	var body bytes.Buffer
	writer := multipart.NewWriter(&body)
	file, err := writer.CreateFormFile("file", "cover.png")
	if err != nil {
		t.Fatal(err)
	}
	file.Write(data)
	writer.Close()
	req := httptest.NewRequest(http.MethodPost, "/", &body)
	req.Header.Set("Content-Type", writer.FormDataContentType())
	return req.WithContext(auth.ContextWithOwner(req.Context()))
}

func TestUploadHTTPRejectsOversizeAndHidesStorageErrors(t *testing.T) {
	storage, err := NewLocalStorage(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	router := NewHandler(NewService(storage), storage).Routes(auth.NewMiddleware(nil).RequireOwner)
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, uploadRequest(t, make([]byte, MaxImageSize+1)))
	if rec.Code != http.StatusRequestEntityTooLarge {
		t.Fatalf("oversized upload=%d", rec.Code)
	}
	router = NewHandler(NewService(failedStorage{}), storage).Routes(auth.NewMiddleware(nil).RequireOwner)
	rec = httptest.NewRecorder()
	router.ServeHTTP(rec, uploadRequest(t, pngData(t)))
	if rec.Code != 500 || strings.Contains(rec.Body.String(), "private/storage") {
		t.Fatalf("storage error leaked: %d %s", rec.Code, rec.Body.String())
	}
}
