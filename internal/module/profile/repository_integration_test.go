package profile

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

// 在一次性 schema 中验证 005 迁移与作者资料读写，不影响应用自身的表。
func TestProfileMigrationAndRepository(t *testing.T) {
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

	schema := fmt.Sprintf("blog_profile_%d", time.Now().UnixNano())
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
	if _, err := provider.Up(ctx); err != nil {
		t.Fatal(err)
	}

	repo := NewRepository(pool)
	// 迁移必须留下单行资料，使读取路径无需处理“行不存在”。
	current, err := repo.Get(ctx)
	if err != nil || current == nil || current.AvatarURL != "" || current.UpdatedAt.IsZero() {
		t.Fatalf("seeded profile = %+v, error=%v", current, err)
	}

	const avatarURL = "/api/v1/media/0123456789abcdef0123456789abcdef.png"
	updated, err := repo.UpdateAvatarURL(ctx, avatarURL)
	if err != nil || updated.AvatarURL != avatarURL {
		t.Fatalf("update avatar = %+v, error=%v", updated, err)
	}
	reloaded, err := repo.Get(ctx)
	if err != nil || reloaded.AvatarURL != avatarURL {
		t.Fatalf("reloaded profile = %+v, error=%v", reloaded, err)
	}

	// 重复写入依赖 upsert，不能产生第二行资料。
	if _, err := repo.UpdateAvatarURL(ctx, ""); err != nil {
		t.Fatal(err)
	}
	var rows int
	if err := pool.QueryRow(ctx, `SELECT COUNT(*) FROM site_profile`).Scan(&rows); err != nil {
		t.Fatal(err)
	}
	if rows != 1 {
		t.Fatalf("site_profile rows=%d", rows)
	}

	if _, err := provider.Down(ctx); err != nil {
		t.Fatalf("migration rollback: %v", err)
	}
	if _, err := provider.Up(ctx); err != nil {
		t.Fatalf("migration reapply: %v", err)
	}
}
