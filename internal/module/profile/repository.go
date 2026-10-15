package profile

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type Repository struct {
	db *pgxpool.Pool
}

func NewRepository(db *pgxpool.Pool) *Repository {
	return &Repository{db: db}
}

// Get 读取单行作者资料。种子行缺失时按“未设置头像”返回，
// 不让资料读取失败影响页面渲染。
func (r *Repository) Get(ctx context.Context) (*Profile, error) {
	var p Profile
	err := r.db.QueryRow(ctx, `SELECT avatar_url, updated_at FROM site_profile WHERE id = 1`).
		Scan(&p.AvatarURL, &p.UpdatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return &Profile{}, nil
	}
	if err != nil {
		return nil, err
	}
	return &p, nil
}

// UpdateAvatarURL 写入头像地址。使用 upsert 以兼容种子行被清理的历史数据。
func (r *Repository) UpdateAvatarURL(ctx context.Context, avatarURL string) (*Profile, error) {
	var p Profile
	err := r.db.QueryRow(ctx, `
		INSERT INTO site_profile (id, avatar_url) VALUES (1, $1)
		ON CONFLICT (id) DO UPDATE SET avatar_url = EXCLUDED.avatar_url, updated_at = NOW()
		RETURNING avatar_url, updated_at`, avatarURL).Scan(&p.AvatarURL, &p.UpdatedAt)
	if err != nil {
		return nil, err
	}
	return &p, nil
}
