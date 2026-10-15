package blog

import (
	"context"
	"errors"
	"testing"
)

var (
	anonymousViewer = Viewer{IsOwner: false}
	ownerViewer     = Viewer{IsOwner: true}
)

func seededStore() *fakeStore {
	store := newFakeStore()
	store.seedPost(Post{Slug: "hello", Title: "Hello", Status: StatusPublished, Kind: KindArticle, Tags: []string{"public-tag"}})
	store.seedPost(Post{Slug: "secret-draft", Title: "Draft", Status: StatusDraft, Kind: KindArticle, Tags: []string{"draft-only-tag"}})
	store.tags = []Tag{{ID: 1, Name: "public-tag"}, {ID: 2, Name: "draft-only-tag"}}
	return store
}

// seededContentStore 覆盖文章、随笔两种类型和已发布、草稿两种状态。
func seededContentStore() *fakeStore {
	store := newFakeStore()
	store.seedPost(Post{Slug: "public-article", Title: "Article", Status: StatusPublished, Kind: KindArticle})
	store.seedPost(Post{Slug: "draft-article", Title: "Article draft", Status: StatusDraft, Kind: KindArticle})
	store.seedPost(Post{Slug: "public-essay", Title: "Essay", Status: StatusPublished, Kind: KindEssay})
	store.seedPost(Post{Slug: "draft-essay", Title: "Essay draft", Status: StatusDraft, Kind: KindEssay})
	return store
}

func TestListPostsAnonymousRejectsAdminStatus(t *testing.T) {
	svc := NewService(seededStore())

	for _, status := range []string{StatusAll, StatusDraft, "anything-else"} {
		_, _, err := svc.ListPosts(context.Background(), anonymousViewer, ListPostsReq{Status: status})
		if !errors.Is(err, ErrUnauthorized) {
			t.Errorf("anonymous status=%q error = %v, want ErrUnauthorized", status, err)
		}
	}
}

func TestListPostsAnonymousSeesOnlyPublished(t *testing.T) {
	store := seededStore()
	svc := NewService(store)

	for _, status := range []string{"", StatusPublished} {
		posts, total, err := svc.ListPosts(context.Background(), anonymousViewer, ListPostsReq{Status: status})
		if err != nil {
			t.Fatalf("anonymous status=%q: %v", status, err)
		}
		if total != 1 || len(posts) != 1 || posts[0].Slug != "hello" {
			t.Errorf("anonymous status=%q posts = %+v, want only the published post", status, posts)
		}
		if store.lastListReq.Status != StatusPublished {
			t.Errorf("repository status filter = %q, want %q", store.lastListReq.Status, StatusPublished)
		}
	}
}

func TestListPostsOwnerCanUseAllAndDraft(t *testing.T) {
	store := seededStore()
	svc := NewService(store)

	posts, total, err := svc.ListPosts(context.Background(), ownerViewer, ListPostsReq{Status: StatusAll})
	if err != nil {
		t.Fatalf("owner status=all: %v", err)
	}
	if total != 2 || len(posts) != 2 {
		t.Errorf("owner status=all total = %d, want 2", total)
	}
	if store.lastListReq.Status != "" {
		t.Errorf("repository status filter = %q, want empty (no filter)", store.lastListReq.Status)
	}

	posts, _, err = svc.ListPosts(context.Background(), ownerViewer, ListPostsReq{Status: StatusDraft})
	if err != nil {
		t.Fatalf("owner status=draft: %v", err)
	}
	if len(posts) != 1 || posts[0].Slug != "secret-draft" {
		t.Errorf("owner status=draft posts = %+v", posts)
	}
}

func TestListPostsAnonymousCannotReadEssays(t *testing.T) {
	store := seededContentStore()
	svc := NewService(store)
	posts, total, err := svc.ListPosts(context.Background(), anonymousViewer, ListPostsReq{Kind: KindEssay})
	if !errors.Is(err, ErrUnauthorized) || total != 0 || len(posts) != 0 {
		t.Fatalf("anonymous essays = %+v total=%d error=%v, want ErrUnauthorized and no data", posts, total, err)
	}
	if store.lastListReq.Kind != "" {
		t.Fatal("anonymous essay request must not reach the repository")
	}
	var ve *ValidationError
	if _, _, err := svc.ListPosts(context.Background(), anonymousViewer, ListPostsReq{Kind: "invalid"}); !errors.As(err, &ve) {
		t.Fatalf("invalid kind error = %v, want ValidationError", err)
	}
}

