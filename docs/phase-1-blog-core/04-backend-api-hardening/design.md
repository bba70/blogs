# 04 博客接口可靠性增强 — 技术设计

> Phase: 1（博客核心）  
> Status: 已完成

## 前端设计

本次不修改前端。已有编辑器提交的 `slug` 字段在后端得到完整支持，接口响应结构保持兼容。

## 后端设计

### 模型与校验

- 使用常量统一表示 `draft`、`published` 和列表专用的 `all`，避免业务层散落字符串字面量。
- `CreatePostReq.Validate` 和 `UpdatePostReq.Validate` 在 service 层执行，使业务校验不依赖 HTTP handler。
- 字段长度按 Unicode 字符数计算，与面向用户的“字符长度”语义一致。
- 使用类型化 `ValidationError`，由 handler 稳定映射为 400。
- `UpdatePostReq.Slug` 使用指针，区分“不更新 slug”和“将 slug 更新为空”的请求语义。

### 文章列表规则

- service 在未传 `status` 时自动设置为 `published`，将公开安全默认值放在业务层。
- `status=all` 在进入 repository 前转换为空过滤条件，复用现有动态 SQL。
- 该规则当前尚无身份判断；接入认证后必须在 service 或上层策略中限制 `all`。

### 数据写入

- repository 检测 PostgreSQL 错误码 `23505`，将唯一约束冲突转换成 `ErrSlugExists`。
- 更新语句支持修改 `slug`，写入后根据新 slug 回读文章。
- `updated_at = NOW()` 直接作为 SQL 表达式执行，不作为字符串参数绑定。
- 状态更新为 `published` 时使用 `COALESCE(published_at, NOW())`，只记录首次发布时间。
- 删除操作通过受影响行数区分成功与不存在，并统一转换成 `ErrPostNotFound`。

### HTTP 边界

- `http.MaxBytesReader` 将 JSON 请求体限制为 2 MB。
- handler 使用 `writeServiceError` 集中映射校验错误、资源不存在和 slug 冲突。
- 未识别错误通过 `slog` 记录请求方法、路径和真实原因；客户端只收到通用 500 信息。
- CORS 使用通配符来源时关闭 credentials。当前 JWT 计划通过 `Authorization` 请求头传递，不依赖跨域 cookie。

## 数据与接口

- 不新增数据库迁移。
- `PUT /api/v1/posts/{slug}` 新增对请求体 `slug` 字段的实际更新支持。
- `GET /api/v1/posts` 的默认语义从“不限制状态”收紧为“仅已发布”。
- 新增业务错误码 `4` 表示 slug 冲突，对应 HTTP 409。
- 其余路径与统一响应外形不变。

## 风险与边界

- `status=all` 在认证完成前仍可被公开调用，只是避免了默认泄露；后续必须增加管理员授权。
- 文章主体、标签创建和标签关联尚未置于同一事务中，部分失败可能留下不完整写入。
- 当前只有编译级测试，仍需要针对校验、错误映射和 repository 行为补充单元及集成测试。

## 验证

- `gofmt`：涉及的 Go 文件已格式化。
- `go test ./...`

## 参考

- [本次产品定义](product.md)
