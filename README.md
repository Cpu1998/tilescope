# TileScope

交互式 Web Mercator 地图网格与 XYZ 切片坐标检查工具。前端使用 **Vue 3 + Vite**。

## 功能

- 拖拽、缩放和浏览 OpenStreetMap 地图（滚轮以鼠标位置为锚点）
- 显示 XYZ 切片网格与切片编号，点击网格选中切片
- 查看经纬度、QuadKey、切片边界和 EPSG:3857 信息
- 城市、经纬度或 XYZ 切片搜索（如 `12/3372/1551`），浏览器定位
- 一键复制 XYZ、QuadKey、切片中心坐标和切片 URL
- 切片规则切换：XYZ 网格 / Quantized-Mesh 地形地理网格（WGS84 四叉树，TMS y 自南向北）
- 底图切换：标准 / 影像 / 地形 / 对比

## 环境要求

- Node.js `>=22.13.0`

## 快速开始

```bash
npm install
npm run dev        # 本地开发
npm run build      # 构建产物输出到 dist/
npm run preview    # 预览构建产物
npm run typecheck  # vue-tsc 类型检查
npm run lint       # ESLint
npm test           # 构建 + 切片规则回归测试
```

## 目录结构

| 路径 | 说明 |
| --- | --- |
| `index.html` | Vite 入口，承载页面 title / description / OG 元信息 |
| `src/main.ts` | 应用入口，挂载 `#app` |
| `src/App.vue` | 根组件，创建并 provide 共享作用域 |
| `src/composables/useTileScope.ts` | 视图状态与交互逻辑（`ref` / `computed` + provide/inject） |
| `src/components/` | `TopBar.vue` / `MapPanel.vue` / `Inspector.vue` |
| `src/styles/globals.css` | 全局样式（Tailwind v4 入口 + 手写规则） |
| `shared/tile.js` | 切片计算单一来源（带 JSDoc 类型），Vue 版与静态版共用 |
| `github-pages/` | 免构建静态版，由 GitHub Actions 部署到 Pages |
| `scripts/build-static.mjs` | 从 `shared/tile.js` 生成 `github-pages/tile.js` |

## 关于本次迁移

前端已由 Next.js 16 + vinext + React 迁移为 Vue 3 + Vite：

- `app/page.tsx` 的 `useState` / `useMemo` / `useRef` 分别对应 `ref` / `computed` / `ref`
- 组件拆分为 TopBar / MapPanel / Inspector，通过 provide/inject 共享 `useTileScope()`
- `shared/tile.js` 未改动，仍是唯一的切片计算来源

`worker/`、`db/`、`drizzle/`、`examples/d1/`、`.openai/` 属于 vinext 时代的后端脚手架，
按约定原样保留但**未接入 Vue 构建链**——其中 `worker/index.ts` 仍引用 `vinext/server/*`，
如需重新部署到 Cloudflare Workers 需要另行改造成纯静态资源 Worker。

地图数据 © OpenStreetMap contributors。
