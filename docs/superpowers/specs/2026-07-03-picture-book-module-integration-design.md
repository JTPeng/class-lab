# 绘本打卡模块并入 Class-Lab —— 设计文档

- 日期：2026-07-03
- 状态：已确认，待生成实现计划
- 相关项目：`class-lab`（目标）、`picture-book-reading-card`（来源）

## 背景与目标

`picture-book-reading-card`（绘本阅读打卡图卡）是一个独立项目：手机扫码填写书名/心得/评分，选画风与页数后，由通义千问编排分镜、通义万相逐场景生图，拼成一张长图绘本卡片，支持长按保存与二维码局域网分享，打卡次数记录在浏览器 localStorage。

目标：把绘本项目的**全部功能**（前端 + 后端）**重构并入** `class-lab`，与现有"DTT 教案"功能平级，通过一个**顶部导航栏 Tab 切换菜单**在两个模块间切换。

两个项目技术栈差异较大，因此"并入"是一次重构改写，而非文件拷贝：

| | class-lab（目标） | picture-book（来源） |
| --- | --- | --- |
| 前端 | React 19 + React Router 7 + Vite + Tailwind + TS | 原生 JS（IIFE、无打包）+ html2canvas |
| 后端 | Fastify + better-sqlite3 + TS（:8787） | Express + CommonJS + 无数据库（:3000） |
| AI | 百炼 MaaS（qwen3.7-max + qwen-image） | DashScope 原生（qwen-turbo 分镜 + wanx 逐场景生图） |
| 存储 | SQLite 持久化 | 仅 localStorage 计数 |

## 已确认的关键决策

1. **合并深度**：深度并入——绘本代码重构进 class-lab 的 React + Fastify 单体，前后端都做。
2. **AI 接入**：原样保留绘本管线（qwen-turbo 分镜 + wanx 串行逐场景生图），使用独立的 `DASHSCOPE_API_KEY`，与现有 MaaS 变量共存。
3. **功能范围**：全部移植——核心生成 + 长图卡片、打卡计数、二维码局域网分享、局域网扫码上手二维码。
4. **持久化**：保持原样，绘本卡片**不持久化**，不建新数据库表（仅 localStorage 计数）。
5. **切换菜单**：顶部常驻导航栏 Tab，两个 Tab（DTT 教案 / 绘本打卡）一键切换，结构可扩展第三个项目。
6. **导航栏样式**：采用 DTT 暖色风格（brand 色系）；绘本内容区保留赛博朋克暗色风，两模块主题各自独立、互不干扰。

## 架构

### 前端（`web/src/`）

- **共享布局** `components/AppShell.tsx`：DTT 暖色系顶部常驻导航栏（`Class-Lab` 标题 + 两个 Tab：`DTT 教案` / `绘本打卡`），下方 `<Outlet/>` 渲染当前模块。Tab 高亮由路由前缀判断（`/picture-book` 前缀 → 绘本 Tab 高亮，否则 DTT Tab 高亮）。
- **路由**（在 `App.tsx` 用 React Router 嵌套路由包一层 Layout）：
  - DTT 教案：`/`、`/new`、`/lessons/:id`（保持不变）
  - 绘本打卡：`/picture-book`（单页：表单 → 生成 → 长图卡片）
- **绘本页面** `pages/PictureBook.tsx`：把原 `web/js/app.js` 的表单交互与主流程编排改写为 React。
- **绘本子模块**：
  - `pictureBook/config.ts`：画风(5：storybook/watercolor/cyberpunk/render3d/pixel)、页数(2–4)、像素比(3：方形 1024\*1024 / 竖版 720\*1280 / 横版 1280\*720)。**必须对齐后端白名单**。
  - `pictureBook/storage.ts`：localStorage 打卡计数（"第 N 次打卡"），移植自原 `storage.js`。
  - `components/PictureCard.tsx`：渲染长图卡片（顶部书名/星级、每页图配场景文字、底部日期/第 N 次打卡），`html2canvas` 导出 PNG，长按/下载保存，二维码分享。移植自原 `card.js`。
