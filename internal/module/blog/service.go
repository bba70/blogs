package blog

import (
	"context"
	"errors"
	"time"

	"github.com/jackc/pgx/v5"
)

var (
	ErrPostNotFound = errors.New("post not found")
	ErrSlugExists   = errors.New("slug already exists")
	// ErrUnauthorized 表示当前身份无权执行该操作，由 handler 映射为 401。
	ErrUnauthorized = errors.New("authentication required")
)

// Store 定义 service 依赖的数据库访问面，便于测试注入替身。
// Repository 是该接口的生产实现；repository 不读取身份信息，
// 只执行 service 明确要求的查询。
type Store interface {
	ListPosts(ctx context.Context, req ListPostsReq) ([]Post, int64, error)
	GetPostBySlug(ctx context.Context, slug string) (*Post, error)
	GetPublishedPostBySlug(ctx context.Context, slug string) (*Post, error)
	CreatePost(ctx context.Context, p *Post) error
	UpdatePost(ctx context.Context, slug string, p *UpdatePostReq) (*Post, error)
	DeletePost(ctx context.Context, slug string) error
	ListTags(ctx context.Context) ([]Tag, error)
	ListPublicTags(ctx context.Context) ([]Tag, error)
	EnsureTags(ctx context.Context, names []string) error
	SyncPostTags(ctx context.Context, postID int64, tagNames []string) error
}

type Service struct {
	repo Store
}

func NewService(repo Store) *Service {
	return &Service{repo: repo}
}

// ListPosts 返回文章列表。匿名访问只允许默认或显式 published；
// 匿名请求 draft、all 等管理状态时返回 ErrUnauthorized。
func (s *Service) ListPosts(ctx context.Context, viewer Viewer, req ListPostsReq) ([]Post, int64, error) {
	if req.Page < 1 {
		req.Page = 1
	}
	if req.PerPage < 1 || req.PerPage > 100 {
		req.PerPage = 10
	}

	if !viewer.IsOwner && req.Status != "" && req.Status != StatusPublished {
		return nil, 0, ErrUnauthorized
	}

	// 默认只返回已发布文章；"all" 表示不过滤（仅作者可达）。
	switch req.Status {
	case "", StatusPublished:
		req.Status = StatusPublished
	case StatusAll:
		req.Status = ""
	}

	return s.repo.ListPosts(ctx, req)
}

// GetPost 返回文章详情。匿名读取在 SQL 层限定 status=published，
// 草稿对匿名调用统一映射为不存在（404），不确认草稿是否存在。
func (s *Service) GetPost(ctx context.Context, viewer Viewer, slug string) (*Post, error) {
	var (
		p   *Post
		err error
	)
	if viewer.IsOwner {
		p, err = s.repo.GetPostBySlug(ctx, slug)
	} else {
		p, err = s.repo.GetPublishedPostBySlug(ctx, slug)
	}
	if err != nil {
		return nil, err
	}
	if p == nil {
		return nil, ErrPostNotFound
	}
	return p, nil
}

// CreatePost 创建文章，仅作者可调用（路由层已强制作者身份，此处兜底）。
func (s *Service) CreatePost(ctx context.Context, viewer Viewer, req CreatePostReq) (*Post, error) {
	if !viewer.IsOwner {
		return nil, ErrUnauthorized
	}
	if err := req.Validate(); err != nil {
		return nil, err
	}

	if req.Status == "" {
		req.Status = StatusDraft
	}

	p := &Post{
		Title:   req.Title,
		Slug:    req.Slug,
		Content: req.Content,
		Summary: req.Summary,
		Status:  req.Status,
		Tags:    req.Tags,
	}

	if req.Status == StatusPublished {
		now := time.Now()
		p.PublishedAt = &now
	}

	if err := s.repo.CreatePost(ctx, p); err != nil {
		return nil, err
	}

	if len(req.Tags) > 0 {
		if err := s.repo.EnsureTags(ctx, req.Tags); err != nil {
			return nil, err
		}
		if err := s.repo.SyncPostTags(ctx, p.ID, req.Tags); err != nil {
			return nil, err
		}
	}

	return s.repo.GetPostBySlug(ctx, p.Slug)
}

// UpdatePost 更新文章，仅作者可调用。
func (s *Service) UpdatePost(ctx context.Context, viewer Viewer, slug string, req UpdatePostReq) (*Post, error) {
	if !viewer.IsOwner {
		return nil, ErrUnauthorized
	}
	if err := req.Validate(); err != nil {
		return nil, err
	}

	p, err := s.repo.UpdatePost(ctx, slug, &req)
	if err != nil {
		return nil, err
	}
	if p == nil {
		return nil, ErrPostNotFound
	}
	return p, nil
}

// DeletePost 删除文章，仅作者可调用。
func (s *Service) DeletePost(ctx context.Context, viewer Viewer, slug string) error {
	if !viewer.IsOwner {
		return ErrUnauthorized
	}
	err := s.repo.DeletePost(ctx, slug)
	if errors.Is(err, pgx.ErrNoRows) {
		return ErrPostNotFound
	}
	return err
}

// ListTags 返回标签。匿名查询只聚合至少被一篇已发布文章使用的标签，
// 作者查询返回全部标签。
func (s *Service) ListTags(ctx context.Context, viewer Viewer) ([]Tag, error) {
	if viewer.IsOwner {
		return s.repo.ListTags(ctx)
	}
	return s.repo.ListPublicTags(ctx)
}
