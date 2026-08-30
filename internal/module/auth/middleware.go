package auth

import (
	"context"
	"net/http"

	"github.com/bba70/blogs/internal/pkg/response"
)

type contextKey struct{}

// ContextWithOwner 返回携带作者身份的上下文。
func ContextWithOwner(ctx context.Context) context.Context {
	return context.WithValue(ctx, contextKey{}, true)
}

// IsOwner 判断请求上下文中是否携带已认证的作者身份。
func IsOwner(ctx context.Context) bool {
	owner, _ := ctx.Value(contextKey{}).(bool)
	return owner
}

// Middleware 提供身份解析与强制授权两类 HTTP 中间件。
type Middleware struct {
	svc *Service
}

func NewMiddleware(svc *Service) *Middleware {
	return &Middleware{svc: svc}
}

// Identity 从会话 Cookie 解析作者身份并写入请求上下文。
// 缺少 Cookie 或 Token 无效/过期时保持匿名（公开路由按匿名处理），
// 受保护路由由 RequireOwner 统一拒绝。
func (m *Middleware) Identity(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if cookie, err := r.Cookie(CookieName); err == nil && cookie.Value != "" {
			if m.svc.ValidateToken(cookie.Value) == nil {
				r = r.WithContext(ContextWithOwner(r.Context()))
			}
		}
		next.ServeHTTP(w, r)
	})
}

// RequireOwner 强制要求作者身份，未认证时立即返回 401。
// 只应挂在 Identity 之后的受保护路由上。
func (m *Middleware) RequireOwner(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if !IsOwner(r.Context()) {
			response.Error(w, http.StatusUnauthorized, response.CodeUnauthorized, "authentication required")
			return
		}
		next.ServeHTTP(w, r)
	})
}
