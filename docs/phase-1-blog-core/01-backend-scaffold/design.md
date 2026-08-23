# 01 Backend Scaffold — Design

> Commit: `a3251cb` feat(backend): scaffold Go backend with blog module
> Phase: 1（博客核心）
> Status: 已完成

## 目标

搭建后端骨架并实现博客核心 CRUD（posts + tags），为后续 phase 的认证、评论、媒体等模块奠定模块化单体架构基础。

## 范围

- 项目脚手架（go.mod、Makefile、docker-compose、dev.bat）
- 配置加载（环境变量）
- 数据库连接池 + 迁移机制
- 统一响应格式 + 错误码
- HTTP 中间件（CORS、日志、recover、RequestID）
- Blog 模块完整 CRUD（5 个 endpoint + 1 个 tags 列表 + 健康检查）

**不在范围内**：认证、媒体上传、评论、测试、Dockerfile、sqlc 配置。

## 前端设计

本次改动不涉及前端。前端只需要遵守下文定义的 HTTP 接口和统一响应格式。

## 关键设计决策

### 模块化单体（Modular Monolith）而非微服务

**选择**：按业务领域划分模块（`internal/module/blog/`），模块内自包含分层，模块间通过 service 接口调用。

**理由**：
- 个人博客规模不大，微服务成本不划算
- 模块边界清晰，未来需要拆分时可按模块独立部署
- 单体部署简单，调试方便

**替代方案**：传统 MVC（model/view/controller 一锅烩）—— 拒绝，业务增长后边界模糊。

### 分层：handler → service → repository

**依赖方向单向**：上层依赖下层，下层不知道上层。

| 层 | 职责 | 不该做 |
|----|------|--------|
| handler | HTTP 解析、参数校验、响应序列化 | 业务逻辑、直接 SQL |
| service | 业务规则、状态转换 | HTTP 概念、SQL 细节 |
| repository | 纯 SQL 读写 | 业务逻辑 |

**为什么 service 不直接调 pgxpool**：让 service 可单元测试（可注入 mock repo），且 SQL 集中在 repository 便于优化。

### chi 而非 gin / echo

**选择**：[chi](https://github.com/go-chi/chi) v5

**理由**：
- 100% 兼容 `net/http`，不重新定义 handler 签名（`http.HandlerFunc`）
- 中间件生态好（CORS、RequestID、RealIP、Recoverer 开箱即用）
- 轻量，无反射魔法

**替代方案**：gin —— 拒绝，自定义 handler 签名脱离 net/http 生态。

### pgx v5 原生 API 而非 database/sql

**选择**：[pgx](https://github.com/jackc/pgx) v5，直接用 `pgxpool.Pool`

**理由**：
- 性能优于 `database/sql`（少一层抽象）
- 原生支持 PG 特性：`array_agg`、`RETURNING`、复合类型、JSONB
- `pgxpool` 自带连接池，配置灵活

**代价**：绑定 PostgreSQL，不能换 DB。但本项目从一开始就选 PG，无移植需求。

**注意**：goose 通过 `database/sql` 调用，需要 side-effect import `_ "github.com/jackc/pgx/v5/stdlib"` 注册驱动。详见 [database.go:8](../../../internal/database/database.go#L8)。

### goose 而非 golang-migrate / atlas

**选择**：[goose](https://github.com/pressly/goose) v3，SQL 文件优先

**理由**：
- 迁移用纯 SQL 写，便于审查、回滚
- Go 原生，无外部依赖
- `+goose Up` / `+goose Down` 注释标记，单文件含双向迁移

**替代方案**：golang-migrate —— 拒绝，up/down 分两个文件，文件数翻倍。

### sqlc 已选型但本期手写 SQL

**选择**：repository 手写 SQL，未配置 sqlc。

**理由**：
- Phase 1 SQL 复杂度低（CRUD + 几个 JOIN），手写可控
- sqlc 配置（`sqlc.yaml` + 生成代码）需要先稳定 schema，本期边做边改
- Phase 2 起引入 sqlc，回填 blog 模块

### 配置全走环境变量

**选择**：`internal/config/config.go` 用 `os.Getenv`，无 yaml/toml 文件。

**理由**：
- 12-Factor App 原则
- 容器化部署天然兼容
- 本地开发用 `$env:VAR=...`（PowerShell）或 `.env` 文件即可

**默认值**：见 [config.go:33-47](../../../internal/config/config.go#L33)。

### 统一响应格式

```json
{ "code": 0, "message": "success", "data": {}, "meta": {} }
```

- `code`：业务码，0 = 成功（与 HTTP 状态码独立）
- `data` / `meta`：`omitempty`，错误时省略
- 实现：[response.go](../../../internal/pkg/response/response.go)

### 错误码约定

| code | HTTP | 含义 |
|------|------|------|
| 0 | 2xx | 成功 |
| 1 | 500 | 内部错误 |
| 2 | 404 | 资源不存在 |
| 3 | 400 | 请求参数错误 |

**为什么不用 HTTP 状态码就够了**：业务码可以更细分（比如 2=未找到、4=未授权、5=禁止），HTTP 层只负责传输语义。Phase 2 引入认证后会扩展更多业务码。

### slog 结构化日志

**选择**：标准库 `log/slog`，不用 logrus/zap。

**理由**：
- Go 1.21+ 标准库，无第三方依赖
- JSON 输出原生支持，便于后续接 ELK / Loki
- 性能足够本项目规模

### 中间件链

按顺序：CORS → RequestID → RealIP → Logger → Recoverer → handler

- **CORS**：允许所有源（开发期），生产前应收紧
- **RequestID**：每请求生成 UUID，便于追踪
- **RealIP**：从 `X-Forwarded-For` 解析真实 IP
- **Logger**：自定义 `statusRecorder` 记录 status code + duration
- **Recoverer**：panic 转 500，避免进程退出

## 数据库设计

三表：`posts` / `tags` / `post_tags`（多对多关联）

- `slug` 作为 URL 标识（不是 id），便于 SEO 和人类可读
- `status`：`draft` / `published`，字符串而非 enum（PG enum 改动成本高）
- `published_at`：可空，发布时设置
- 无软删除（DELETE 直接删，靠外键 CASCADE 清理 post_tags）

详见 [001_create_posts_tags.sql](../../../internal/database/migrations/001_create_posts_tags.sql)。

## API 设计

RESTful，base path `/api/v1`：

| Method | Path | 说明 |
|--------|------|------|
| GET | /posts | 列表（page/per_page/status/tag） |
| GET | /posts/:slug | 详情 |
| POST | /posts | 创建 |
| PUT | /posts/:slug | 更新（部分字段，指针语义） |
| DELETE | /posts/:slug | 删除 |
| GET | /tags | 标签列表 |
| GET | /health | 健康检查（不进 /api/v1） |

**UpdatePostReq 用指针**：`Title *string` 而非 `Title string`，区分"不更新"和"更新为空字符串"。详见 [model.go:32-38](../../../internal/module/blog/model.go#L32)。

## 已知不足

- 无认证（任意客户端可 CRUD）—— Phase 2 补
- 无测试 —— 中优先级待办
- 无 Dockerfile —— Phase 2 前补
- sqlc 未配置 —— Phase 2 起引入

## 参考

- [本次产品定义](product.md)
