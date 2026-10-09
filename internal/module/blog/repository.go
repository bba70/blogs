package blog

import (
	"context"
	"errors"
	"fmt"
	"strings"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
)

// isUniqueViolation 判断是否为唯一约束冲突（PostgreSQL 错误码 23505）。
func isUniqueViolation(err error) bool {
	var pgErr *pgconn.PgError
	return errors.As(err, &pgErr) && pgErr.Code == "23505"
}

type Repository struct {
	db *pgxpool.Pool
}

func NewRepository(db *pgxpool.Pool) *Repository {
	return &Repository{db: db}
}

// --------------- Posts ---------------

func (r *Repository) ListPosts(ctx context.Context, req ListPostsReq) ([]Post, int64, error) {
	var where []string
	var args []interface{}
	argIdx := 1

	if req.Status != "" {
		where = append(where, fmt.Sprintf("p.status = $%d", argIdx))
		args = append(args, req.Status)
		argIdx++
	}
	if req.Tag != "" {
		where = append(where, fmt.Sprintf(`EXISTS (
			SELECT 1 FROM post_tags pt JOIN tags t ON t.id = pt.tag_id
			WHERE pt.post_id = p.id AND t.name = $%d
		)`, argIdx))
		args = append(args, req.Tag)
		argIdx++
	}

	whereClause := ""
	if len(where) > 0 {
		whereClause = "WHERE " + strings.Join(where, " AND ")
	}

	var total int64
	countSQL := fmt.Sprintf("SELECT COUNT(*) FROM posts p %s", whereClause)
	if err := r.db.QueryRow(ctx, countSQL, args...).Scan(&total); err != nil {
		return nil, 0, err
	}

	offset := (req.Page - 1) * req.PerPage
	querySQL := fmt.Sprintf(`SELECT p.id, p.title, p.slug, p.content, p.summary, p.cover_url, p.status,
		p.created_at, p.updated_at, p.published_at,
		COALESCE(array_agg(t.name) FILTER (WHERE t.name IS NOT NULL), '{}') AS tags
		FROM posts p
		LEFT JOIN post_tags pt ON pt.post_id = p.id
		LEFT JOIN tags t ON t.id = pt.tag_id
		%s
		GROUP BY p.id
		ORDER BY p.created_at DESC
		LIMIT $%d OFFSET $%d`, whereClause, argIdx, argIdx+1)

	args = append(args, req.PerPage, offset)

	rows, err := r.db.Query(ctx, querySQL, args...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	var posts []Post
	for rows.Next() {
		var p Post
		if err := rows.Scan(&p.ID, &p.Title, &p.Slug, &p.Content, &p.Summary, &p.CoverURL,
			&p.Status, &p.CreatedAt, &p.UpdatedAt, &p.PublishedAt, &p.Tags,
		); err != nil {
			return nil, 0, err
		}
		posts = append(posts, p)
	}
	return posts, total, rows.Err()
}

func (r *Repository) GetPostBySlug(ctx context.Context, slug string) (*Post, error) {
	return r.getPostBySlug(ctx, `WHERE p.slug = $1`, slug)
}

// GetPublishedPostBySlug 按 slug 读取文章，且 SQL 层限定只返回已发布文章。
// 匿名详情读取必须走该查询，避免先读出草稿再在上层泄露。
func (r *Repository) GetPublishedPostBySlug(ctx context.Context, slug string) (*Post, error) {
	return r.getPostBySlug(ctx, `WHERE p.slug = $1 AND p.status = $2`, slug, StatusPublished)
}

func (r *Repository) getPostBySlug(ctx context.Context, whereClause string, args ...any) (*Post, error) {
	var p Post
	query := `SELECT p.id, p.title, p.slug, p.content, p.summary, p.cover_url, p.status,
		p.created_at, p.updated_at, p.published_at,
		COALESCE(array_agg(t.name) FILTER (WHERE t.name IS NOT NULL), '{}') AS tags
		FROM posts p
		LEFT JOIN post_tags pt ON pt.post_id = p.id
		LEFT JOIN tags t ON t.id = pt.tag_id
		` + whereClause + `
		GROUP BY p.id`

	err := r.db.QueryRow(ctx, query, args...).Scan(&p.ID, &p.Title, &p.Slug, &p.Content, &p.Summary, &p.CoverURL,
		&p.Status, &p.CreatedAt, &p.UpdatedAt, &p.PublishedAt, &p.Tags,
	)
	if err == pgx.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &p, nil
}

func (r *Repository) CreatePost(ctx context.Context, p *Post) error {
	err := r.db.QueryRow(ctx,
		`INSERT INTO posts (title, slug, content, summary, status, published_at, cover_url)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
		RETURNING id, created_at, updated_at`,
		p.Title, p.Slug, p.Content, p.Summary, p.Status, p.PublishedAt, p.CoverURL,
	).Scan(&p.ID, &p.CreatedAt, &p.UpdatedAt)
	if isUniqueViolation(err) {
		return ErrSlugExists
	}
	return err
}

func (r *Repository) UpdatePost(ctx context.Context, slug string, p *UpdatePostReq) (*Post, error) {
	var sets []string
	var args []interface{}
	argIdx := 1

	addSet := func(col string, val interface{}) {
		sets = append(sets, fmt.Sprintf("%s = $%d", col, argIdx))
		args = append(args, val)
		argIdx++
	}

	if p.Title != nil {
		addSet("title", *p.Title)
	}
	if p.Slug != nil {
		addSet("slug", *p.Slug)
	}
	if p.Content != nil {
		addSet("content", *p.Content)
	}
	if p.Summary != nil {
		addSet("summary", *p.Summary)
	}
	if p.CoverURL != nil {
		addSet("cover_url", *p.CoverURL)
	}
	if p.Status != nil {
		addSet("status", *p.Status)
		if *p.Status == StatusPublished {
			// 首次发布记录时间；取消发布后再发布保留原发布时间。
			sets = append(sets, "published_at = COALESCE(published_at, NOW())")
		}
	}

	if len(sets) == 0 && p.Tags == nil {
		return r.GetPostBySlug(ctx, slug)
	}

	// updated_at 直接由数据库生成，不能作为绑定参数传入。
	sets = append(sets, "updated_at = NOW()")

	args = append(args, slug)
	whereIdx := argIdx

	query := fmt.Sprintf("UPDATE posts SET %s WHERE slug = $%d RETURNING id", strings.Join(sets, ", "), whereIdx)

	var id int64
	if err := r.db.QueryRow(ctx, query, args...).Scan(&id); err != nil {
		if err == pgx.ErrNoRows {
			return nil, nil
		}
		if isUniqueViolation(err) {
			return nil, ErrSlugExists
		}
		return nil, err
	}

	if p.Tags != nil {
		if err := r.SyncPostTags(ctx, id, p.Tags); err != nil {
			return nil, err
		}
	}

	// slug 可能被本次更新修改，需按新 slug 回读。
	newSlug := slug
	if p.Slug != nil {
		newSlug = *p.Slug
	}
	return r.GetPostBySlug(ctx, newSlug)
}

func (r *Repository) DeletePost(ctx context.Context, slug string) error {
	tag, err := r.db.Exec(ctx, `DELETE FROM posts WHERE slug = $1`, slug)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return pgx.ErrNoRows
	}
	return nil
}

