package blog

import "time"

type Post struct {
	ID          int64     `json:"id"`
	Title       string    `json:"title"`
	Slug        string    `json:"slug"`
	Content     string    `json:"content"`
	Summary     string    `json:"summary"`
	Status      string    `json:"status"`
	Tags        []string  `json:"tags"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
	PublishedAt *time.Time `json:"published_at,omitempty"`
}

type Tag struct {
	ID   int64  `json:"id"`
	Name string `json:"name"`
}

type CreatePostReq struct {
	Title   string  `json:"title"`
	Slug    string  `json:"slug"`
	Content string  `json:"content"`
	Summary string  `json:"summary"`
	Status  string  `json:"status"`
	Tags    []string `json:"tags"`
}

type UpdatePostReq struct {
	Title   *string  `json:"title,omitempty"`
	Content *string  `json:"content,omitempty"`
	Summary *string  `json:"summary,omitempty"`
	Status  *string  `json:"status,omitempty"`
	Tags    []string `json:"tags,omitempty"`
}

type ListPostsReq struct {
	Page    int    `json:"page"`
	PerPage int    `json:"per_page"`
	Status  string `json:"status"`
	Tag     string `json:"tag"`
}
