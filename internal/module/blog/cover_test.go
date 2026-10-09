package blog

import (
	"context"
	"testing"
)

func TestCoverCreateUpdateAndClear(t *testing.T) {
	svc := NewService(newFakeStore())
	url := "/api/v1/media/0123456789abcdef0123456789abcdef.png"
	post, err := svc.CreatePost(context.Background(), ownerViewer, CreatePostReq{Title: "cover", Slug: "cover", CoverURL: url})
	if err != nil || post.CoverURL != url {
		t.Fatalf("create cover: post=%+v err=%v", post, err)
	}
	replacement := "https://cdn.example.com/new.jpg"
	post, err = svc.UpdatePost(context.Background(), ownerViewer, "cover", UpdatePostReq{CoverURL: &replacement})
	if err != nil || post.CoverURL != replacement {
		t.Fatalf("update cover: post=%+v err=%v", post, err)
	}
	post, err = svc.UpdatePost(context.Background(), ownerViewer, "cover", UpdatePostReq{})
	if err != nil || post.CoverURL != replacement {
		t.Fatalf("omitted cover must be preserved: %+v %v", post, err)
	}
	empty := ""
	post, err = svc.UpdatePost(context.Background(), ownerViewer, "cover", UpdatePostReq{CoverURL: &empty})
	if err != nil || post.CoverURL != "" {
		t.Fatalf("clear cover: post=%+v err=%v", post, err)
	}
}

func TestCoverRejectsUnsafeURLs(t *testing.T) {
	for _, value := range []string{"javascript:alert(1)", "data:image/png;base64,abc", "//example.com/image.png", "/api/v1/media/../secret", "https://user:pass@example.com/a.png", "C:\\private.png"} {
		if err := checkCoverURL(value); err == nil {
			t.Errorf("accepted unsafe cover %q", value)
		}
	}
}
