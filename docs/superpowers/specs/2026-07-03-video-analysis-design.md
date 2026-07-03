# 课堂视频分析模块 — 设计文档

日期：2026-07-03
模块：视频分析（class-lab / web + serve，新增第 4 个模块）

## 1. 背景与目标

在 class-lab 中新增「视频分析」模块：特教老师上传或粘贴一段 **几秒到 50 分钟** 的课堂视频，
AI 自动分析并产出一份**报告草稿**，帮助评估课堂中孩子与老师的表现。对应演示幻灯片「模块四·视频分析」的链路：
`上传/选视频 → AI 摘要 → 行为标签 → 报告草稿`。

分析聚焦五个维度：

1. **孩子表现**
2. **老师表现**
3. **老师是否及时给奖励**（口头表扬 / 肢体（击掌等）/ 实物强化）
4. **孩子配合意愿**
5. **孩子听指令能力**（老师下达指令 → 孩子响应）

理念：**不求 100% 量化**（幻灯片明示），以定性评级 + 文字依据为主，关键动作的量化留待后续结合传统 CV 模型。

面向用户：特教老师（成人）。已有全局登录门禁，本模块沿用，不做额外权限。

## 2. 模型与能力假设（重要前提）

- 分析统一使用 **qwen3.7-plus**，用户明确其为**全模态（omni）模型**，可直接接收**图片帧**与**音频段**。
- ⚠️ 该多模态能力**未从外部文档核实**。因此**实现第一步是能力探针脚本**（见 §7），用真实 key 验证 qwen3.7-plus 能否接收图/音频；跑通后才继续。
  若探针失败（例如实际只能收图、不能收音频），回退方案为：视觉用 `qwen-vl` 系列看帧、音频用 `paraformer` 等 ASR 转写，再由文本模型汇总——即把「感知层」拆成专用模型。**此回退不在 v1 实现范围内，仅作为探针失败时的应对预案。**
- 复用现有环境变量：`MAAS_API_KEY` / `MAAS_BASE_URL`（OpenAI 兼容 chat/completions）。分析所用模型名用新环境变量 `VIDEO_MODEL`（默认 `qwen3.7-plus`），避免与纯文本 `TEXT_MODEL` 混用。

> **⚑ 2026-07-03 探针实测更新（`npm run probe:omni`，见 memory: video-model-capabilities）**
> qwen3.7-plus 实测：**图片 ✅ / `video` 帧序列 ✅（帧数须 4~8000）/ 音频 ❌**（四种音频形态全部 400）。
> 故 **v1 走 `video` 帧序列做视觉分析，不接音频**：
> - Map 用 `{type:'video', video:[帧dataUrl,...]}` 把一窗帧作为一个视频项送入，比逐帧 `image_url` 更贴合“解析视频”。
> - 不抽音频、不接 ASR（`qwen3-asr-flash` 存在但要公网 URL，本地音频段阿里云取不到，端到端不通）。
> - 「老师是否及时给奖励」「听指令能力」两个语音相关维度改由**视觉证据**判断（击掌/给实物/竖拇指＝奖励；指令手势→孩子动作＝响应），报告中诚实标注“口头信号本版可能未捕捉”。
> - ffmpeg 因此只需**探测时长 + 抽帧**，不再抽音频。

## 3. 整体流程（方案 A：时间窗 Map-Reduce + 异步 Job）

```
入口（二选一）
  ├─ 上传文件：multipart → 落盘 uploads/videos/<jobId>.<ext>
  └─ 视频 URL：后端下载该链接 → 同一目录（校验可达/类型/大小）
        │  两路合流，后续完全一致：
   ffmpeg 探测时长，按时间窗切分（默认每 180s 一段，N = ceil(时长/180)）
        │  每个窗口：
        ├─ 抽帧：该段每 ~10s 一帧，单窗封顶 ~12 帧（均匀采样、超出则等距抽稀）
        └─ 抽音频：该段音轨导出为一小段（如 mp3，单声道）
        │
   [Map]  每窗一次 qwen3.7-plus 调用（帧图 + 音频段）
          → 该时段结构化观察 JSON：
            孩子在做什么 / 老师说了做了什么 / 有无奖励及类型 / 有无指令与孩子响应
        │
   [Reduce] 汇总全部窗口观察 → 一次 qwen3.7-plus 调用
          → 摘要 + 行为标签 + 五维评价 + 时间轴证据 + 报告草稿
```

