package blog

import (
	"context"
	"fmt"
	"strings"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

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
	querySQL := fmt.Sprintf(`SELECT p.id, p.title, p.slug, p.content, p.summary, p.status,
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
		if err := rows.Scan(&p.ID, &p.Title, &p.Slug, &p.Content, &p.Summary,
			&p.Status, &p.CreatedAt, &p.UpdatedAt, &p.PublishedAt, &p.Tags,
		); err != nil {
			return nil, 0, err
		}
		posts = append(posts, p)
	}
	return posts, total, rows.Err()
}

func (r *Repository) GetPostBySlug(ctx context.Context, slug string) (*Post, error) {
	var p Post
	err := r.db.QueryRow(ctx, `SELECT p.id, p.title, p.slug, p.content, p.summary, p.status,
		p.created_at, p.updated_at, p.published_at,
		COALESCE(array_agg(t.name) FILTER (WHERE t.name IS NOT NULL), '{}') AS tags
		FROM posts p
		LEFT JOIN post_tags pt ON pt.post_id = p.id
		LEFT JOIN tags t ON t.id = pt.tag_id
		WHERE p.slug = $1
		GROUP BY p.id`, slug,
	).Scan(&p.ID, &p.Title, &p.Slug, &p.Content, &p.Summary,
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
	return r.db.QueryRow(ctx,
		`INSERT INTO posts (title, slug, content, summary, status, published_at)
		VALUES ($1, $2, $3, $4, $5, $6)
		RETURNING id, created_at, updated_at`,
		p.Title, p.Slug, p.Content, p.Summary, p.Status, p.PublishedAt,
	).Scan(&p.ID, &p.CreatedAt, &p.UpdatedAt)
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
	if p.Content != nil {
		addSet("content", *p.Content)
	}
	if p.Summary != nil {
		addSet("summary", *p.Summary)
	}
	if p.Status != nil {
		addSet("status", *p.Status)
	}

	if len(sets) == 0 && p.Tags == nil {
		return r.GetPostBySlug(ctx, slug)
	}

	sets = append(sets, fmt.Sprintf("updated_at = $%d", argIdx))
	args = append(args, "NOW()")
	argIdx++

	args = append(args, slug)
	whereIdx := argIdx

	query := fmt.Sprintf("UPDATE posts SET %s WHERE slug = $%d RETURNING id", strings.Join(sets, ", "), whereIdx)

	var id int64
	if err := r.db.QueryRow(ctx, query, args...).Scan(&id); err != nil {
		if err == pgx.ErrNoRows {
			return nil, nil
		}
		return nil, err
	}

	if p.Tags != nil {
		if err := r.syncPostTags(ctx, id, p.Tags); err != nil {
			return nil, err
		}
	}

	return r.GetPostBySlug(ctx, slug)
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
	rows, err := r.db.Query(ctx, `SELECT id, name FROM tags ORDER BY name`)
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

func (r *Repository) syncPostTags(ctx context.Context, postID int64, tagNames []string) error {
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
