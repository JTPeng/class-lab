# Class-Lab DTT 教案生成工具 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 老师输入训练目标+现有教具，AI 生成一份规范的个别化 DTT 训练方案，做成海报化、可交互的网页。

**Architecture:** 独立的 `serve/`（Fastify + SQLite + 百炼 MaaS）与 `web/`（React + Vite + Tailwind），前后端共享一份教案 TS 类型。按「薄切片端到端」推进：先打通纯文字主链路（生成→校验→入库→返回→最简海报渲染），再逐片增强海报详情、两个交互、图片配图。

**Tech Stack:** 后端 Node.js + Fastify + TypeScript + better-sqlite3 + zod；前端 React + Vite + TypeScript + Tailwind CSS + React Router；AI 阿里百炼 MaaS（OpenAI 兼容）。

## Global Constraints

- 密钥全部读 `serve/.env`，`.gitignore` 已排除，绝不进 git。
- 后端 Base URL（OpenAI 兼容）：`https://llm-6xhzf2xp8v12jath.cn-beijing.maas.aliyuncs.com/compatible-mode/v1`
- 文本模型：`qwen3.7-max`（已实测支持 `response_format: json_object`）。
- 图片模型：`qwen-image-2.0-pro-2026-06-22`（列表实际可用名；调用方式待 Slice 5 实测）。
- 教案 schema：`templateType:"dtt"` + `schemaVersion` 判别位，字段只增不改。
- 日期字段（phases、targetList）生成时一律 `null`，AI 不编造。
- 图片是增强项：失败仅置 `status:"failed"`，不阻塞教案主体。
- 前后端共享的教案类型只维护一份源（`serve/src/schema` 为准，`web` 复制/引用同构定义）。

---

## Slice 0：脚手架 + 共享 schema

### Task 0.1：后端脚手架 + 健康检查

**Files:**
- Create: `serve/package.json`, `serve/tsconfig.json`, `serve/.env`, `serve/.env.example`
- Create: `serve/src/index.ts`（Fastify 启动 + `/health`）
- Test: `serve/src/index.test.ts`

**Interfaces:**
- Produces: Fastify app 工厂 `buildApp(): FastifyInstance`，供路由与测试复用。

- [ ] Step 1：`serve/` 下 `npm init -y`，安装 `fastify @fastify/cors better-sqlite3 zod dotenv`，dev 依赖 `typescript tsx vitest @types/node @types/better-sqlite3`。
- [ ] Step 2：写 `tsconfig.json`（`"module":"NodeNext"`, `"target":"ES2022"`, `"strict":true`）。
- [ ] Step 3：写 `.env.example`（占位）与 `.env`（真实值：`MAAS_API_KEY=sk-6ed9...`、`MAAS_BASE_URL=...compatible-mode/v1`、`TEXT_MODEL=qwen3.7-max`、`IMAGE_MODEL=qwen-image-2.0-pro-2026-06-22`、`PORT=8787`）。
- [ ] Step 4：写 `src/index.ts`：`buildApp()` 注册 cors + `GET /health → {ok:true}`；`if (import.meta.url === ...)` 时 `listen`。
- [ ] Step 5：写 `src/index.test.ts`：`buildApp().inject({method:'GET',url:'/health'})` 断言 `200` 且 `ok:true`。
- [ ] Step 6：`npx vitest run` 通过；`npm run dev` 手动 `curl /health` 通过。
- [ ] Step 7：commit `feat(serve): fastify 脚手架 + 健康检查`。

### Task 0.2：教案 schema（zod）+ 类型导出

**Files:**
- Create: `serve/src/schema/lesson.ts`
- Test: `serve/src/schema/lesson.test.ts`

**Interfaces:**
- Produces: `LessonSchema`（zod）、`GeneratedLessonSchema`（AI 需产出的子集，不含 id/createdAt）、`type Lesson`、`type LessonInput`。字段严格对照设计文档第 4 节。

- [ ] Step 1：写 `lesson.ts`，用 zod 定义 `LessonInputSchema`、`PhaseSchema`（`startDate/passDate: z.null()`）、`StoSchema`（`procedure` 三分支）、`TargetSchema`、`ImageSchema`、`GeneratedLessonSchema`（AI 产出：longTermGoal/phases/sto/targetList/title/sessionSuggestion?）、完整 `LessonSchema`（含 id/schemaVersion/templateType/createdAt/input/images）。导出对应 `z.infer` 类型。
- [ ] Step 2：写测试：合法样例 `.parse` 通过；缺 `sto.procedure.sd` 报错；`phases[].startDate` 非 null 报错；`objectives` 少于 1 个报错。
- [ ] Step 3：`vitest run` 通过。
- [ ] Step 4：commit `feat(serve): DTT 教案 zod schema`。

