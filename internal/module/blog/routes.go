package blog

import "github.com/go-chi/chi/v5"

func (h *Handler) Routes() chi.Router {
	r := chi.NewRouter()

	r.Get("/", h.ListPosts)
	r.Post("/", h.CreatePost)

	r.Route("/{slug}", func(r chi.Router) {
		r.Get("/", h.GetPost)
		r.Put("/", h.UpdatePost)
		r.Delete("/", h.DeletePost)
	})

	return r
}

func RegisterRoutes(r chi.Router, h *Handler) {
	r.Mount("/posts", h.Routes())
	r.Get("/tags", h.ListTags)
}
