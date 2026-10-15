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
	GetPublicPostBySlug(ctx context.Context, slug string) (*Post, error)
	CreatePost(ctx context.Context, p *Post) error
	UpdatePost(ctx context.Context, slug string, p *UpdatePostReq) (*Post, error)
	DeletePost(ctx context.Context, slug string) error
	ListTags(ctx context.Context, kind string) ([]Tag, error)
	ListPublicTags(ctx context.Context, kind string) ([]Tag, error)
	EnsureTags(ctx context.Context, names []string) error
	SyncPostTags(ctx context.Context, postID int64, tagNames []string) error
}

type Service struct {
	repo Store
}

func NewService(repo Store) *Service {
	return &Service{repo: repo}
}

// ListPosts 按类型返回内容。访客只能读取已发布文章，随笔仅作者可见。
// 默认列表为文章；随笔列表显式传入 kind=essay，两种内容不混排。
func (s *Service) ListPosts(ctx context.Context, viewer Viewer, req ListPostsReq) ([]Post, int64, error) {
	if req.Page < 1 {
		req.Page = 1
	}
	if req.PerPage < 1 || req.PerPage > 100 {
		req.PerPage = 10
	}

	if !viewer.IsOwner {
		if req.Status != "" && req.Status != StatusPublished {
			return nil, 0, ErrUnauthorized
		}
	}
	if req.Kind == "" {
		req.Kind = KindArticle
	}
	if err := checkKind(req.Kind); err != nil {
		return nil, 0, err
	}
	if !viewer.IsOwner && req.Kind == KindEssay {
		return nil, 0, ErrUnauthorized
	}

	// 默认只返回已发布文章；"all" 表示不过滤（仅作者可达）。
	switch req.Status {
	case "", StatusPublished:
		req.Status = StatusPublished
	case StatusAll:
		req.Status = ""
	default:
		if err := checkStatus(req.Status); err != nil {
			return nil, 0, err
		}
	}

	return s.repo.ListPosts(ctx, req)
}

// GetPost 返回文章详情。
//
// 匿名读取在 SQL 层限定已发布文章；随笔和草稿均返回 404。
func (s *Service) GetPost(ctx context.Context, viewer Viewer, slug string) (*Post, error) {
	var (
		p   *Post
		err error
	)
	if viewer.IsOwner {
		p, err = s.repo.GetPostBySlug(ctx, slug)
	} else {
		p, err = s.repo.GetPublicPostBySlug(ctx, slug)
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

	tags, err := normalizePostTags(req.Tags)
	if err != nil {
		return nil, err
	}
	req.Tags = tags

	if req.Status == "" {
		req.Status = StatusDraft
	}
	if req.Kind == "" {
		req.Kind = KindArticle
	}

	p := &Post{
		Title:    req.Title,
		Slug:     req.Slug,
		Content:  req.Content,
		Summary:  req.Summary,
		CoverURL: req.CoverURL,
		Status:   req.Status,
		Kind:     req.Kind,
		Tags:     req.Tags,
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

	tags, err := normalizePostTags(req.Tags)
	if err != nil {
		return nil, err
	}
	req.Tags = tags

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

// ListTags 按类型返回标签。匿名只读取已发布文章使用的标签。
// 未指定类型时，匿名返回文章标签，作者返回内容使用的标签供列表筛选。
func (s *Service) ListTags(ctx context.Context, viewer Viewer, kind string) ([]Tag, error) {
	if kind != "" {
		if err := checkKind(kind); err != nil {
			return nil, err
		}
	}
	if viewer.IsOwner {
		return s.repo.ListTags(ctx, kind)
	}
	if kind == "" {
		kind = KindArticle
	}
	if kind == KindEssay {
		return nil, ErrUnauthorized
	}
	return s.repo.ListPublicTags(ctx, kind)
}
