-- +goose Up
-- 单行站点作者资料。当前只保存头像地址，姓名、简介等字段等有明确需求时再迁移。
CREATE TABLE site_profile (
    id         SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    avatar_url VARCHAR(2048) NOT NULL DEFAULT '',
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO site_profile (id) VALUES (1);

-- +goose Down
DROP TABLE IF EXISTS site_profile;
