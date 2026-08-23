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
)

type Service struct {
	repo *Repository
}

func NewService(repo *Repository) *Service {
	return &Service{repo: repo}
}

func (s *Service) ListPosts(ctx context.Context, req ListPostsReq) ([]Post, int64, error) {
	if req.Page < 1 {
		req.Page = 1
	}
	if req.PerPage < 1 || req.PerPage > 100 {
		req.PerPage = 10
	}

	// 默认只返回已发布文章，避免草稿泄露；"all" 表示不过滤（供管理端使用）。
	// 注意：Phase 2 加认证后，"all" 必须只允许管理员访问。
	switch req.Status {
	case "":
		req.Status = StatusPublished
	case StatusAll:
		req.Status = ""
	}

	return s.repo.ListPosts(ctx, req)
}

func (s *Service) GetPost(ctx context.Context, slug string) (*Post, error) {
	p, err := s.repo.GetPostBySlug(ctx, slug)
	if err != nil {
		return nil, err
	}
	if p == nil {
		return nil, ErrPostNotFound
	}
	return p, nil
}

func (s *Service) CreatePost(ctx context.Context, req CreatePostReq) (*Post, error) {
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
		if err := s.repo.syncPostTags(ctx, p.ID, req.Tags); err != nil {
			return nil, err
		}
	}

	return s.repo.GetPostBySlug(ctx, p.Slug)
}

func (s *Service) UpdatePost(ctx context.Context, slug string, req UpdatePostReq) (*Post, error) {
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

func (s *Service) DeletePost(ctx context.Context, slug string) error {
	err := s.repo.DeletePost(ctx, slug)
	if errors.Is(err, pgx.ErrNoRows) {
		return ErrPostNotFound
	}
	return err
}

func (s *Service) ListTags(ctx context.Context) ([]Tag, error) {
	return s.repo.ListTags(ctx)
}
