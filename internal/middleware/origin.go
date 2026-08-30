package middleware

import (
	"net/http"

	"github.com/bba70/blogs/internal/pkg/response"
)

// unsafeMethods 是会修改状态、需要校验来源的请求方法。
var unsafeMethods = map[string]bool{
	http.MethodPost:   true,
	http.MethodPut:    true,
	http.MethodPatch:  true,
	http.MethodDelete: true,
}

// OriginGuard 校验非安全方法请求的 Origin 是否属于允许列表，
// 与 SameSite Cookie 一起降低 CSRF 风险。
//
// 浏览器发起的跨站或同源表单/脚本请求都会携带 Origin；
// 不带 Origin 的请求（如 curl 等非浏览器客户端）不受影响。
// Origin 为列表外的值（含 null）时一律拒绝。
func OriginGuard(allowedOrigins []string) func(http.Handler) http.Handler {
	allowed := make(map[string]struct{}, len(allowedOrigins))
	for _, origin := range allowedOrigins {
		allowed[origin] = struct{}{}
	}

	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if unsafeMethods[r.Method] {
				if origin := r.Header.Get("Origin"); origin != "" {
					if _, ok := allowed[origin]; !ok {
						response.Error(w, http.StatusForbidden, response.CodeForbidden, "origin not allowed")
						return
					}
				}
			}
			next.ServeHTTP(w, r)
		})
	}
}
