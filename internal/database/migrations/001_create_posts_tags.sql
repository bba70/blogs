-- +goose Up
CREATE TABLE posts (
    id           BIGSERIAL PRIMARY KEY,
    title        VARCHAR(255) NOT NULL,
    slug         VARCHAR(255) UNIQUE NOT NULL,
    content      TEXT NOT NULL DEFAULT '',
    summary      VARCHAR(500) DEFAULT '',
    status       VARCHAR(20) NOT NULL DEFAULT 'draft',
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    published_at TIMESTAMPTZ
);

CREATE TABLE tags (
    id   BIGSERIAL PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL
);

CREATE TABLE post_tags (
    post_id BIGINT REFERENCES posts(id) ON DELETE CASCADE,
    tag_id  BIGINT REFERENCES tags(id) ON DELETE CASCADE,
    PRIMARY KEY (post_id, tag_id)
);

CREATE INDEX idx_posts_slug    ON posts(slug);
CREATE INDEX idx_posts_status  ON posts(status);
CREATE INDEX idx_posts_created ON posts(created_at DESC);

-- +goose Down
DROP TABLE IF EXISTS post_tags;
DROP TABLE IF EXISTS tags;
DROP TABLE IF EXISTS posts;
