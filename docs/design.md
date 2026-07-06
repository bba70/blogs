# Blogs — 设计架构报告

## 1. 项目概述

个人博客系统，Go + React 技术栈，模块化单体架构。长期迭代试验田项目，按阶段引入用户、评论、图床、AI 等能力。

---

## 2. 技术选型

| 层次 | 技术 | 理由 |
|------|------|------|
| 后端语言 | Go 1.26+ | 高性能，原生并发 |
| 前端框架 | React + TypeScript + Vite | 组件化，热更新快 |
| 数据库 | PostgreSQL 17 | 功能丰富，JSON 支持 |
| SQL 生成 | sqlc（可选） | 类型安全，代码即查询 |
| 数据库迁移 | goose v3 | 轻量，SQL 文件易审查 |
| HTTP 路由 | chi | 轻量，中间件生态好 |
| 数据库驱动 | pgx v5 | 性能优于 database/sql |
| CORS | go-chi/cors | 与 chi 无缝集成 |
| 前端状态 | Zustand | 极简，无 boilerplate |
| Markdown 编辑 | Milkdown | 插件化，ProseMirror 内核 |

---

## 3. 目录结构

```
blogs/
├── cmd/server/main.go          # 入口
├── internal/
│   ├── config/config.go        # 配置加载（环境变量）
│   ├── database/
│   │   ├── database.go         # 连接池 + goose 迁移
│   │   └── migrations/         # SQL 迁移文件
│   ├── module/                 # 业务模块（各模块自包含）
│   │   └── blog/               # 博客核心
│   │       ├── model.go        # 数据结构
│   │       ├── repository.go   # 数据读写
│   │       ├── service.go      # 业务逻辑
│   │       ├── handler.go      # HTTP 处理
│   │       └── routes.go       # 路由注册
│   ├── middleware/middleware.go # 日志、Recover 等
│   └── pkg/response/response.go # 统一响应
├── web/                        # React 前端
├── docker-compose.yml          # 可选：PostgreSQL 容器（Docker 环境）
├── dev.bat                     # Windows 一键启动脚本
├── Makefile                    # 构建/迁移/开发命令
├── go.mod / go.sum             # Go 依赖
└── docs/                       # 设计文档（本文件）
```

### 模块内分层（依赖单向：handler → service → repository）

```
handler.go    HTTP 请求/响应，参数解析
service.go    业务规则，不依赖 HTTP
repository.go 纯 SQL 读写，无业务逻辑
model.go      数据结构定义
routes.go     路由注册
```

---

## 4. 架构原则

- **模块化单体**：按领域拆分模块，每个模块边界清晰，未来可拆为独立微服务
- **依赖倒置**：上层不依赖下层实现细节，通过接口解耦
- **无全局状态**：依赖通过构造函数注入
- **统一响应格式**：所有 API 返回相同 JSON 结构
- **声明式迁移**： goose SQL 文件，版本追踪

---

## 5. 配置

通过环境变量注入，默认值见下表。

| 环境变量 | 默认值 | 说明 |
|---------|--------|------|
| `SERVER_PORT` | `8080` | 服务端口 |
| `DB_HOST` | `localhost` | 数据库地址 |
| `DB_PORT` | `5432` | 数据库端口 |
| `DB_USER` | `blogs` | 数据库用户名 |
| `DB_PASSWORD` | `blogs` | 数据库密码 |
| `DB_NAME` | `blogs` | 数据库名 |
| `DB_SSLMODE` | `disable` | SSL 模式 |

配置加载：[`internal/config/config.go`](internal/config/config.go)

---

## 6. 数据库设计

### 6.1 Schema

```sql
-- 文章表
posts (
    id           BIGSERIAL PRIMARY KEY,
    title        VARCHAR(255)  NOT NULL,
    slug         VARCHAR(255)  UNIQUE NOT NULL,   -- URL 友好标识
    content      TEXT          NOT NULL DEFAULT '',
    summary      VARCHAR(500)  DEFAULT '',
    status       VARCHAR(20)   NOT NULL DEFAULT 'draft',  -- draft / published
    created_at   TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    published_at TIMESTAMPTZ
);

-- 标签表
tags (
    id   BIGSERIAL PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL
);

-- 文章-标签关联表
post_tags (
    post_id BIGINT REFERENCES posts(id) ON DELETE CASCADE,
    tag_id  BIGINT REFERENCES tags(id) ON DELETE CASCADE,
    PRIMARY KEY (post_id, tag_id)
);
```

### 6.2 索引

```sql
CREATE INDEX idx_posts_slug    ON posts(slug);
CREATE INDEX idx_posts_status  ON posts(status);
CREATE INDEX idx_posts_created ON posts(created_at DESC);
```

### 6.3 迁移文件

- [`001_create_posts_tags.sql`](internal/database/migrations/001_create_posts_tags.sql)

---

## 7. 统一响应格式

```json
{
  "code":    0,           // 业务状态码，0 = 成功
  "message": "success",   // 提示消息
  "data":    { ... },     // 响应数据
  "meta": {               // 分页信息（列表时存在）
    "page":    1,
    "per_page": 10,
    "total":   100
  }
}
```

错误响应：

```json
{ "code": 2, "message": "post not found" }
{ "code": 3, "message": "invalid request body" }
```

实现：[`internal/pkg/response/response.go`](internal/pkg/response/response.go)

---

## 8. API 接口文档

**Base URL**: `http://localhost:8080/api/v1`

### 8.1 文章

#### 获取文章列表

