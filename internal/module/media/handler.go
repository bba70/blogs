package media

import (
	"errors"
	"io"
	"log/slog"
	"net/http"
	"os"

	"github.com/bba70/blogs/internal/module/auth"
	"github.com/bba70/blogs/internal/pkg/response"
	"github.com/go-chi/chi/v5"
)

type Handler struct {
	service *Service
	reader  Reader
}

func NewHandler(service *Service, reader Reader) *Handler {
	return &Handler{service: service, reader: reader}
}

func (h *Handler) Routes(ownerOnly func(http.Handler) http.Handler) chi.Router {
	r := chi.NewRouter()
	r.With(ownerOnly).Post("/", h.Upload)
	r.Get("/{name}", h.Get)
	return r
}

func (h *Handler) Upload(w http.ResponseWriter, r *http.Request) {
	if !auth.IsOwner(r.Context()) {
		response.Error(w, 401, response.CodeUnauthorized, "authentication required")
		return
	}
	r.Body = http.MaxBytesReader(w, r.Body, MaxImageSize+(1<<20))
	defer r.Body.Close()
	multipart, err := r.MultipartReader()
	if err != nil {
		response.Error(w, 400, response.CodeValidation, "multipart image file is required")
		return
	}
	for {
		part, err := multipart.NextPart()
		if err != nil {
			h.uploadError(w, err)
			return
		}
		if part.FormName() != "file" || part.FileName() == "" {
			part.Close()
			continue
		}
		data, err := io.ReadAll(io.LimitReader(part, MaxImageSize+1))
		part.Close()
		if err != nil {
			h.uploadError(w, err)
			return
		}
		url, err := h.service.Upload(r.Context(), auth.IsOwner(r.Context()), data)
		if err != nil {
			h.uploadError(w, err)
			return
		}
		response.JSON(w, http.StatusCreated, struct {
			URL string `json:"url"`
		}{url})
		return
	}
}

func (h *Handler) uploadError(w http.ResponseWriter, err error) {
	var tooLarge *http.MaxBytesError
	switch {
	case errors.Is(err, ErrTooLarge), errors.As(err, &tooLarge):
		response.Error(w, 413, response.CodeValidation, "image exceeds 5 MB")
	case errors.Is(err, ErrUnauthorized):
		response.Error(w, 401, response.CodeUnauthorized, "authentication required")
	case errors.Is(err, ErrInvalidImage), errors.Is(err, io.EOF), errors.Is(err, io.ErrUnexpectedEOF):
		response.Error(w, 400, response.CodeValidation, "a valid JPEG, PNG or GIF image is required")
	default:
		slog.Error("image upload failed", "error", err)
		response.Error(w, 500, response.CodeInternal, "image upload failed")
	}
}

func (h *Handler) Get(w http.ResponseWriter, r *http.Request) {
	file, err := h.reader.Open(chi.URLParam(r, "name"))
	if err != nil {
		if errors.Is(err, os.ErrNotExist) {
			response.Error(w, 404, response.CodeNotFound, "image not found")
		} else {
			slog.Error("image read failed", "error", err)
			response.Error(w, 500, response.CodeInternal, "image unavailable")
		}
		return
	}
	defer file.Content.Close()
	w.Header().Set("X-Content-Type-Options", "nosniff")
	w.Header().Set("Cache-Control", "public, max-age=31536000, immutable")
	http.ServeContent(w, r, file.Name, file.Modified, file.Content)
}
