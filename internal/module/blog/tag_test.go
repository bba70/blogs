package blog

import (
	"context"
	"errors"
	"net/http"
	"reflect"
	"strings"
	"testing"
)

func TestPostTagValidation(t *testing.T) {
	for _, name := range []string{"", "  \t ", strings.Repeat("字", 101), "bad\x00name", "two\nlines"} {
		t.Run(name, func(t *testing.T) {
			store := newFakeStore()
			store.seedPost(Post{Slug: "existing", Tags: []string{"original"}})
			svc := NewService(store)
			var validation *ValidationError
			_, err := svc.CreatePost(context.Background(), ownerViewer, CreatePostReq{Title: "New", Slug: "new", Tags: []string{name}})
			if !errors.As(err, &validation) {
				t.Fatalf("create error=%v, want ValidationError", err)
			}
			if _, exists := store.posts["new"]; exists {
				t.Fatal("invalid tags must not create a post")
			}
			_, err = svc.UpdatePost(context.Background(), ownerViewer, "existing", UpdatePostReq{Tags: []string{name}})
			if !errors.As(err, &validation) || !reflect.DeepEqual(store.posts["existing"].Tags, []string{"original"}) {
				t.Fatalf("invalid update changed tags: error=%v post=%+v", err, store.posts["existing"])
			}
		})
	}
}

func TestPostTagsAreIndependent(t *testing.T) {
	store := newFakeStore()
	svc := NewService(store)
	ctx := context.Background()
	for _, kind := range []string{KindArticle, KindEssay} {
		post, err := svc.CreatePost(ctx, ownerViewer, CreatePostReq{
			Title: kind, Slug: kind, Content: "正文", Kind: kind, Status: StatusPublished,
			Tags: []string{" Go ", "Go", "生活"},
		})
		if err != nil || !reflect.DeepEqual(post.Tags, []string{"Go", "生活"}) {
			t.Fatalf("create %s=%+v error=%v", kind, post, err)
		}
	}
	for _, tc := range []struct{ input, want []string }{
		{[]string{" Golang ", "生活", "新标签"}, []string{"Golang", "生活", "新标签"}},
		{[]string{}, []string{}},
	} {
		post, err := svc.UpdatePost(ctx, ownerViewer, KindArticle, UpdatePostReq{Tags: tc.input})
		if err != nil || post.Content != "正文" || !reflect.DeepEqual(post.Tags, tc.want) {
			t.Fatalf("update current post=%+v error=%v", post, err)
		}
		other, err := svc.GetPost(ctx, ownerViewer, KindEssay)
		if err != nil || !reflect.DeepEqual(other.Tags, []string{"Go", "生活"}) || other.Content != "正文" {
			t.Fatalf("other post changed=%+v error=%v", other, err)
		}
	}
	if _, err := svc.UpdatePost(ctx, ownerViewer, KindEssay, UpdatePostReq{}); err != nil {
		t.Fatal(err)
	}
	if !reflect.DeepEqual(store.posts[KindEssay].Tags, []string{"Go", "生活"}) {
		t.Fatal("omitting tags must preserve current tags")
	}
}

func TestGlobalTagWriteRoutesAreUnavailable(t *testing.T) {
	env := newAuthzEnv(t)
	for _, cookie := range []string{"", env.ownerCookie(t)} {
		for _, tc := range []struct{ method, target string }{
			{http.MethodPost, "/api/v1/tags"},
			{http.MethodPut, "/api/v1/tags/1"},
			{http.MethodDelete, "/api/v1/tags/1"},
		} {
			rec := env.do(t, tc.method, tc.target, `{"name":"new"}`, cookie)
			if rec.Code != http.StatusNotFound && rec.Code != http.StatusMethodNotAllowed {
				t.Errorf("%s %s=%d, want 404 or 405", tc.method, tc.target, rec.Code)
			}
		}
	}
}
