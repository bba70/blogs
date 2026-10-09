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
	store.seedPost(Post{Slug: "hello", Title: "Hello", Status: StatusPublished})
	store.seedPost(Post{Slug: "secret-draft", Title: "Draft", Status: StatusDraft})
	store.tags = []Tag{{ID: 1, Name: "public-tag"}, {ID: 2, Name: "draft-only-tag"}}
	store.publicTags = []Tag{{ID: 1, Name: "public-tag"}}
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

func TestGetPostAnonymousUsesPublishedQuery(t *testing.T) {
	store := seededStore()
	svc := NewService(store)

	if _, err := svc.GetPost(context.Background(), anonymousViewer, "secret-draft"); !errors.Is(err, ErrPostNotFound) {
		t.Errorf("anonymous draft read error = %v, want ErrPostNotFound", err)
	}
	if len(store.publishedGetCalls) != 1 || len(store.getCalls) != 0 {
		t.Errorf("anonymous read must use the published-only query, gotCalls=%v pubCalls=%v",
			store.getCalls, store.publishedGetCalls)
	}

	post, err := svc.GetPost(context.Background(), anonymousViewer, "hello")
	if err != nil || post.Slug != "hello" {
		t.Errorf("anonymous published read = %+v, %v", post, err)
	}
}

func TestGetPostOwnerCanReadDraft(t *testing.T) {
	store := seededStore()
	svc := NewService(store)

	post, err := svc.GetPost(context.Background(), ownerViewer, "secret-draft")
	if err != nil || post.Slug != "secret-draft" {
		t.Errorf("owner draft read = %+v, %v", post, err)
	}
	if len(store.getCalls) != 1 || len(store.publishedGetCalls) != 0 {
		t.Error("owner read must use the unrestricted query")
	}

	if _, err := svc.GetPost(context.Background(), ownerViewer, "missing"); !errors.Is(err, ErrPostNotFound) {
		t.Errorf("owner missing read error = %v, want ErrPostNotFound", err)
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

	tags, err := svc.ListTags(context.Background(), anonymousViewer)
	if err != nil {
		t.Fatalf("anonymous tags: %v", err)
	}
	if len(tags) != 1 || tags[0].Name != "public-tag" {
		t.Errorf("anonymous tags = %+v, want only public tags", tags)
	}

	tags, err = svc.ListTags(context.Background(), ownerViewer)
	if err != nil {
		t.Fatalf("owner tags: %v", err)
	}
	if len(tags) != 2 {
		t.Errorf("owner tags = %+v, want all tags", tags)
	}
}
