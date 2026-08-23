# 02 Frontend Scaffold — Design

> Commit: `51e4c99` feat(frontend): scaffold React + Vite + TypeScript frontend
> Phase: 1（博客核心）
> Status: 已完成

## 目标

搭建前端骨架并实现博客核心页面（列表、详情、编辑器），与后端 API 对接。

## 范围

- Vite + React 19 + TypeScript 脚手架
- Tailwind v4 + ESLint 配置
- 路由（react-router v7）
- API 调用层（typed fetch wrapper）
- 状态管理（zustand）
- 通用组件 + 页面 + 编辑器模块
- Vite 代理 `/api` → 后端

**不在范围内**：测试、构建验证、登录页、后台管理（Phase 2）。

## 后端设计

本次改动不修改后端。前端复用已有 `/api/v1` 接口和统一响应格式，通过开发服务器代理访问后端。

## 关键设计决策

### React 19 + Vite 8 + TypeScript

**选择**：React 19.2 + Vite 8 + TypeScript 6

**理由**：
- React 19 稳定，新特性（Actions、useFormStatus）可用
- Vite 启动快、HMR 快，开箱即用
- TypeScript 强类型，与后端 Go 类型风格一致

### Tailwind v4 而非 styled-components / CSS Modules

**选择**：Tailwind v4 + `@tailwindcss/vite` 插件 + `@tailwindcss/typography`

**理由**：
- 原子类，无 CSS 命名负担
- v4 用 CSS-in-JS 配置（无 `tailwind.config.js`），更轻
- typography 插件处理 markdown 渲染的排版（`prose` 类）

### react-router v7 而非 tanstack router

**选择**：[react-router](https://reactrouter.com/) v7

**理由**：
- 生态最大，文档全
- v7 合并了 Remix，支持 data loading（本期未用，仍用传统 `<Route>` 声明）
- 路由配置简单（JSX 声明式）

**替代方案**：tanstack router —— 类型更强但生态小，拒绝。

### zustand 而非 redux / context

**选择**：[zustand](https://github.com/pmndrs/zustand) v5

**理由**：
- API 极简（`create((set) => ({...}))`），无 boilerplate
- 不需要 Provider 包裹
- 性能好（selector 订阅，避免全量 re-render）
- TS 友好

**替代方案**：
- redux toolkit —— 太重，本项目规模不需要
- React Context —— 性能差（任意 state 变化全部 re-render）

### Milkdown 而非 @uiw/react-md-editor / slate

**选择**：[Milkdown](https://milkdown.dev/) v7（crepe + react kit）

**理由**：
- 基于 ProseMirror，富文本编辑能力强大
- 插件化架构，可按需加载（本期用 crepe preset）
- 支持 markdown 双向转换
- UI 现代化，可定制

**替代方案**：
- @uiw/react-md-editor —— 简单但扩展性差
- slate —— 太底层，需要自己拼装

### API 层用原生 fetch 而非 axios / swr / react-query

**选择**：原生 `fetch` + 自封装 typed wrapper

**理由**：
- 浏览器原生，无依赖
- 简单场景够用
- 后续若需缓存/重试，再引入 swr 或 react-query

**实现**：[client.ts](../../../web/src/api/client.ts) 提供 `request<T>` 和 `requestPaginated<T>` 两个泛型函数。

### 路径别名 `@/` → `src/`

**选择**：Vite + tsconfig 双配置 `@/*` → `src/*`

**理由**：
- 导入路径稳定，移动文件不破坏
- 区分项目内部模块和第三方依赖

### Vite 代理 `/api` → `http://localhost:8080`

**选择**：`vite.config.ts` 配置 `server.proxy['/api']`

**理由**：
- 前端 `fetch('/api/v1/posts')` 不用写完整 URL
- 避免 CORS（开发期同源）
- 生产用反向代理（nginx）或同源部署

## 目录结构

```
web/src/
├── api/            # API 调用层（client + posts + tags）
├── components/     # 通用组件（Header/Footer/Layout/PostCard 等）
├── modules/        # 业务模块
│   └── editor/     # Markdown 编辑器模块
├── pages/          # 路由页面（List/Detail/Editor/404）
├── stores/         # zustand stores（postStore + tagStore）
├── types/          # TypeScript 类型
├── App.tsx         # 路由配置
├── main.tsx        # 入口
└── index.css       # Tailwind 入口
```

**为什么 `modules/` 和 `pages/` 分开**：
- `pages/` 是路由级组件，每个路由一个
- `modules/` 是业务功能模块，可跨路由复用（编辑器既用在新建页也用在编辑页）

## 路由设计

| Path | 组件 | 说明 |
|------|------|------|
| `/` | PostListPage | 文章列表 |
| `/posts/:slug` | PostDetailPage | 文章详情 |
| `/editor` | PostEditorPage | 新建文章 |
| `/editor/:slug` | PostEditorPage | 编辑文章（slug 参数区分新建/编辑） |
| `*` | NotFoundPage | 404 |

详见 [App.tsx](../../../web/src/App.tsx)。

## 状态管理边界

| Store | 状态 | 职责 |
|-------|------|------|
| postStore | posts[], currentPost, loading, error | 列表、详情、CRUD 操作 |
| tagStore | tags[], loading | 标签列表 |

**为什么不用单个 store**：单一职责，按领域拆分便于扩展（Phase 2 加 authStore、commentStore）。

## 已知不足

- 无测试（组件测试、E2E）
- 构建未验证（`npm run build` 通过性未知）
- 编辑器未做"未保存提示"
- 无 SEO（纯 SPA，未来可加 SSR 或 react-helmet）
- 无错误边界（Error Boundary）

## 参考

- [本次产品定义](product.md)
- [全局 UI 规范](../../ui/concept-c-spec.md)