// --------------- Tags ---------------

func (r *Repository) ListTags(ctx context.Context) ([]Tag, error) {
	return r.queryTags(ctx, `SELECT id, name FROM tags ORDER BY name`)
}

// ListPublicTags 只返回至少被一篇已发布文章使用的标签，
// 避免仅被草稿引用的标签泄露给游客。
func (r *Repository) ListPublicTags(ctx context.Context) ([]Tag, error) {
	return r.queryTags(ctx, `
		SELECT DISTINCT t.id, t.name
		FROM tags t
		JOIN post_tags pt ON pt.tag_id = t.id
		JOIN posts p ON p.id = pt.post_id
		WHERE p.status = $1
		ORDER BY t.name`, StatusPublished)
}

func (r *Repository) queryTags(ctx context.Context, query string, args ...any) ([]Tag, error) {
	rows, err := r.db.Query(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var tags []Tag
	for rows.Next() {
		var t Tag
		if err := rows.Scan(&t.ID, &t.Name); err != nil {
			return nil, err
		}
		tags = append(tags, t)
	}
	return tags, rows.Err()
}

func (r *Repository) EnsureTags(ctx context.Context, names []string) error {
	if len(names) == 0 {
		return nil
	}
	for _, name := range names {
		_, err := r.db.Exec(ctx, `INSERT INTO tags (name) VALUES ($1) ON CONFLICT DO NOTHING`, name)
		if err != nil {
			return fmt.Errorf("ensure tag %q: %w", name, err)
		}
	}
	return nil
}

func (r *Repository) SyncPostTags(ctx context.Context, postID int64, tagNames []string) error {
	_, err := r.db.Exec(ctx, `DELETE FROM post_tags WHERE post_id = $1`, postID)
	if err != nil {
		return err
	}

	if len(tagNames) == 0 {
		return nil
	}

	if err := r.EnsureTags(ctx, tagNames); err != nil {
		return err
	}

	for _, name := range tagNames {
		_, err := r.db.Exec(ctx,
			`INSERT INTO post_tags (post_id, tag_id) SELECT $1, id FROM tags WHERE name = $2`,
			postID, name,
		)
		if err != nil {
			return err
		}
	}
	return nil
}
