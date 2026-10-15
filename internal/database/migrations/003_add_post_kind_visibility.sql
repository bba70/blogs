-- +goose Up
ALTER TABLE posts ADD COLUMN kind       VARCHAR(20) NOT NULL DEFAULT 'article';
ALTER TABLE posts ADD COLUMN visibility VARCHAR(20) NOT NULL DEFAULT 'public';

ALTER TABLE posts ADD CONSTRAINT posts_kind_check       CHECK (kind IN ('article', 'essay'));
ALTER TABLE posts ADD CONSTRAINT posts_visibility_check CHECK (visibility IN ('public', 'private'));

-- +goose Down
ALTER TABLE posts DROP CONSTRAINT IF EXISTS posts_visibility_check;
ALTER TABLE posts DROP CONSTRAINT IF EXISTS posts_kind_check;
ALTER TABLE posts DROP COLUMN IF EXISTS visibility;
ALTER TABLE posts DROP COLUMN IF EXISTS kind;