- **视觉**：绘本内容区沿用赛博朋克风（局部作用于该页），导航栏用 DTT 暖色。
- **依赖**：新增 npm 包 `html2canvas`、`qrcode`，替代原项目 `web/vendor/` 里的两个 min.js。
- **Vite 配置**（`vite.config.ts`）：proxy 增加 `/shared`；设置 `server.host = true` 以便手机在同一局域网访问开发服务器。

### 后端（`serve/src/`）

- `ai/picturebook.ts`：从原 `server/lib/dashscope.js` 原样移植并 TS 化：
  - `parseScenes`、`normalizeOptions`、`buildScenePrompt`、`generateStoryScenes`、`generateOneImage`、`generatePicturebook`。
  - **关键约束保留**：`generatePicturebook` 内逐张**串行** for 循环，不得改并发（并发会触发百炼 `Throttling.RateQuota` 限流）——注释一并保留。
  - 常量：`STYLE_PROMPTS`、`ALLOWED_SIZES`（`1024*1024`/`720*1280`/`1280*720`）、`MAX_PAGES`(4)、模型名 `wanx2.1-t2i-turbo` / `qwen-turbo`。
  - 依赖 `DASHSCOPE_API_KEY`。
- `lib/network.ts`：移植 `getLanUrl`（取第一个非回环 IPv4）。
- `routes/picturebook.ts`，挂在 `/api` 前缀下：
  - `POST /api/picturebook/generate`（原 `generate-image`）：接收 `{title, thoughts, style, n, size}`，调用管线，返回 `{ scenes: [{text, image}] }`。
  - `POST /api/picturebook/share`（原 `share`）：接收导出的 PNG data URL，写入 `serve/shared/`，返回局域网可访问链接。该路由单独放宽 `bodyLimit` 到约 12MB（Fastify 默认 1MB 不够）。
  - `GET /api/lan-url`（原 `meta`）：返回局域网 IP。
- `index.ts`：启动时清空并重建 `serve/shared/`，用 `@fastify/static` 以 `/shared/` 前缀托管（与现有 `/uploads/` 并列）。

### 局域网 URL 适配（前后端分离带来的差异）

原项目前后端同源（:3000），class-lab 是分离的（Vite :5173 / Fastify :8787）：

- `GET /api/lan-url` 只返回局域网 **IP**（不含端口）。
- "扫码上手机"二维码：前端用 `IP + 当前页面端口` 拼开发前端地址（依赖 Vite `host:true`）。
- 分享图二维码：直接指向后端 `http://<IP>:8787/shared/xxx.png`（后端监听 `0.0.0.0`，手机可直连）。
- 未连网时 `getLanUrl` 返回 `null`，二维码与分享功能优雅降级（与原项目一致）。

### 前后端契约（改选项时必须同步）

沿用原项目约束，`web/src/pictureBook/config.ts` 与后端常量必须对齐，否则前端选项被后端静默回退：

- 画风 `styles[].id` ∈ 后端 `STYLE_PROMPTS`。
- 像素比 `ratios[].size` ∈ 后端 `ALLOWED_SIZES` 白名单。
- 页数 `counts` ≤ 后端 `MAX_PAGES`（4）。

## 测试

- 后端沿用 vitest：为移植的纯函数 `parseScenes`、`normalizeOptions`、`buildScenePrompt` 补单测（原项目已把这些导出，逻辑可直接覆盖）。
- 前端：沿用现状（class-lab 前端暂无测试），不新增测试框架。

## 配置与忽略项

- `serve/.env.example`：新增 `DASHSCOPE_API_KEY`（说明：绘本模块用，https://bailian.console.aliyun.com 获取），与现有 MaaS 变量共存。
- `.gitignore`：新增 `serve/shared/`（分享临时图，不入库）。
- `README.md`：补充绘本模块的功能说明、新环境变量、局域网使用方式。

## 非目标（YAGNI）

- 不持久化绘本卡片、不建新数据库表。
- 不统一两套 AI 配置（DTT 用 MaaS、绘本用 DashScope 各自独立）。
- 不改动 DTT 教案现有逻辑与视觉。
- 不预留未要求的第三个项目页面（但 Tab/路由结构天然可扩展）。