func TestListPostsAnonymousConvergesToPublicArticles(t *testing.T) {
	store := seededContentStore()
	svc := NewService(store)

	posts, total, err := svc.ListPosts(context.Background(), anonymousViewer, ListPostsReq{})
	if err != nil {
		t.Fatalf("anonymous list: %v", err)
	}
	if total != 1 || len(posts) != 1 || posts[0].Slug != "public-article" {
		t.Errorf("anonymous posts = %+v total=%d, want only the public article", posts, total)
	}
	if store.lastListReq.Status != StatusPublished ||
		store.lastListReq.Kind != KindArticle {
		t.Errorf("repository scope = %+v, want published articles", store.lastListReq)
	}
}

func TestListPostsOwnerCanFilterEssays(t *testing.T) {
	store := seededContentStore()
	svc := NewService(store)

	posts, total, err := svc.ListPosts(context.Background(), ownerViewer, ListPostsReq{Status: StatusAll, Kind: KindEssay})
	if err != nil {
		t.Fatalf("owner essays: %v", err)
	}
	if total != 2 || len(posts) != 2 {
		t.Errorf("owner essays total = %d, want 2", total)
	}
	for _, p := range posts {
		if p.Kind != KindEssay {
			t.Errorf("owner essay filter returned kind=%q", p.Kind)
		}
	}
	if store.lastListReq.Status != "" {
		t.Errorf("owner status filter = %q, want empty", store.lastListReq.Status)
	}
}

func TestGetPostAnonymousUsesPublishedQuery(t *testing.T) {
	store := seededStore()
	svc := NewService(store)

	if _, err := svc.GetPost(context.Background(), anonymousViewer, "secret-draft"); !errors.Is(err, ErrPostNotFound) {
		t.Errorf("anonymous draft read error = %v, want ErrPostNotFound", err)
	}
	if len(store.publicGetCalls) != 1 || len(store.getCalls) != 0 {
		t.Errorf("anonymous read must use the public-only query, gotCalls=%v pubCalls=%v",
			store.getCalls, store.publicGetCalls)
	}

	post, err := svc.GetPost(context.Background(), anonymousViewer, "hello")
	if err != nil || post.Slug != "hello" {
		t.Errorf("anonymous published read = %+v, %v", post, err)
	}
}

func TestGetPostAnonymousReadsPublishedAndHidesDrafts(t *testing.T) {
	svc := NewService(seededContentStore())

	for _, slug := range []string{"draft-article", "draft-essay", "public-essay"} {
		if _, err := svc.GetPost(context.Background(), anonymousViewer, slug); !errors.Is(err, ErrPostNotFound) {
			t.Errorf("anonymous read %q error = %v, want ErrPostNotFound", slug, err)
		}
	}

	for _, slug := range []string{"public-article"} {
		post, err := svc.GetPost(context.Background(), anonymousViewer, slug)
		if err != nil || post == nil || post.Slug != slug {
			t.Errorf("anonymous published read %q = %+v, %v", slug, post, err)
		}
	}
}

func TestGetPostOwnerCanReadDraft(t *testing.T) {
	store := seededStore()
	svc := NewService(store)

	post, err := svc.GetPost(context.Background(), ownerViewer, "secret-draft")
	if err != nil || post.Slug != "secret-draft" {
		t.Errorf("owner draft read = %+v, %v", post, err)
	}
	if len(store.getCalls) != 1 || len(store.publicGetCalls) != 0 {
		t.Error("owner read must use the unrestricted query")
	}

	if _, err := svc.GetPost(context.Background(), ownerViewer, "missing"); !errors.Is(err, ErrPostNotFound) {
		t.Errorf("owner missing read error = %v, want ErrPostNotFound", err)
	}
}

func TestGetPostOwnerCanReadEssayDraft(t *testing.T) {
	store := seededContentStore()
	svc := NewService(store)

	post, err := svc.GetPost(context.Background(), ownerViewer, "draft-essay")
	if err != nil || post.Slug != "draft-essay" {
		t.Errorf("owner essay draft read = %+v, %v", post, err)
	}
	if len(store.getCalls) != 1 || len(store.publicGetCalls) != 0 {
		t.Error("owner read must use the unrestricted query")
	}
}

