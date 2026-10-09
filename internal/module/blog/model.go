package blog

import (
	"fmt"
	"net/url"
	"strings"
	"time"
	"unicode/utf8"
)

// 文章状态。
const (
	StatusDraft     = "draft"
	StatusPublished = "published"
)

// Viewer 描述当前请求者的访问能力，与 HTTP 细节解耦。
// 由 handler 从认证上下文中映射后传入 service。
type Viewer struct {
	IsOwner bool
}

// StatusAll 仅用于列表接口的 status 参数，表示不过滤状态（供管理端使用）。
const StatusAll = "all"

const (
	maxTitleLen   = 255
	maxSlugLen    = 255
	maxSummaryLen = 500
)

type Post struct {
	ID          int64      `json:"id"`
	Title       string     `json:"title"`
	Slug        string     `json:"slug"`
	Content     string     `json:"content"`
	Summary     string     `json:"summary"`
	CoverURL    string     `json:"cover_url"`
	Status      string     `json:"status"`
	Tags        []string   `json:"tags"`
	CreatedAt   time.Time  `json:"created_at"`
	UpdatedAt   time.Time  `json:"updated_at"`
	PublishedAt *time.Time `json:"published_at,omitempty"`
}

type Tag struct {
	ID   int64  `json:"id"`
	Name string `json:"name"`
}

type CreatePostReq struct {
	Title    string   `json:"title"`
	Slug     string   `json:"slug"`
	Content  string   `json:"content"`
	Summary  string   `json:"summary"`
	CoverURL string   `json:"cover_url"`
	Status   string   `json:"status"`
	Tags     []string `json:"tags"`
}

type UpdatePostReq struct {
	Title    *string  `json:"title,omitempty"`
	Slug     *string  `json:"slug,omitempty"`
	Content  *string  `json:"content,omitempty"`
	Summary  *string  `json:"summary,omitempty"`
	CoverURL *string  `json:"cover_url,omitempty"`
	Status   *string  `json:"status,omitempty"`
	Tags     []string `json:"tags,omitempty"`
}

type ListPostsReq struct {
	Page    int    `json:"page"`
	PerPage int    `json:"per_page"`
	Status  string `json:"status"`
	Tag     string `json:"tag"`
}

// ValidationError 表示请求参数校验失败，由 handler 映射为 400。
type ValidationError struct {
	Message string
}

func (e *ValidationError) Error() string { return e.Message }

func validationErrorf(format string, args ...interface{}) error {
	return &ValidationError{Message: fmt.Sprintf(format, args...)}
}

func checkStatus(status string) error {
	if status != StatusDraft && status != StatusPublished {
		return validationErrorf("invalid status %q, must be %q or %q", status, StatusDraft, StatusPublished)
	}
	return nil
}

func (r CreatePostReq) Validate() error {
	if err := checkCoverURL(r.CoverURL); err != nil {
		return err
	}
	if strings.TrimSpace(r.Title) == "" {
		return validationErrorf("title is required")
	}
	if utf8.RuneCountInString(r.Title) > maxTitleLen {
		return validationErrorf("title exceeds %d characters", maxTitleLen)
	}
	if strings.TrimSpace(r.Slug) == "" {
		return validationErrorf("slug is required")
	}
	if utf8.RuneCountInString(r.Slug) > maxSlugLen {
		return validationErrorf("slug exceeds %d characters", maxSlugLen)
	}
	if utf8.RuneCountInString(r.Summary) > maxSummaryLen {
		return validationErrorf("summary exceeds %d characters", maxSummaryLen)
	}
	if r.Status != "" {
		if err := checkStatus(r.Status); err != nil {
			return err
		}
	}
	return nil
}

func (r UpdatePostReq) Validate() error {
	if r.CoverURL != nil {
		if err := checkCoverURL(*r.CoverURL); err != nil {
			return err
		}
	}
	if r.Title != nil {
		if strings.TrimSpace(*r.Title) == "" {
			return validationErrorf("title cannot be empty")
		}
		if utf8.RuneCountInString(*r.Title) > maxTitleLen {
			return validationErrorf("title exceeds %d characters", maxTitleLen)
		}
	}
	if r.Slug != nil {
		if strings.TrimSpace(*r.Slug) == "" {
			return validationErrorf("slug cannot be empty")
		}
		if utf8.RuneCountInString(*r.Slug) > maxSlugLen {
			return validationErrorf("slug exceeds %d characters", maxSlugLen)
		}
	}
	if r.Summary != nil && utf8.RuneCountInString(*r.Summary) > maxSummaryLen {
		return validationErrorf("summary exceeds %d characters", maxSummaryLen)
	}
	if r.Status != nil {
		if err := checkStatus(*r.Status); err != nil {
			return err
		}
	}
	return nil
}

func checkCoverURL(value string) error {
	if value == "" {
		return nil
	}
	u, err := url.Parse(value)
	if err != nil || len(value) > 2048 || u.User != nil || strings.ContainsAny(value, "\\\r\n\t ") {
		return validationErrorf("invalid cover URL")
	}
	if (u.Scheme == "http" || u.Scheme == "https") && u.Host != "" {
		return nil
	}
	if u.Scheme == "" && u.Host == "" && strings.HasPrefix(value, "/api/v1/media/") && !strings.Contains(u.Path, "..") {
		return nil
	}
	return validationErrorf("invalid cover URL")
}
