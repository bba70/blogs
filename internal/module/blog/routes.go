package blog

import (
	"net/http"

	"github.com/go-chi/chi/v5"
)

// RegisterRoutes 挂载文章与标签路由。
// 公开读接口允许可选身份（由 Identity 中间件解析），
// 写接口通过 ownerOnly 强制作者身份。
func RegisterRoutes(r chi.Router, h *Handler, ownerOnly func(http.Handler) http.Handler) {
	r.Route("/posts", func(r chi.Router) {
		r.Get("/", h.ListPosts)
		r.With(ownerOnly).Post("/", h.CreatePost)

		r.Route("/{slug}", func(r chi.Router) {
			r.Get("/", h.GetPost)
			r.With(ownerOnly).Put("/", h.UpdatePost)
			r.With(ownerOnly).Delete("/", h.DeletePost)
		})
	})
	r.Get("/tags", h.ListTags)
}
