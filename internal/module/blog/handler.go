package blog

import (
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"

	"github.com/bba70/blogs/internal/module/auth"
	"github.com/bba70/blogs/internal/pkg/response"
)

// maxBodySize 限制单个请求体大小（2MB），防止超大载荷。
// 正文以 Markdown 为主；封面图片通过独立媒体上传接口传输。
const maxBodySize = 2 << 20

type Handler struct {
	svc *Service
}

func NewHandler(svc *Service) *Handler {
	return &Handler{svc: svc}
}

// viewerFrom 将认证上下文中的身份映射为 service 层的访问能力。
func viewerFrom(r *http.Request) Viewer {
	return Viewer{IsOwner: auth.IsOwner(r.Context())}
}

func (h *Handler) ListPosts(w http.ResponseWriter, r *http.Request) {
	page, _ := strconv.Atoi(r.URL.Query().Get("page"))
	perPage, _ := strconv.Atoi(r.URL.Query().Get("per_page"))
	status := r.URL.Query().Get("status")
	tag := r.URL.Query().Get("tag")

	posts, total, err := h.svc.ListPosts(r.Context(), viewerFrom(r), ListPostsReq{
		Page:    page,
		PerPage: perPage,
		Status:  status,
		Tag:     tag,
	})
	if errors.Is(err, ErrUnauthorized) {
		response.Error(w, http.StatusUnauthorized, response.CodeUnauthorized, "authentication required")
		return
	}
	if err != nil {
		h.internalError(w, r, err)
		return
	}
	if posts == nil {
		posts = []Post{}
	}

	response.JSONWithMeta(w, http.StatusOK, posts, response.Meta{
		Page:    page,
		PerPage: perPage,
		Total:   total,
	})
}

func (h *Handler) GetPost(w http.ResponseWriter, r *http.Request) {
	slug := chi.URLParam(r, "slug")

	post, err := h.svc.GetPost(r.Context(), viewerFrom(r), slug)
	if errors.Is(err, ErrPostNotFound) {
		response.Error(w, http.StatusNotFound, response.CodeNotFound, "post not found")
		return
	}
	if err != nil {
		h.internalError(w, r, err)
		return
	}

	response.JSON(w, http.StatusOK, post)
}

func (h *Handler) CreatePost(w http.ResponseWriter, r *http.Request) {
	var req CreatePostReq
	if err := decodeJSON(w, r, &req); err != nil {
		response.Error(w, http.StatusBadRequest, response.CodeValidation, err.Error())
		return
	}

	post, err := h.svc.CreatePost(r.Context(), viewerFrom(r), req)
	if err != nil {
		h.writeServiceError(w, r, err)
		return
	}

	response.JSON(w, http.StatusCreated, post)
}

func (h *Handler) UpdatePost(w http.ResponseWriter, r *http.Request) {
	slug := chi.URLParam(r, "slug")

	var req UpdatePostReq
	if err := decodeJSON(w, r, &req); err != nil {
		response.Error(w, http.StatusBadRequest, response.CodeValidation, err.Error())
		return
	}

	post, err := h.svc.UpdatePost(r.Context(), viewerFrom(r), slug, req)
	if err != nil {
		h.writeServiceError(w, r, err)
		return
	}

	response.JSON(w, http.StatusOK, post)
}

func (h *Handler) DeletePost(w http.ResponseWriter, r *http.Request) {
	slug := chi.URLParam(r, "slug")

	if err := h.svc.DeletePost(r.Context(), viewerFrom(r), slug); err != nil {
		h.writeServiceError(w, r, err)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

func (h *Handler) ListTags(w http.ResponseWriter, r *http.Request) {
	tags, err := h.svc.ListTags(r.Context(), viewerFrom(r))
	if err != nil {
		h.internalError(w, r, err)
		return
	}
	if tags == nil {
		tags = []Tag{}
	}
	response.JSON(w, http.StatusOK, tags)
}

// writeServiceError 将 service 层的类型化错误映射为对应 HTTP 状态码。
func (h *Handler) writeServiceError(w http.ResponseWriter, r *http.Request, err error) {
	var ve *ValidationError
	switch {
	case errors.As(err, &ve):
		response.Error(w, http.StatusBadRequest, response.CodeValidation, ve.Message)
	case errors.Is(err, ErrUnauthorized):
		response.Error(w, http.StatusUnauthorized, response.CodeUnauthorized, "authentication required")
	case errors.Is(err, ErrPostNotFound):
		response.Error(w, http.StatusNotFound, response.CodeNotFound, "post not found")
	case errors.Is(err, ErrSlugExists):
		response.Error(w, http.StatusConflict, response.CodeConflict, "slug already exists")
	default:
		h.internalError(w, r, err)
	}
}

// internalError 记录真实错误到日志，但不向客户端暴露内部细节。
func (h *Handler) internalError(w http.ResponseWriter, r *http.Request, err error) {
	slog.Error("request failed",
		"method", r.Method,
		"path", r.URL.Path,
		"error", err,
	)
	response.Error(w, http.StatusInternalServerError, response.CodeInternal, "internal server error")
}

func decodeJSON(w http.ResponseWriter, r *http.Request, v any) error {
	defer r.Body.Close()
	r.Body = http.MaxBytesReader(w, r.Body, maxBodySize)
	return json.NewDecoder(r.Body).Decode(v)
}
