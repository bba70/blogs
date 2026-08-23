# Blogs 文档

`docs` 用来记录每一次功能改动的产品定义和技术设计。文档按 phase 分组，每个编号目录对应一次可以独立提交、验证和回顾的改动。

## 目录结构

```text
docs/
├── README.md
├── ui/                         # 跨功能复用的前端视觉规范
│   ├── concept-c-spec.md
│   └── concept-c.png
└── phase-1-blog-core/
    ├── 01-backend-scaffold/
    │   ├── product.md          # 做什么，以及用户最终得到什么
    │   └── design.md           # 前端、后端和数据层如何实现
    └── 02-frontend-scaffold/
        ├── product.md
        └── design.md
```

## 每次改动只回答两个问题

### `product.md`：这次做什么

产品定义只描述功能本身，不记录文件清单和代码细节。根据改动需要包含：

- 背景和目标
- 用户或使用者
- 产品形态与主要流程
- 本次范围和非目标
- 可验证的验收标准

### `design.md`：这次怎么实现

设计文档记录实现方案和关键取舍。根据改动影响范围包含：

- 前端页面、组件、状态和交互设计
- 后端模块、接口和业务规则
- 数据模型与迁移
- 前后端契约
- 关键技术选择、风险与边界

如果某次改动不涉及前端或后端，直接注明该端无改动，不为了填满结构虚构设计。

## 约定

- phase 目录使用 `phase-N-name/` 命名，仅用于给相关改动分组。
- 改动目录使用 `NN-name/` 命名，编号按发生顺序递增。
- 每个改动目录内只保留 `product.md` 和 `design.md`。
- 提交 hash 可以写在两份文档的元信息中，不再维护单独的变更清单。
- 项目进度由任务或提交历史表达，不在 `docs` 中维护重复的进度表。
- 全局视觉语言、设计令牌和响应式规则统一维护在 [`ui/`](ui/)；具体功能只引用它，不复制一份。

## 现有改动

| 改动 | 产品定义 | 技术设计 |
| --- | --- | --- |
| 后端博客核心 | [product.md](phase-1-blog-core/01-backend-scaffold/product.md) | [design.md](phase-1-blog-core/01-backend-scaffold/design.md) |
| 前端博客核心 | [product.md](phase-1-blog-core/02-frontend-scaffold/product.md) | [design.md](phase-1-blog-core/02-frontend-scaffold/design.md) |

全局 UI 规范见 [`ui/concept-c-spec.md`](ui/concept-c-spec.md)。
