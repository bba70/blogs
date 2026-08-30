# Blog System

Go + React 个人博客系统，作为长期试验田项目。

## Documentation

项目文档位于 [`docs/`](docs/)，按 phase 和改动单元组织。产品功能改动保留两份定义：

- `product.md` — 本次功能及其产品形态
- `design.md` — 前端、后端与数据层的实现设计

纯工程、基础设施或配置改动可以只保留 `design.md`，无需创建产品定义。

全局视觉规范单独维护在 [`docs/ui/`](docs/ui/)，目录约定和现有文档索引见 [`docs/README.md`](docs/README.md)。

## Tech Stack

| Layer | Choice | Rationale |
|-------|--------|-----------|
| Backend | Go 1.24+ | 高性能，并发友好 |
| Frontend | TypeScript + React | 组件化，生态丰富 |
| Database | PostgreSQL | 功能丰富，适合长期迭代 |
| DB Migration | goose | 轻量，Go 原生，SQL 文件易管理 |
| HTTP Router | chi | 轻量兼容 net/http，中间件生态好 |
| DB Access | sqlc | 类型安全，SQL 可控，性能优于 ORM |
| Frontend Build | Vite | 快，开箱即用 |
| Markdown Editor | Milkdown | 插件化架构，扩展性强，基于 ProseMirror |
| Auth | JWT (access + refresh token) | 无状态，适合后续 API 扩展 |

## Architecture: Modular Monolith

按模块组织代码，每个模块有清晰边界，未来需要时可拆分为独立服务。

### 目录结构

```
blogs/
├── cmd/                        # 应用入口
│   └── server/
│       └── main.go
│
├── internal/                   # 私有代码，不可被外部导入
│   ├── config/                 # 配置加载
│   ├── database/               # 数据库连接、迁移
│   │   └── migrations/
│   ├── module/                 # 业务模块（每个模块自包含）
│   │   ├── blog/               # 博客核心
│   │   ├── auth/               # 认证（Phase 3）
│   │   ├── media/              # 图床/文件（Phase 4）
│   │   └── comment/            # 评论（Phase 3）
│   ├── middleware/              # 全局中间件
│   └── pkg/                    # 内部共享工具
│
├── web/                        # React 前端
│   ├── src/
│   │   ├── api/                # API 调用层
│   │   ├── components/         # 通用组件
│   │   ├── modules/            # 业务模块
│   │   ├── pages/              # 页面
│   │   ├── stores/             # 状态管理（Zustand）
│   │   └── types/              # TypeScript 类型
│   └── ...
│
├── docker-compose.yml
├── Makefile
├── go.mod
└── go.sum
```

### 模块内部分层

每个模块遵循相同的分层模式，依赖方向单向：`handler → service → repository`

```
module/blog/
├── model.go        # 数据结构定义
├── repository.go   # 纯数据读写
├── service.go      # 业务逻辑，不依赖 HTTP
├── handler.go      # HTTP 请求处理
└── routes.go       # 路由注册
```

## API Design

基础路径: `/api/v1`

### 博客

| Method | Path | Description |
|--------|------|-------------|
| GET | /api/v1/posts | 文章列表（分页、筛选） |
| GET | /api/v1/posts/:slug | 文章详情 |
| POST | /api/v1/posts | 创建文章（需认证） |
| PUT | /api/v1/posts/:slug | 更新文章 |
| DELETE | /api/v1/posts/:slug | 删除文章 |
| GET | /api/v1/tags | 标签列表 |

### 认证（Phase 3）

| Method | Path | Description |
|--------|------|-------------|
| POST | /api/v1/auth/login | 登录 |
| POST | /api/v1/auth/refresh | 刷新 Token |

### 媒体（Phase 4）

| Method | Path | Description |
|--------|------|-------------|
| POST | /api/v1/media/upload | 上传文件 |
| GET | /api/v1/media/:id | 获取文件 |

### 统一响应格式

```json
{
  "code": 0,
  "message": "success",
  "data": { },
  "meta": { "page": 1, "per_page": 10, "total": 100 }
}
```

## Database Schema

```sql
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
```

## Implementation Phases

### Phase 1: 博客核心（已完成）

- [x] 项目初始化（Go module、docker-compose、Makefile）
- [x] 后端骨架（config、database、统一响应、中间件）
- [x] 博客 CRUD API（posts + tags）
- [x] 前端初始化（Vite + React + TypeScript、路由、API 层）
- [x] 前端页面（文章列表、文章详情、Markdown 编辑器、标签管理）

### Phase 2: 容器化与运行配置（已完成）

- [x] Go 后端多阶段镜像
- [x] React 构建与 Nginx 静态服务镜像
- [x] PostgreSQL、API、Web 完整 Compose 编排
- [x] 健康检查、启动依赖和环境变量示例
- [x] Linux、macOS、Windows 一键启动脚本

### Phase 3: 用户系统 + 评论（未开始）

- [ ] 用户注册/登录（JWT）
- [ ] 角色权限（admin / user）
- [ ] 评论系统（支持回复）
- [ ] 后台管理面板

### Phase 4: 图床 + 媒体（未开始）

- [ ] 图片上传（本地 / OSS）
- [ ] 图片压缩、缩略图
- [ ] 媒体库管理

### Phase 5: 试验田功能（未开始）

- [ ] 音视频处理
- [ ] AI 助手集成
- [ ] 数据统计面板