```http
GET /api/v1/posts?page=1&per_page=10&status=published&tag=go
```

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `page` | int | 否 | 页码，默认 1 |
| `per_page` | int | 否 | 每页数量，默认 10 |
| `status` | string | 否 | 筛选状态：`draft` / `published` |
| `tag` | string | 否 | 按标签筛选 |

**响应示例：**

```json
{
  "code": 0,
  "message": "success",
  "data": [
    {
      "id": 1,
      "title": "Hello World",
      "slug": "hello-world",
      "content": "...",
      "summary": "...",
      "status": "published",
      "tags": ["go", "web"],
      "created_at": "2024-01-01T00:00:00Z",
      "updated_at": "2024-01-01T00:00:00Z",
      "published_at": "2024-01-01T00:00:00Z"
    }
  ],
  "meta": { "page": 1, "per_page": 10, "total": 42 }
}
```

---

#### 获取文章详情

```http
GET /api/v1/posts/{slug}
```

| 参数 | 类型 | 说明 |
|------|------|------|
| `slug` | string | 文章 slug（URL 路径参数） |

**响应示例：**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "id": 1,
    "title": "Hello World",
    "slug": "hello-world",
    "content": "...",
    "summary": "...",
    "status": "published",
    "tags": ["go", "web"],
    "created_at": "2024-01-01T00:00:00Z",
    "updated_at": "2024-01-01T00:00:00Z",
    "published_at": "2024-01-01T00:00:00Z"
  }
}
```

---

#### 创建文章

```http
POST /api/v1/posts
Content-Type: application/json
```

**请求体：**

```json
{
  "title":   "Hello World",
  "slug":    "hello-world",
  "content": "# Hello\n\n正文内容...",
  "summary": "文章摘要",
  "status":  "draft",          // draft（默认）/ published
  "tags":    ["go", "web"]     // 可选
}
```

> `title` 和 `slug` 必填。`status=published` 时自动设置 `published_at`。

**响应：** 201 Created，返回完整文章对象（同详情接口）

---

#### 更新文章

```http
PUT /api/v1/posts/{slug}
Content-Type: application/json
```

**请求体：**

```json
{
  "title":   "New Title",      // 可选
  "content": "New content",    // 可选
  "summary": "New summary",    // 可选
  "status":  "published",      // 可选
  "tags":    ["go", "react"]   // 可选，覆盖旧标签
}
```

**响应：** 200 OK，返回更新后的完整文章对象

---

#### 删除文章

```http
DELETE /api/v1/posts/{slug}
```

**响应：** 204 No Content

---

### 8.2 标签

#### 获取所有标签

```http
GET /api/v1/tags
```

**响应：**

```json
{
  "code": 0,
  "message": "success",
  "data": [
    { "id": 1, "name": "go" },
    { "id": 2, "name": "web" }
  ]
}
```

---

### 8.3 健康检查

```http
GET /health
```

**响应：** `200 OK`，plain text `ok`

---

## 9. 中间件

| 中间件 | 来源 | 作用 |
|--------|------|------|
| CORS | `go-chi/cors` | 跨域配置，允许所有来源 |
| RequestID | `go-chi/chi/middleware` | 生成请求 ID（`X-Request-ID`） |
| RealIP | `go-chi/chi/middleware` | 解析真实客户端 IP |
| Logger | [`internal/middleware`](internal/middleware/middleware.go) | 结构化日志输出（method, path, status, duration） |
| Recoverer | `go-chi/chi/middleware` | panic 恢复，返回 500 |

---

## 10. 错误码约定

| 码 | HTTP 状态 | 含义 |
|----|-----------|------|
| `0` | — | 成功 |
| `1` | 500 | 内部错误 |
| `2` | 404 | 资源不存在 |
| `3` | 400 | 请求参数错误 |

---

## 11. 开发工作流

> **Docker 非必须** — 可直接连接本地 PostgreSQL，跳过 `docker-compose` 步骤。
> 默认连接 `localhost:5432`，账号密码通过环境变量覆盖。

### 方式一：本地 PostgreSQL（推荐）

```powershell
# 确保本地 PostgreSQL 已运行，且有目标数据库和账号
# 默认期望：用户 blogs / 密码 blogs / 数据库 blogs
# 若账号不同，设置环境变量覆盖：
$env:DB_USER="your_user"; $env:DB_PASSWORD="your_pass"; $env:DB_NAME="your_db"

# 运行迁移 + 启动服务
go run cmd/server/main.go

# 或双击 dev.bat（需先设置好环境变量）
```

### 方式二：Docker PostgreSQL

```powershell
# 启动数据库容器
docker compose up -d

# 运行迁移 + 启动服务
go run cmd/server/main.go

# 或使用 Makefile（需安装 make）
make dev
```

### Makefile 命令

| 命令 | 作用 |
|------|------|
| `make dev` | 启动 DB + 运行服务 |
| `make build` | 编译为 `bin/server` |
| `make run` | 编译并运行 |
| `make migrate-up` | 执行未执行迁移 |
| `make migrate-down` | 回退最后一次迁移 |
| `make tidy` | 整理依赖 |

---

## 12. Phase 2 规划

| 模块 | 内容 |
|------|------|
| **认证** | JWT（access + refresh），注册/登录，角色（admin / user） |
| **评论** | 文章评论，嵌套回复 |
| **后台管理** | 文章管理，标签管理，草稿发布 |
| **前端** | Markdown 编辑器，文章列表/详情页，登录页 |
