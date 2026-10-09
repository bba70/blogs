package auth

import (
	"encoding/json"
	"log/slog"
	"net"
	"net/http"

	"github.com/go-chi/chi/v5"

	"github.com/bba70/blogs/internal/pkg/response"
)

// maxLoginBodySize 限制登录请求体大小（4KB），只需要一个密码字段。
const maxLoginBodySize = 4 << 10

// Handler 处理登录、身份查询与退出。
type Handler struct {
	svc     *Service
	limiter *LoginLimiter
	secure  bool
}

func NewHandler(svc *Service, limiter *LoginLimiter, cookieSecure bool) *Handler {
	return &Handler{svc: svc, limiter: limiter, secure: cookieSecure}
}

type loginRequest struct {
	Password string `json:"password"`
}

// sessionStatus 只表达当前是否为作者，不返回任何凭证内容。
type sessionStatus struct {
	Authenticated bool `json:"authenticated"`
}

// Routes 返回 auth 模块的路由。调用方需先挂 Identity 中间件，
// 使 /me 能读取已有会话。
func (h *Handler) Routes() chi.Router {
	r := chi.NewRouter()
	r.Use(noStore)
	r.Post("/login", h.Login)
	r.Get("/me", h.Me)
	r.Post("/logout", h.Logout)
	return r
}

// noStore 防止浏览器或中间代理缓存当前身份与登录响应。
func noStore(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Cache-Control", "no-store")
		next.ServeHTTP(w, r)
	})
}

// Login 校验作者密码并签发会话 Cookie。
// 密码错误统一返回 401；触发限流返回 429；
// 响应消息不区分“未配置”“密码不存在”或“密码错误”。
func (h *Handler) Login(w http.ResponseWriter, r *http.Request) {
	ip := clientIP(r)

	if !h.limiter.Allow(ip) {
		response.Error(w, http.StatusTooManyRequests, response.CodeRateLimited,
			"too many failed attempts, please try again later")
		return
	}

	var req loginRequest
	r.Body = http.MaxBytesReader(w, r.Body, maxLoginBodySize)
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.Error(w, http.StatusBadRequest, response.CodeValidation, "invalid request")
		return
	}

	if !h.svc.VerifyPassword(req.Password) {
		h.limiter.RecordFailure(ip)
		response.Error(w, http.StatusUnauthorized, response.CodeUnauthorized, "authentication failed")
		return
	}

	token, err := h.svc.IssueToken()
	if err != nil {
		slog.Error("issue token failed", "error", err)
		response.Error(w, http.StatusInternalServerError, response.CodeInternal, "internal server error")
		return
	}

	h.limiter.Reset(ip)
	SetSessionCookie(w, token, h.secure)
	response.JSON(w, http.StatusOK, sessionStatus{Authenticated: true})
}

// Me 返回当前是否已认证为作者，任何身份都可访问。
func (h *Handler) Me(w http.ResponseWriter, r *http.Request) {
	response.JSON(w, http.StatusOK, sessionStatus{Authenticated: IsOwner(r.Context())})
}

// Logout 清除当前作者 Cookie，幂等。无状态 JWT 不维护服务端会话或吊销列表。
func (h *Handler) Logout(w http.ResponseWriter, _ *http.Request) {
	ClearSessionCookie(w, h.secure)
	response.JSON(w, http.StatusOK, sessionStatus{Authenticated: false})
}

// clientIP 取请求的客户端 IP。RealIP 中间件已在直接来源可信时，把受控
// 反向代理传递的客户端地址写入 RemoteAddr；部署时必须只信任受控代理，
// 且不能让公网绕过代理直接访问 API 端口。
func clientIP(r *http.Request) string {
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		return r.RemoteAddr
	}
	return host
}
