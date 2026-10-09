package media

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"image"
	"image/png"
	"io"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"

	"github.com/bba70/blogs/internal/module/auth"
)

func pngData(t *testing.T) []byte {
	t.Helper()
	var data bytes.Buffer
	if err := png.Encode(&data, image.NewRGBA(image.Rect(0, 0, 2, 2))); err != nil {
		t.Fatal(err)
	}
	return data.Bytes()
}

func TestUploadAndRead(t *testing.T) {
	directory := t.TempDir()
	storage, err := NewLocalStorage(directory)
	if err != nil {
		t.Fatal(err)
	}
	handler := NewHandler(NewService(storage), storage)
	router := handler.Routes(auth.NewMiddleware(nil).RequireOwner)
	var body bytes.Buffer
	writer := multipart.NewWriter(&body)
	part, _ := writer.CreateFormFile("file", "../../spoofed.exe")
	data := pngData(t)
	part.Write(data)
	writer.Close()
	req := httptest.NewRequest(http.MethodPost, "/", &body)
	req.Header.Set("Content-Type", writer.FormDataContentType())
	req = req.WithContext(auth.ContextWithOwner(req.Context()))
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)
	if rec.Code != 201 {
		t.Fatalf("upload status=%d body=%s", rec.Code, rec.Body.String())
	}
	var result struct {
		Data struct {
			URL string `json:"url"`
		} `json:"data"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &result); err != nil {
		t.Fatal(err)
	}
	name := strings.TrimPrefix(result.Data.URL, "/api/v1/media/")
	if !imageName.MatchString(name) || !strings.HasSuffix(name, ".png") {
		t.Fatalf("unsafe name %s", name)
	}
	rec = httptest.NewRecorder()
	router.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/"+name, nil))
	if rec.Code != 200 || !bytes.Equal(rec.Body.Bytes(), data) || rec.Header().Get("Content-Type") != "image/png" || rec.Header().Get("X-Content-Type-Options") != "nosniff" {
		t.Fatalf("read response=%d headers=%v", rec.Code, rec.Header())
	}
	entries, _ := os.ReadDir(directory)
	if len(entries) != 1 {
		t.Fatalf("stored %d files", len(entries))
	}
}

func TestUploadValidationAndAuthorization(t *testing.T) {
	storage, err := NewLocalStorage(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	svc := NewService(storage)
	if _, err := svc.Upload(context.Background(), false, pngData(t)); !errors.Is(err, ErrUnauthorized) {
		t.Fatal(err)
	}
	for _, data := range [][]byte{nil, []byte("<svg></svg>"), pngData(t)[:24]} {
		if _, err := svc.Upload(context.Background(), true, data); !errors.Is(err, ErrInvalidImage) {
			t.Fatalf("invalid image accepted: %v", err)
		}
	}
	if _, err := svc.Upload(context.Background(), true, make([]byte, MaxImageSize+1)); !errors.Is(err, ErrTooLarge) {
		t.Fatal(err)
	}
	router := NewHandler(svc, storage).Routes(auth.NewMiddleware(nil).RequireOwner)
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, httptest.NewRequest(http.MethodPost, "/", nil))
	if rec.Code != 401 {
		t.Fatalf("anonymous upload=%d", rec.Code)
	}
	for _, name := range []string{"../.env", "anything.svg", "", "0123456789abcdef0123456789abcdef.png"} {
		if file, err := storage.Open(name); !errors.Is(err, os.ErrNotExist) {
			if file != nil {
				file.Content.Close()
			}
			t.Fatalf("read %q: %v", name, err)
		}
	}
	entries, _ := os.ReadDir(storage.directory)
	if len(entries) != 0 {
		t.Fatal("rejected upload left files")
	}
}

func TestSaveHonorsCancellation(t *testing.T) {
	storage, err := NewLocalStorage(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	if _, err := storage.Save(ctx, []byte("data"), ".png"); !errors.Is(err, context.Canceled) {
		t.Fatal(err)
	}
	if _, err := storage.Save(context.Background(), []byte("data"), "/../bad"); !errors.Is(err, ErrInvalidImage) {
		t.Fatal(err)
	}
	entries, _ := os.ReadDir(storage.directory)
	if len(entries) != 0 {
		t.Fatal("cancelled save left files")
	}
}

func TestReadAfterReopeningStorage(t *testing.T) {
	directory := t.TempDir()
	storage, err := NewLocalStorage(directory)
	if err != nil {
		t.Fatal(err)
	}
	data := pngData(t)
	url, err := NewService(storage).Upload(context.Background(), true, data)
	if err != nil {
		t.Fatal(err)
	}
	reopened, err := NewLocalStorage(directory)
	if err != nil {
		t.Fatal(err)
	}
	file, err := reopened.Open(strings.TrimPrefix(url, "/api/v1/media/"))
	if err != nil {
		t.Fatal(err)
	}
	defer file.Content.Close()
	actual, err := io.ReadAll(file.Content)
	if err != nil || !bytes.Equal(actual, data) {
		t.Fatal("stored image was not preserved")
	}
}