func TestCreatePostDefaultsAndValidation(t *testing.T) {
	svc := NewService(newFakeStore())
	ctx := context.Background()

	if _, err := svc.CreatePost(ctx, ownerViewer, CreatePostReq{Title: "t", Slug: "s", Kind: "banana"}); err == nil {
		t.Error("create with invalid kind must fail validation")
	}

	post, err := svc.CreatePost(ctx, ownerViewer, CreatePostReq{Title: "t", Slug: "s"})
	if err != nil {
		t.Fatalf("create with defaults: %v", err)
	}
	if post.Kind != KindArticle || post.Status != StatusDraft {
		t.Errorf("defaults kind=%q status=%q, want article/draft", post.Kind, post.Status)
	}

	post, err = svc.CreatePost(ctx, ownerViewer, CreatePostReq{
		Title: "e", Slug: "e", Kind: KindEssay,
	})
	if err != nil {
		t.Fatalf("create essay: %v", err)
	}
	if post.Kind != KindEssay || post.Status != StatusDraft {
		t.Errorf("created essay kind=%q status=%q, want essay/draft", post.Kind, post.Status)
	}
}

func TestWriteOperationsRequireOwner(t *testing.T) {
	svc := NewService(seededStore())
	ctx := context.Background()

	if _, err := svc.CreatePost(ctx, anonymousViewer, CreatePostReq{Title: "t", Slug: "s", Content: "c"}); !errors.Is(err, ErrUnauthorized) {
		t.Errorf("anonymous create error = %v, want ErrUnauthorized", err)
	}

	title := "new title"
	if _, err := svc.UpdatePost(ctx, anonymousViewer, "hello", UpdatePostReq{Title: &title}); !errors.Is(err, ErrUnauthorized) {
		t.Errorf("anonymous update error = %v, want ErrUnauthorized", err)
	}

	if err := svc.DeletePost(ctx, anonymousViewer, "hello"); !errors.Is(err, ErrUnauthorized) {
		t.Errorf("anonymous delete error = %v, want ErrUnauthorized", err)
	}
}

func TestListTagsVisibility(t *testing.T) {
	store := seededStore()
	svc := NewService(store)

	tags, err := svc.ListTags(context.Background(), anonymousViewer, "")
	if err != nil {
		t.Fatalf("anonymous tags: %v", err)
	}
	if len(tags) != 1 || tags[0].Name != "public-tag" {
		t.Errorf("anonymous tags = %+v, want only public tags", tags)
	}

	tags, err = svc.ListTags(context.Background(), ownerViewer, "")
	if err != nil {
		t.Fatalf("owner tags: %v", err)
	}
	if len(tags) != 2 {
		t.Errorf("owner tags = %+v, want all tags", tags)
	}
}

func TestListTagsByKind(t *testing.T) {
	store := newFakeStore()
	store.tags = []Tag{{ID: 1, Name: "article-only"}, {ID: 2, Name: "essay-only"}, {ID: 3, Name: "shared"}}
	store.seedPost(Post{Slug: "article", Kind: KindArticle, Tags: []string{"article-only", "shared"}})
	store.seedPost(Post{Slug: "essay-draft", Kind: KindEssay, Status: StatusDraft, Tags: []string{"essay-only", "shared"}})
	store.seedPost(Post{Slug: "essay-published", Kind: KindEssay, Status: StatusPublished, Tags: []string{"shared"}})
	svc := NewService(store)
	tags, err := svc.ListTags(context.Background(), ownerViewer, KindEssay)
	if err != nil || len(tags) != 2 || tags[0].Name != "essay-only" || tags[1].Name != "shared" {
		t.Fatalf("essay tags = %+v, error = %v", tags, err)
	}
	if store.lastTagKind != KindEssay {
		t.Fatalf("tag kind = %q, want essay", store.lastTagKind)
	}
	tags, err = svc.ListTags(context.Background(), anonymousViewer, KindEssay)
	if !errors.Is(err, ErrUnauthorized) || len(tags) != 0 {
		t.Fatalf("anonymous essay tags = %+v error=%v, want ErrUnauthorized and no tags", tags, err)
	}
	var validationError *ValidationError
	if _, err := svc.ListTags(context.Background(), ownerViewer, "invalid"); !errors.As(err, &validationError) {
		t.Fatalf("invalid tag kind error = %v, want ValidationError", err)
	}
}