### Task 0.3：SQLite 建表 + lessons 仓储

**Files:**
- Create: `serve/src/db/index.ts`
- Test: `serve/src/db/index.test.ts`

**Interfaces:**
- Produces: `getDb()`；`insertLesson(l: Lesson): void`、`listLessons(): LessonListItem[]`、`getLesson(id): Lesson|null`、`deleteLesson(id): boolean`。整份教案以 JSON 存 `data` 列，另冗余 `id/title/skill/createdAt` 便于列表查询。`LessonListItem = {id,title,skill,createdAt,coverUrl?}`。

- [ ] Step 1：写 `db/index.ts`：`better-sqlite3` 打开 `serve/lessons.db`（可用 `:memory:` 测试），建表 `lessons(id TEXT PK, title, skill, createdAt, data TEXT)`。实现四个仓储函数（`data` 列 `JSON.stringify/parse`）。
- [ ] Step 2：写测试（`:memory:`）：insert→get 往返相等；list 返回摘要字段；delete 后 get 为 null。
- [ ] Step 3：`vitest run` 通过。
- [ ] Step 4：commit `feat(serve): sqlite 建表 + lessons 仓储`。

### Task 0.4：前端脚手架

**Files:**
- Create: `web/`（`npm create vite@latest . -- --template react-ts`）、`web/tailwind.config.js`、`web/src/index.css`、`web/vite.config.ts`（`server.proxy['/api'] → http://localhost:8787`）
- Create: `web/src/types/lesson.ts`（复制 Task 0.2 的 TS 类型定义，纯 type）
- Create: `web/src/api/client.ts`

**Interfaces:**
- Produces: `api.generateLesson(input)`, `api.listLessons()`, `api.getLesson(id)`, `api.deleteLesson(id)`（fetch 封装，走 `/api` 代理）。

- [ ] Step 1：Vite react-ts 脚手架 + 装 Tailwind（v3：`tailwindcss postcss autoprefixer`，配 `content`，`index.css` 三条 `@tailwind`）。
- [ ] Step 2：`vite.config.ts` 加 `/api` 代理到 `:8787`。
- [ ] Step 3：`web/src/types/lesson.ts` 放与后端同构的 `Lesson`/`LessonInput`/`LessonListItem` 纯 TS 类型。
- [ ] Step 4：`api/client.ts` 封装四个请求。
- [ ] Step 5：`npm run build` 通过（类型无误）。
- [ ] Step 6：commit `feat(web): vite+tailwind 脚手架 + api 封装`。

---

## Slice 1：文字主链路端到端（薄切片核心）

### Task 1.1：AI 文本 client（provider 无关适配层）

**Files:**
- Create: `serve/src/ai/textClient.ts`
- Test: `serve/src/ai/textClient.test.ts`

**Interfaces:**
- Produces: `generateJson(system: string, user: string): Promise<unknown>` —— 调 `POST {BASE_URL}/chat/completions`，`model=TEXT_MODEL`，`response_format:{type:'json_object'}`，取 `choices[0].message.content` 并 `JSON.parse`。fetch 可注入以便 mock。

- [ ] Step 1：写 `textClient.ts`：读 env，`fetch` 兼容端点，解析 content 为 JSON，非 200/解析失败抛错。构造函数或参数允许注入 `fetchImpl`。
- [ ] Step 2：写测试：注入假 fetch 返回一个 `chat.completion` 结构 → 断言解析出内层 JSON 对象；返回非法 JSON content → 抛错。
- [ ] Step 3：`vitest run` 通过。
- [ ] Step 4：commit `feat(serve): 百炼文本 client`。

### Task 1.2：教案生成服务（prompt + 校验 + 重试一次）

**Files:**
- Create: `serve/src/ai/lessonPrompt.ts`（system prompt：ABA/培智教案专家 + 模板结构说明 + 必须输出符合 schema 的 JSON + 日期留空规则）
- Create: `serve/src/services/generateLesson.ts`
- Test: `serve/src/services/generateLesson.test.ts`

**Interfaces:**
- Consumes: `generateJson`（Task 1.1）、`GeneratedLessonSchema`（Task 0.2）。
- Produces: `generateLesson(input: LessonInput, deps?): Promise<Lesson>` —— 组 prompt→`generateJson`→`GeneratedLessonSchema.safeParse`，失败则带「上次错误」重试一次，仍失败抛错；成功则补 `id`(用 `crypto.randomUUID`)、`schemaVersion`、`templateType`、`createdAt`、`input`、`images:[]` 组装完整 `Lesson`。