- **异步 Job**：上传/提交 URL 后立即返回 `jobId`，分析在后台执行；前端轮询进度。
- **进度阶段**：`created → downloading(仅 URL) → extracting → analyzing(第 k/N 窗) → reducing → done | failed`。
- **单窗失败**：重试 2 次（复用 [images.ts](../../../serve/src/routes/images.ts) 的退避重试思路）；仍失败则该窗标注「本时段分析失败」，不阻断整体，Reduce 时说明缺失。
- **并发**：窗口分析可串行（实现简单、稳）或小并发（如 2）；v1 采用**串行**，进度逐窗推进，最直观。

新增依赖：`@fastify/multipart`（文件上传）；系统需预装 `ffmpeg`（抽帧/抽音频/探测时长），README 注明。

## 4. 报告数据结构

```ts
type Rating = '好' | '一般' | '待加强';

interface DimensionEval {
  rating: Rating;
  notes: string; // 文字依据
}

interface VideoAnalysis {
  id: string;
  source: { type: 'upload' | 'url'; filename?: string; url?: string };
  durationSec: number;
  createdAt: string;
  status: 'processing' | 'done' | 'failed';
  progress: { phase: string; windowDone: number; windowTotal: number };
  report?: {
    summary: string;              // AI 摘要（整体一段话）
    tags: string[];               // 行为标签，如 ["主动对视","需口头提示","独立完成穿珠"]
    dimensions: {
      childPerformance: DimensionEval;    // 孩子表现
      teacherPerformance: DimensionEval;  // 老师表现
      timelyReward: DimensionEval;        // 老师是否及时给奖励
      cooperation: DimensionEval;         // 孩子配合意愿
      followInstruction: DimensionEval;   // 听指令能力
    };
    timeline: { atSec: number; text: string }[]; // 时间轴证据（来自各窗）
    draft: string;                // 报告草稿（可整段复制存档/发家长）
  };
  error?: string;
}
```

- `rating` 用轻量三档 `好 / 一般 / 待加强` + 文字依据，贴合「不求 100% 量化」。
- **持久化**：新增 SQLite 表 `video_analyses(id TEXT PRIMARY KEY, filename TEXT, createdAt TEXT, data TEXT)`，
  与 [db/index.ts](../../../serve/src/db/index.ts) 的 lessons「单表存整对象 JSON」模式一致；配 `insert/get/list/update/delete`。
- Map 阶段的每窗观察结构在 `videoAnalysis.ts` 内部定义，不必长期持久化到报告（时间轴 `timeline` 已承载对用户有用的证据）。

## 5. API 端点（后端）

| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/api/video/analyses` | 创建分析任务。body 为 `multipart`（文件）**或** `application/json { url }`，二选一；返回 `{ id }` |
| GET | `/api/video/jobs/:id` | 轮询任务状态 / 进度 / 报告 |
| GET | `/api/video/analyses` | 历史分析列表 |
| GET | `/api/video/analyses/:id` | 单条详情 |
| DELETE | `/api/video/analyses/:id` | 删除一条 |

- 在 [index.ts](../../../serve/src/index.ts) 注册 `@fastify/multipart`、建表、创建 `uploads/videos` 目录、`registerVideoAnalysisRoutes`。
- 校验：文件大小上限（默认 ≤ 500MB）、时长几秒到 50 分钟（超长给明确提示并拒绝；过短/无法解析时长也拒绝）、类型须为视频。

## 6. 前端页面

- **列表 + 上传页** [`web/src/pages/VideoAnalysis.tsx`](../../../web/src/pages/VideoAnalysis.tsx) — 路由 `/video`
  - 上传区含两个 Tab：
    - **上传文件**：选本地视频文件。
    - **视频链接**：粘贴 URL 输入框 + 「解析」按钮。
  - 提交后显示进度条 + 当前阶段中文文案（下载中 / 抽帧中 / 分析第 k/N 段 / 汇总中）。
  - 下方历史分析卡片列表（来源、文件名/链接、时长、日期），点进详情。
- **详情页** [`web/src/pages/VideoAnalysisDetail.tsx`](../../../web/src/pages/VideoAnalysisDetail.tsx) — 路由 `/video/:id`
  - 摘要卡 + 行为标签 chips + 五维评价卡（每维：评级徽章 + 文字依据）+ 时间轴（第 X 分钟发生了什么）+ 报告草稿（含「复制」按钮）。
- **导航** [AppShell.tsx](../../../web/src/components/AppShell.tsx)：新增第 4 个 tab「视频分析」（`/video`），暖色风格与现有一致；`match` 判断 `p.startsWith('/video')`，并更新「DTT 教案」tab 的 match 排除 `/video`。
- **路由** [App.tsx](../../../web/src/App.tsx)：新增 `/video`、`/video/:id`。
- 轮询沿用 [api/client.ts](../../../web/src/api/client.ts) 风格；轮询间隔约 2s，`done`/`failed` 停止。

## 7. 实现第一步：能力探针脚本（兜底「禁止瞎编」）

- `serve/src/scripts/probeOmni.ts`：用真实 `MAAS_API_KEY` 向 `VIDEO_MODEL`（qwen3.7-plus）发送
  **1 帧图片 + 1 段几十秒音频**（OpenAI 兼容多模态 message 格式），打印是否成功及返回内容。
- **必须先跑通此脚本，再实现后续后端**。若失败，暂停并回到用户确认回退方案（§2），不继续搭建，避免浪费。

## 8. 新增 / 改动文件

| 文件 | 作用 |
|---|---|
| `serve/src/scripts/probeOmni.ts` | 能力探针（实现第一步，先验证 omni） |
| `serve/src/ai/videoAnalysis.ts` | 组 omni 请求：Map（帧+音频→观察）、Reduce（汇总→报告）两个 prompt 与解析 |
| `serve/src/lib/ffmpeg.ts` | 封装：探测时长、抽帧、抽音频段 |
| `serve/src/lib/videoJobs.ts` | 内存 job 表 + 编排（download?→extract→map→reduce）+ 进度更新 |
| `serve/src/routes/videoAnalysis.ts` | §5 的 5 个端点（含 multipart / URL 两路入口） |
| `serve/src/db/videoAnalyses.ts` | 建表 + CRUD（insert/get/list/update/delete） |
| `serve/src/index.ts` | 注册 multipart、建表、`uploads/videos` 目录、注册路由 |
| `serve/package.json` | 新增依赖 `@fastify/multipart` |
| `web/src/pages/VideoAnalysis.tsx` | 列表 + 上传（文件/URL 双 Tab）页 |
| `web/src/pages/VideoAnalysisDetail.tsx` | 报告详情页 |
| `web/src/App.tsx` | 路由 `/video`、`/video/:id` |
| `web/src/components/AppShell.tsx` | 第 4 个 tab「视频分析」+ 调整现有 match |
| `serve/.env.example` | 新增 `VIDEO_MODEL=qwen3.7-plus` |
| `README`（若有） | 注明需预装 ffmpeg |

## 9. 边界与容错

- **未装 ffmpeg**：探测/抽帧时捕获错误，job 标 `failed` 并给明确文案（README 注明依赖）。
- **URL 入口**：链接不可达 / 非视频类型 / 需鉴权的直链拿不到 / 下载体积超限 → 各自友好报错，job `failed`，不崩服务。
- **文件校验**：超大（>500MB）、时长超出几秒到 50 分钟、非视频类型 → 明确提示并拒绝。
- **单窗分析失败**：重试后仍失败则该窗降级标注，报告照常产出并说明「某时段缺失」。
- **omni 上下文超限**：靠时间窗切分兜底；单窗帧数（~12）与音频段时长（~180s）设保守默认，可调。
- **进程重启丢内存 job**：v1 可接受（分析是一次性任务）；已落盘的历史报告不受影响。进行中的 job 重启后丢失，前端轮询到 404 时提示「任务已失效，请重试」。

## 10. 明确不做（YAGNI）

- 不做传统 CV 模型量化关键动作（幻灯片标注「后续」）。
- 不做实时 / 直播分析，只处理已录制文件或链接。
- 不做窗口并发优化（v1 串行，够用且直观）。
- 不写自动化测试（遵循项目约定：build + 浏览器 E2E 手动验证）。
- 不做多人协作 / 权限细分，沿用现有全局登录门禁。
- 探针失败时的 qwen-vl + ASR 回退方案不在 v1 实现内，仅为应急预案。
