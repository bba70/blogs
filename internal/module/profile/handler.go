package profile

import (
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"

	"github.com/go-chi/chi/v5"

	"github.com/bba70/blogs/internal/module/auth"
	"github.com/bba70/blogs/internal/pkg/response"
)

// maxBodySize 限制资料请求体大小：该接口只接收一个头像地址。
const maxBodySize = 4 << 10

type Handler struct {
	svc *Service
}

func NewHandler(svc *Service) *Handler {
	return &Handler{svc: svc}
}

// Routes 挂载作者资料路由。读取对访客开放（头像要展示给所有读者），
// 修改通过 ownerOnly 强制作者身份。
func (h *Handler) Routes(ownerOnly func(http.Handler) http.Handler) chi.Router {
	r := chi.NewRouter()
	r.Get("/", h.Get)
	r.With(ownerOnly).Put("/", h.Update)
	return r
}

func (h *Handler) Get(w http.ResponseWriter, r *http.Request) {
	p, err := h.svc.Get(r.Context())
	if err != nil {
		h.internalError(w, r, err)
		return
	}
	response.JSON(w, http.StatusOK, p)
}

func (h *Handler) Update(w http.ResponseWriter, r *http.Request) {
	defer r.Body.Close()
	r.Body = http.MaxBytesReader(w, r.Body, maxBodySize)

	var req UpdateReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.Error(w, http.StatusBadRequest, response.CodeValidation, "无效的请求内容")
		return
	}

	p, err := h.svc.UpdateAvatar(r.Context(), auth.IsOwner(r.Context()), req.AvatarURL)
	if err != nil {
		h.writeServiceError(w, r, err)
		return
	}
	response.JSON(w, http.StatusOK, p)
}

// writeServiceError 将 service 层的类型化错误映射为对应 HTTP 状态码。
func (h *Handler) writeServiceError(w http.ResponseWriter, r *http.Request, err error) {
	var ve *ValidationError
	switch {
	case errors.As(err, &ve):
		response.Error(w, http.StatusBadRequest, response.CodeValidation, ve.Message)
	case errors.Is(err, ErrUnauthorized):
		response.Error(w, http.StatusUnauthorized, response.CodeUnauthorized, "authentication required")
	default:
		h.internalError(w, r, err)
	}
}

// internalError 记录真实错误到日志，但不向客户端暴露内部细节。
func (h *Handler) internalError(w http.ResponseWriter, r *http.Request, err error) {
	slog.Error("profile request failed",
		"method", r.Method,
		"path", r.URL.Path,
		"error", err,
	)
	response.Error(w, http.StatusInternalServerError, response.CodeInternal, "internal server error")
}