- [ ] Step 1：写 `lessonPrompt.ts` 常量 + `buildUserPrompt(input)`。
- [ ] Step 2：写 `generateLesson.ts`（依赖注入 `generateJson`）。
- [ ] Step 3：写测试：mock `generateJson` 首次返回缺字段 → 第二次返回合法 → 断言重试且成功；两次都非法 → 抛错；成功时断言补全了 id/createdAt/templateType。
- [ ] Step 4：`vitest run` 通过。
- [ ] Step 5：commit `feat(serve): 教案生成服务（prompt+校验+重试）`。

### Task 1.3：lessons 路由（generate/list/get/delete）

**Files:**
- Create: `serve/src/routes/lessons.ts`
- Modify: `serve/src/index.ts`（注册路由）
- Test: `serve/src/routes/lessons.test.ts`

**Interfaces:**
- Consumes: `generateLesson`、DB 仓储。
- Produces: `POST /api/lessons/generate`、`GET /api/lessons`、`GET /api/lessons/:id`、`DELETE /api/lessons/:id`。generate 校验入参（`LessonInputSchema`），生成后入库并返回整份 `Lesson`。

- [ ] Step 1：写路由插件，注册四个端点；`generateLesson` 通过 app decorate 或参数注入以便测试 mock。
- [ ] Step 2：`index.ts` 注册路由（前缀 `/api`）。
- [ ] Step 3：写测试（`inject` + mock 生成服务 + `:memory:` db）：generate 返回 200 + 教案；随后 list 含该条；get:id 返回；delete 后 404/空。
- [ ] Step 4：`vitest run` 通过。
- [ ] Step 5：**真实联通测试**：`npm run dev`，`curl POST /api/lessons/generate`（真 input）→ 确认拿到真教案 JSON。
- [ ] Step 6：commit `feat(serve): lessons 路由 + 真实联通打通`。

### Task 1.4：前端 新建页 + 最简海报渲染（端到端可见）

**Files:**
- Create: `web/src/pages/NewLesson.tsx`（表单：skill、availableTools 多输入、context 选择、可选 reinforcerPref/sessionMinutes）
- Create: `web/src/pages/LessonDetail.tsx`（最简：把教案各字段朴素分区展示，暂不做海报视觉）
- Create: `web/src/pages/Home.tsx`（列表卡片 + 新建入口）
- Modify: `web/src/App.tsx`（React Router：`/`、`/new`、`/lessons/:id`）
- Modify: `web/src/main.tsx`

**Interfaces:**
- Consumes: `api.*`（Task 0.4）、`Lesson` 类型。

- [ ] Step 1：装 `react-router-dom`，配路由。
- [ ] Step 2：`NewLesson`：表单 → 提交进 loading → 调 `generateLesson` → 成功后 `navigate('/lessons/'+id)`。
- [ ] Step 3：`LessonDetail`：`getLesson` → 朴素展示 longTermGoal / phases / sto / procedure 三分支 / targetList。
- [ ] Step 4：`Home`：`listLessons` → 卡片网格 + 「＋ 新建」。
- [ ] Step 5：`npm run build` 通过。
- [ ] Step 6：**端到端手测**：同时起 serve + web，浏览器走 新建→生成→跳详情→回首页看列表。用 chrome-devtools skill 截图确认。
- [ ] Step 7：commit `feat(web): 新建/详情/首页 打通文字主链路`。

---

## Slice 2：海报化详情页

### Task 2.1：视觉基调 + 海报布局

**Files:**
- Modify: `web/tailwind.config.js`（暖橙 + 奶油底色 token）、`web/src/index.css`
- Create: `web/src/components/poster/*`（Hero 长期目标、通过标准徽章、阶段时间轴、STO 分区色块、情景 chip）
- Modify: `web/src/pages/LessonDetail.tsx`

- [ ] Step 1：定义配色（参考 motuai.cn：暖橙 `#F97316` 系 + 奶油 `#FFF7ED`）、圆角、字重 token。
- [ ] Step 2：拆分 poster 子组件，按设计文档第 6 节布局拼装（低文字密度、大字重、分区色块）。
- [ ] Step 3：`build` + 截图确认海报感。
- [ ] Step 4：commit `feat(web): 教案海报化详情布局`。

---

## Slice 3：两个交互

### Task 3.1：交互 1 · 回合流程演示

**Files:**
- Create: `web/src/components/RoundFlow.tsx`
- Test: `web/src/components/RoundFlow.test.tsx`（vitest + @testing-library/react）
- Modify: `LessonDetail.tsx`

**Interfaces:**
- Consumes: `lesson.sto.procedure`。

