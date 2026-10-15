package blog

import (
	"context"
	"fmt"
	"os"
	"testing"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/jackc/pgx/v5/stdlib"
	"github.com/pressly/goose/v3"
)

// Use a disposable schema so this check never migrates the application's tables.
func TestPublicContentMigrationAndRepository(t *testing.T) {
	dsn := os.Getenv("BLOGS_TEST_DATABASE_URL")
	if dsn == "" {
		t.Skip("BLOGS_TEST_DATABASE_URL is not configured")
	}
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	admin, err := pgxpool.New(ctx, dsn)
	if err != nil {
		t.Fatal(err)
	}
	defer admin.Close()
	schema := fmt.Sprintf("blog_public_%d", time.Now().UnixNano())
	quoted := pgx.Identifier{schema}.Sanitize()
	if _, err := admin.Exec(ctx, "CREATE SCHEMA "+quoted); err != nil {
		t.Fatal(err)
	}
	defer func() {
		cleanupCtx, cleanupCancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cleanupCancel()
		if _, err := admin.Exec(cleanupCtx, "DROP SCHEMA "+quoted+" CASCADE"); err != nil {
			t.Errorf("remove test schema: %v", err)
		}
	}()
	config, err := pgxpool.ParseConfig(dsn)
	if err != nil {
		t.Fatal(err)
	}
	config.ConnConfig.RuntimeParams["search_path"] = schema
	pool, err := pgxpool.NewWithConfig(ctx, config)
	if err != nil {
		t.Fatal(err)
	}
	defer pool.Close()
	db := stdlib.OpenDB(*config.ConnConfig)
	defer db.Close()
	provider, err := goose.NewProvider(goose.DialectPostgres, db, os.DirFS("../../database/migrations"))
	if err != nil {
		t.Fatal(err)
	}
	if _, err := provider.UpTo(ctx, 3); err != nil {
		t.Fatal(err)
	}
	if _, err := pool.Exec(ctx, `INSERT INTO posts (title, slug, content, summary, cover_url, status, kind, visibility)
		VALUES ('Article', 'legacy-article', 'Article body', 'Article summary', '', 'published', 'article', 'private'),
		('Essay', 'legacy-essay', 'Essay body', 'Essay summary', '', 'published', 'essay', 'private'),
		('Draft', 'legacy-draft', 'Draft body', '', '', 'draft', 'essay', 'private')`); err != nil {
		t.Fatal(err)
	}
	if _, err := provider.Up(ctx); err != nil {
		t.Fatal(err)
	}
	svc := NewService(NewRepository(pool))
	for _, slug := range []string{"legacy-article"} {
		post, err := svc.GetPost(ctx, anonymousViewer, slug)
		if err != nil || post == nil || post.Slug != slug || post.Content == "" || post.Summary == "" || post.CreatedAt.IsZero() {
			t.Fatalf("migrated published content %s = %+v, error=%v", slug, post, err)
		}
	}
	for _, slug := range []string{"legacy-draft", "legacy-essay"} {
		if _, err := svc.GetPost(ctx, anonymousViewer, slug); err != ErrPostNotFound {
			t.Fatalf("migrated private content %s error=%v, want ErrPostNotFound", slug, err)
		}
	}
	post, err := svc.CreatePost(ctx, ownerViewer, CreatePostReq{
		Title: "New essay", Slug: "new-essay", Content: "New body", Summary: "New summary",
		Kind: KindEssay, Status: StatusPublished, Tags: []string{"published-tag"},
	})
	if err != nil || post == nil || post.Kind != KindEssay || post.PublishedAt == nil || len(post.Tags) != 1 {
		t.Fatalf("create published essay = %+v, error=%v", post, err)
	}
	if _, err := svc.CreatePost(ctx, ownerViewer, CreatePostReq{
		Title: "Draft essay", Slug: "new-draft", Content: "Draft body", Kind: KindEssay, Tags: []string{"draft-only-tag"},
	}); err != nil {
		t.Fatal(err)
	}
	posts, total, err := svc.ListPosts(ctx, anonymousViewer, ListPostsReq{Kind: KindEssay})
	if err != ErrUnauthorized || total != 0 || len(posts) != 0 {
		t.Fatalf("anonymous essays = %+v, total=%d, error=%v", posts, total, err)
	}
	tags, err := svc.ListTags(ctx, anonymousViewer, KindEssay)
	if err != ErrUnauthorized || len(tags) != 0 {
		t.Fatalf("anonymous essay tags = %+v, error=%v", tags, err)
	}

	if post, err := NewRepository(pool).GetPublicPostBySlug(ctx, "new-essay"); err != nil || post != nil {
		t.Fatalf("public repository query leaked published essay: post=%+v error=%v", post, err)
	}
	if post, err := svc.GetPost(ctx, ownerViewer, "new-essay"); err != nil || post == nil {
		t.Fatalf("owner cannot read published essay: post=%+v error=%v", post, err)
	}
	t.Run("post tags remain independent", func(t *testing.T) {
		if _, err := svc.CreatePost(ctx, ownerViewer, CreatePostReq{
			Title: "Tagged article", Slug: "tagged-article", Content: "Article body", Status: StatusPublished,
			Kind: KindArticle, Tags: []string{" published-tag ", "published-tag"},
		}); err != nil {
			t.Fatal(err)
		}
		for _, names := range [][]string{{"改名后的标签", "新增标签"}, {}} {
			updated, err := svc.UpdatePost(ctx, ownerViewer, "tagged-article", UpdatePostReq{Tags: names})
			if err != nil || len(updated.Tags) != len(names) || updated.Content != "Article body" {
				t.Fatalf("update current tags=%+v error=%v", updated, err)
			}
			other, err := svc.GetPost(ctx, ownerViewer, "new-essay")
			if err != nil || len(other.Tags) != 1 || other.Tags[0] != "published-tag" {
				t.Fatalf("other content tags changed=%+v error=%v", other, err)
			}
		}
		aggregate, err := svc.ListTags(ctx, ownerViewer, KindArticle)
		if err != nil || len(aggregate) != 0 {
			t.Fatalf("unused tag names must not appear in article filters: tags=%+v error=%v", aggregate, err)
		}
	})
	status := StatusDraft
	if _, err := svc.UpdatePost(ctx, ownerViewer, "new-essay", UpdatePostReq{Status: &status}); err != nil {
		t.Fatal(err)
	}
	if _, err := svc.GetPost(ctx, anonymousViewer, "new-essay"); err != ErrPostNotFound {
		t.Fatalf("unpublished essay error=%v, want ErrPostNotFound", err)
	}
	if _, err := provider.Down(ctx); err != nil {
		t.Fatalf("migration rollback: %v", err)
	}
	if _, err := provider.Up(ctx); err != nil {
		t.Fatalf("migration reapply: %v", err)
	}
}
