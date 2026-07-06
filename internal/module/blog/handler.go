package blog

import (
	"encoding/json"
	"errors"
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"

	"github.com/bba70/blogs/internal/pkg/response"
)

type Handler struct {
	svc *Service
}

func NewHandler(svc *Service) *Handler {
	return &Handler{svc: svc}
}

func (h *Handler) ListPosts(w http.ResponseWriter, r *http.Request) {
	page, _ := strconv.Atoi(r.URL.Query().Get("page"))
	perPage, _ := strconv.Atoi(r.URL.Query().Get("per_page"))
	status := r.URL.Query().Get("status")
	tag := r.URL.Query().Get("tag")

	posts, total, err := h.svc.ListPosts(r.Context(), ListPostsReq{
		Page:    page,
		PerPage: perPage,
		Status:  status,
		Tag:     tag,
	})
	if err != nil {
		response.Error(w, http.StatusInternalServerError, 1, err.Error())
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

	post, err := h.svc.GetPost(r.Context(), slug)
	if errors.Is(err, ErrPostNotFound) {
		response.Error(w, http.StatusNotFound, 2, "post not found")
		return
	}
	if err != nil {
		response.Error(w, http.StatusInternalServerError, 1, err.Error())
		return
	}

	response.JSON(w, http.StatusOK, post)
}

func (h *Handler) CreatePost(w http.ResponseWriter, r *http.Request) {
	var req CreatePostReq
	if err := decodeJSON(r, &req); err != nil {
		response.Error(w, http.StatusBadRequest, 3, err.Error())
		return
	}

	if req.Title == "" || req.Slug == "" {
		response.Error(w, http.StatusBadRequest, 3, "title and slug are required")
		return
	}

	post, err := h.svc.CreatePost(r.Context(), req)
	if err != nil {
		response.Error(w, http.StatusInternalServerError, 1, err.Error())
		return
	}

	response.JSON(w, http.StatusCreated, post)
}

func (h *Handler) UpdatePost(w http.ResponseWriter, r *http.Request) {
	slug := chi.URLParam(r, "slug")

	var req UpdatePostReq
	if err := decodeJSON(r, &req); err != nil {
		response.Error(w, http.StatusBadRequest, 3, err.Error())
		return
	}

	post, err := h.svc.UpdatePost(r.Context(), slug, req)
	if errors.Is(err, ErrPostNotFound) {
		response.Error(w, http.StatusNotFound, 2, "post not found")
		return
	}
	if err != nil {
		response.Error(w, http.StatusInternalServerError, 1, err.Error())
		return
	}

	response.JSON(w, http.StatusOK, post)
}

func (h *Handler) DeletePost(w http.ResponseWriter, r *http.Request) {
	slug := chi.URLParam(r, "slug")

	if err := h.svc.DeletePost(r.Context(), slug); err != nil {
		response.Error(w, http.StatusNotFound, 2, "post not found")
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

func (h *Handler) ListTags(w http.ResponseWriter, r *http.Request) {
	tags, err := h.svc.ListTags(r.Context())
	if err != nil {
		response.Error(w, http.StatusInternalServerError, 1, err.Error())
		return
	}
	if tags == nil {
		tags = []Tag{}
	}
	response.JSON(w, http.StatusOK, tags)
}

func decodeJSON(r *http.Request, v interface{}) error {
	defer r.Body.Close()
	return json.NewDecoder(r.Body).Decode(v)
}