- [ ] Step 1：装 `@testing-library/react @testing-library/jest-dom jsdom`，配 vitest jsdom。
- [ ] Step 2：写测试：初始显示 SD 卡；点[孩子正确]显示 `consequence`(C+)；点[孩子错误]显示 `correction`(C−)；点[再来一回合]回到 SD。
- [ ] Step 3：实现 `RoundFlow`（状态机：`sd → correct|incorrect → reset`）。
- [ ] Step 4：`vitest run` 通过 + 手测。
- [ ] Step 5：commit `feat(web): 回合流程演示交互`。

### Task 3.2：交互 2 · 图卡轮播（先用占位图）

**Files:**
- Create: `web/src/components/TargetCarousel.tsx`、`web/src/components/Lightbox.tsx`
- Test: `web/src/components/TargetCarousel.test.tsx`
- Modify: `LessonDetail.tsx`

**Interfaces:**
- Consumes: `lesson.targetList`、`lesson.images`（按 `refKey` 匹配；无图显示占位/加载态）。

- [ ] Step 1：写测试：多组 target 可左右切换；点击打开 lightbox；无图时显示占位。
- [ ] Step 2：实现轮播 + lightbox。
- [ ] Step 3：`vitest run` + 手测。
- [ ] Step 4：commit `feat(web): 图卡轮播 + lightbox`。

---

## Slice 4：图片配图（增强项，异步）

### Task 4.1：实测 qwen-image 调用方式

- [ ] Step 1：`curl` 实测 `qwen-image-2.0-pro-2026-06-22`（同步 vs 异步轮询、返回 URL vs base64），记录到本计划「实测记录」。
- [ ] Step 2：据实测结果确定 存本地 `uploads/` 还是存模型 URL。

### Task 4.2：图片 client + 路由

**Files:**
- Create: `serve/src/ai/imageClient.ts`、`serve/src/routes/images.ts`
- Modify: `serve/src/index.ts`
- Test: `serve/src/ai/imageClient.test.ts`（mock fetch）

**Interfaces:**
- Produces: `POST /api/lessons/:id/images`（触发/重生成某 `refKey` 配图，异步；失败置 `status:"failed"` 不影响主体）。

- [ ] Step 1：按实测实现 `imageClient.generate(prompt): Promise<{url}|{failed}>`。
- [ ] Step 2：路由：接收 refKey → 生成 → 回填 `lesson.images` 并落库 → 返回状态。
- [ ] Step 3：mock 测试 + 真实联通试跑一张。
- [ ] Step 4：前端详情页加载后对目标物/干扰物/步骤发起配图请求，`pending→done/failed` 回填。
- [ ] Step 5：commit `feat: qwen-image 配图（增强项，失败降级占位）`。

---

## Slice 5：收尾

- [ ] 删除交互（首页卡片删除确认）。
- [ ] README（起服务步骤、.env 配置说明）。
- [ ] 更新设计文档第 9 节：标注开放项已实测结论。
- [ ] 全量 `vitest run`（serve + web）通过；端到端回归一遍。
- [ ] commit + 收尾。

---

## 实测记录（随实现回填）

- 文本模型：`qwen3.7-max` ✅ `json_object` 通过（2026-07-02）。
- 图片模型：`qwen-image-2.0-pro-2026-06-22` —— 调用方式待 Slice 4 实测。

## Self-Review 覆盖检查

- 设计文档第 4 节 schema → Task 0.2 全覆盖（含日期留空、procedure 三分支）。
- 第 5 节 5 个接口 → Task 1.3（4 个）+ Task 4.2（images）。
- 第 6 节页面/布局/两个交互 → Task 1.4 + Slice 2 + Slice 3。
- 第 7 节时长建议 → 已在 schema `sessionSuggestion` + prompt（Task 1.2）体现。
- 第 8 节测试 → schema/重试单测（0.2/1.2）+ 组件测试（3.1/3.2）。
- 第 9 节开放项 → 文本已实测；图片在 Slice 4 实测。

## 实测记录 · 图片模型 (Slice 4, 2026-07-02)
- 可用方式: DashScope **多模态生成同步接口** `POST {host}/api/v1/services/aigc/multimodal-generation/generation`
- body: `{model:qwen-image-2.0-pro-2026-06-22, input:{messages:[{role:'user',content:[{text: prompt}]}]}}`
- 返回: `output.choices[0].message.content[0].image` = OSS 签名 URL(PNG,2048x2048), 约 66s
- ⚠️ URL 带 Expires(~2h)会失效 → 决定: 下载到 serve/uploads/ 本地持久化, 存本地路径
- 排除: async image-synthesis(user不支持async) / sync image-synthesis(url error) / OpenAI images/generations(404)
- DASHSCOPE_BASE_URL 已加入 serve/.env
