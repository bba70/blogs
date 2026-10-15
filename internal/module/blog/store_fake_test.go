package blog

import (
	"context"
	"fmt"
	"sync"

	"github.com/jackc/pgx/v5"
)

// fakeStore 是 Store 接口的内存替身，用于在没有数据库的情况下
// 测试 service 的可见性规则与 handler 的授权矩阵。
type fakeStore struct {
	mu    sync.Mutex
	posts map[string]*Post
	tags  []Tag

	// 记录调用，便于断言 service 选择了正确的查询路径。
	lastListReq    ListPostsReq
	lastTagKind    string
	getCalls       []string
	publicGetCalls []string
}

func newFakeStore() *fakeStore {
	return &fakeStore{posts: make(map[string]*Post)}
}

func (s *fakeStore) seedPost(p Post) {
	s.mu.Lock()
	defer s.mu.Unlock()
	cp := p
	s.posts[p.Slug] = &cp
}

func (s *fakeStore) ListPosts(_ context.Context, req ListPostsReq) ([]Post, int64, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.lastListReq = req

	var posts []Post
	var total int64
	for _, p := range s.posts {
		if req.Status != "" && p.Status != req.Status {
			continue
		}
		if req.Kind != "" && p.Kind != req.Kind {
			continue
		}
		posts = append(posts, *p)
		total++
	}
	return posts, total, nil
}

func (s *fakeStore) GetPostBySlug(_ context.Context, slug string) (*Post, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.getCalls = append(s.getCalls, slug)
	if p, ok := s.posts[slug]; ok {
		cp := *p
		return &cp, nil
	}
	return nil, nil
}

// GetPublicPostBySlug 在替身里复刻 SQL 层的已发布条件，
// 让 service 测试能覆盖"不可见即不存在"的行为。
func (s *fakeStore) GetPublicPostBySlug(_ context.Context, slug string) (*Post, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.publicGetCalls = append(s.publicGetCalls, slug)
	if p, ok := s.posts[slug]; ok && p.Status == StatusPublished && p.Kind == KindArticle {
		cp := *p
		return &cp, nil
	}
	return nil, nil
}

func (s *fakeStore) CreatePost(_ context.Context, p *Post) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if _, exists := s.posts[p.Slug]; exists {
		return ErrSlugExists
	}
	p.ID = int64(len(s.posts) + 1)
	cp := *p
	s.posts[p.Slug] = &cp
	return nil
}

func (s *fakeStore) UpdatePost(_ context.Context, slug string, req *UpdatePostReq) (*Post, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	p, ok := s.posts[slug]
	if !ok {
		return nil, nil
	}
	if req.Title != nil {
		p.Title = *req.Title
	}
	if req.Slug != nil && *req.Slug != slug {
		delete(s.posts, slug)
		p.Slug = *req.Slug
		s.posts[p.Slug] = p
	}
	if req.Content != nil {
		p.Content = *req.Content
	}
	if req.Summary != nil {
		p.Summary = *req.Summary
	}
	if req.CoverURL != nil {
		p.CoverURL = *req.CoverURL
	}
	if req.Status != nil {
		p.Status = *req.Status
	}
	if req.Kind != nil {
		p.Kind = *req.Kind
	}
	if req.Tags != nil {
		p.Tags = append([]string{}, req.Tags...)
	}
	cp := *p
	return &cp, nil
}

func (s *fakeStore) DeletePost(_ context.Context, slug string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if _, ok := s.posts[slug]; !ok {
		return fmt.Errorf("delete %q: %w", slug, pgx.ErrNoRows)
	}
	delete(s.posts, slug)
	return nil
}

func (s *fakeStore) ListTags(_ context.Context, kind string) ([]Tag, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.lastTagKind = kind
	return s.tagsForPosts(kind, false), nil
}

func (s *fakeStore) ListPublicTags(_ context.Context, kind string) ([]Tag, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.lastTagKind = kind
	return s.tagsForPosts(kind, true), nil
}

func (s *fakeStore) tagsForPosts(kind string, publishedOnly bool) []Tag {
	used := make(map[string]bool)
	for _, p := range s.posts {
		if (kind == "" || p.Kind == kind) && (!publishedOnly || p.Status == StatusPublished) {
			for _, name := range p.Tags {
				used[name] = true
			}
		}
	}
	var tags []Tag
	for _, tag := range s.tags {
		if used[tag.Name] {
			tags = append(tags, tag)
		}
	}
	return tags
}

func (s *fakeStore) EnsureTags(_ context.Context, _ []string) error { return nil }

func (s *fakeStore) SyncPostTags(_ context.Context, _ int64, _ []string) error { return nil }
