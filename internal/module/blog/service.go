package blog

import (
	"context"
	"errors"
	"time"
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
	if req.Status == "" {
		req.Status = "draft"
	}

	p := &Post{
		Title:   req.Title,
		Slug:    req.Slug,
		Content: req.Content,
		Summary: req.Summary,
		Status:  req.Status,
		Tags:    req.Tags,
	}

	if req.Status == "published" {
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
	if err != nil {
		return ErrPostNotFound
	}
	return nil
}

func (s *Service) ListTags(ctx context.Context) ([]Tag, error) {
	return s.repo.ListTags(ctx)
}

