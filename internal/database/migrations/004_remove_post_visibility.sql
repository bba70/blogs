-- +goose Up
-- Articles and essays are public once published; draft access remains author-only.
ALTER TABLE posts DROP COLUMN visibility;

-- +goose Down
-- The old private/public choices cannot be recovered after this migration.
ALTER TABLE posts ADD COLUMN visibility VARCHAR(20) NOT NULL DEFAULT 'public';
ALTER TABLE posts ADD CONSTRAINT posts_visibility_check CHECK (visibility IN ('public', 'private'));
