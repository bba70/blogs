package database

import (
	"context"
	"fmt"

	"github.com/jackc/pgx/v5/pgxpool"
	_ "github.com/jackc/pgx/v5/stdlib" // registers "pgx" driver via init()
	"github.com/pressly/goose/v3"

	"github.com/bba70/blogs/internal/config"
)

func NewPool(ctx context.Context, cfg config.DBConfig) (*pgxpool.Pool, error) {
	pool, err := pgxpool.New(ctx, cfg.DSN())
	if err != nil {
		return nil, fmt.Errorf("create connection pool: %w", err)
	}
	if err := pool.Ping(ctx); err != nil {
		pool.Close()
		return nil, fmt.Errorf("ping database: %w", err)
	}
	return pool, nil
}

func RunMigrations(cfg config.DBConfig) error {
	db, err := goose.OpenDBWithDriver("pgx", cfg.DSN())
	if err != nil {
		return fmt.Errorf("open db for migration: %w", err)
	}
	defer db.Close()

	if err := goose.SetDialect("postgres"); err != nil {
		return fmt.Errorf("set goose dialect: %w", err)
	}

	if err := goose.Up(db, "internal/database/migrations"); err != nil {
		return fmt.Errorf("run migrations: %w", err)
	}
	return nil
}
