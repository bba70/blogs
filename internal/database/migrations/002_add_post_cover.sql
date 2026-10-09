-- +goose Up
ALTER TABLE posts ADD COLUMN cover_url TEXT NOT NULL DEFAULT '';

-- +goose Down
ALTER TABLE posts DROP COLUMN cover_url;
