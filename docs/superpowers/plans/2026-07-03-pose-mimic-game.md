# 《跟我做动作》(Pose Mimic) 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在游戏乐园新增「跟我做动作」游戏：AI 生成卡通动作参考图，小朋友对着摄像头模仿，浏览器实时判定姿态并计分、存关卡。

**Architecture:** 后端仿现有动物图三件套（生成/磁盘缓存/路由）新增动作参考图接口。前端新增纯逻辑的动作定义与姿态判定模块（关节角度比对），一个游戏页用 `@mediapipe/tasks-vision` 从摄像头提取骨骼点算相似度，保持达标 2 秒通关，进度复用现有 `storage.ts`。

**Tech Stack:** React 19 + Vite + TypeScript + Tailwind（web）；Fastify + tsx（serve）；MediaPipe Tasks Vision（PoseLandmarker，模型/wasm 走 CDN）；阿里百炼 qwen-image（复用现有配置）。

## Global Constraints

- **不写自动化测试**（项目约定）。每个任务用 `build` / `tsc` 编译 + 浏览器 E2E 手动验证。
- ESM 导入相对路径带 `.js` 后缀（serve 现有约定，如 `'../lib/animalImageCache.js'`）。
- 前端 API 基址：`import.meta.env.VITE_API_BASE ?? 'http://localhost:8787'`，去掉尾部 `/`，接口前缀 `/api`（与 `web/src/games/animals.ts` 一致）。
- 复用现有环境变量：`DASHSCOPE_BASE_URL` / `MAAS_API_KEY` / `IMAGE_MODEL`。
- UI 风格沿用现有游戏页：`bg-gradient-to-b from-brand-50 ...`、`rounded-2xl shadow-card ring-1 ring-brand-100`、顶部「← 返回游戏乐园 / 重新开始」、三格 `Stat`（关卡/得分/最高分）。
- 游戏 id 固定为 `pose-mimic`；计分 `SCORE_PER_POSE = 10`。

---

## 文件结构

**后端（serve）**
- Create `serve/src/ai/poseImage.ts` — 动作定义 `POSE_DEFS` + `generatePoseImage(id)`。
- Create `serve/src/lib/poseImageCache.ts` — `ensurePoseImage(id)` / `isPoseCached(id)` 磁盘缓存。
- Create `serve/src/routes/poseImage.ts` — `GET /api/pose-image?id=...`。
- Create `serve/src/scripts/warmupPoseImages.ts` — 预热 6 张图。
- Modify `serve/src/index.ts` — 注册路由。
- Modify `serve/package.json` — 加 `warmup:poses` 脚本。

**前端（web）**
- Create `web/src/games/poses.ts` — 动作定义、关节角度工具、`scorePose()`、`poseImageUrl()`。
- Create `web/src/pages/PoseMimic.tsx` — 游戏页。
- Modify `web/package.json` — 加依赖 `@mediapipe/tasks-vision`。
- Modify `web/src/App.tsx` — 加路由 `/games/pose-mimic`。
- Modify `web/src/pages/Games.tsx` — 加游戏卡片。
- Modify `web/src/games/storage.ts` — `KNOWN_GAME_IDS` 加 `'pose-mimic'`。

---

## Task 1: 后端动作参考图（生成 + 缓存 + 路由 + 预热）

**Files:**
- Create: `serve/src/ai/poseImage.ts`
- Create: `serve/src/lib/poseImageCache.ts`
- Create: `serve/src/routes/poseImage.ts`
- Create: `serve/src/scripts/warmupPoseImages.ts`
- Modify: `serve/src/index.ts`
- Modify: `serve/package.json`

**Interfaces:**
- Produces:
  - `POSE_DEFS: { id: string; name: string; action: string }[]`（前端 `poses.ts` 的 id 必须与之一一对应）
  - `generatePoseImage(id: string): Promise<Buffer>`
  - `ensurePoseImage(id: string): Promise<Buffer>` / `isPoseCached(id: string): boolean`
  - `registerPoseImageRoutes(app: FastifyInstance): void` → `GET /api/pose-image?id=<id>` 返回 `image/png`
  - 动作 id 集合（前后端共享）：`hands-up` / `t-pose` / `hands-hip` / `one-hand-up` / `hands-head` / `arms-cross`

- [ ] **Step 1: 创建 `serve/src/ai/poseImage.ts`**

```ts
// 动作参考图生成：走阿里百炼 qwen-image（IMAGE_MODEL），与动物图同一套鉴权与解析。
// qwen-image 返回 output.choices[0].message.content[0].image。单张约 70s，调用方务必缓存。

export interface PoseDef {
  id: string;
  name: string;
  action: string; // 动作中文描述，拼进 prompt
}

// 6 个预设动作（id 必须与前端 poses.ts 保持一致）。
export const POSE_DEFS: PoseDef[] = [
  { id: 'hands-up', name: '双手举高', action: '双臂向上高高举过头顶' },
  { id: 't-pose', name: '双臂平举', action: '双臂向身体两侧水平伸直，成大字形' },
  { id: 'hands-hip', name: '叉腰', action: '双手叉在腰间，两个胳膊肘向外' },
  { id: 'one-hand-up', name: '单手举起', action: '高高举起右手，另一只手自然下垂' },
  { id: 'hands-head', name: '抱抱头', action: '双手抱在头顶上' },
  { id: 'arms-cross', name: '双臂交叉', action: '双臂在胸前交叉成 X 形' },
];

function buildPrompt(action: string): string {
  return `儿童绘本卡通插画风格，一个可爱的小朋友正面站立，${action}，纯白色背景，居中构图，完整上半身，色彩明亮温馨，适合幼儿，画面中不要出现任何文字`;
}

export async function generatePoseImage(id: string): Promise<Buffer> {
  const def = POSE_DEFS.find((p) => p.id === id);
  if (!def) throw new Error(`未知动作 id: ${id}`);

  const baseUrl = process.env.DASHSCOPE_BASE_URL;
  const apiKey = process.env.MAAS_API_KEY;
  const model = process.env.IMAGE_MODEL;
  if (!baseUrl || !apiKey || !model) {
    throw new Error('缺少 DASHSCOPE_BASE_URL / MAAS_API_KEY / IMAGE_MODEL，请在 serve/.env 配置');
  }

  const res = await fetch(`${baseUrl}/services/aigc/multimodal-generation/generation`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      input: { messages: [{ role: 'user', content: [{ text: buildPrompt(def.action) }] }] },
    }),
  });

  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`动作图生成请求失败: ${res.status} ${detail}`);
  }

  const data = (await res.json()) as {
    output?: { choices?: Array<{ message?: { content?: Array<{ image?: string }> } }> };
  };
  const url = data.output?.choices?.[0]?.message?.content?.[0]?.image;
  if (!url) throw new Error(`动作图生成响应缺少图片 URL: ${JSON.stringify(data)}`);

  const imgRes = await fetch(url);
  if (!imgRes.ok) throw new Error(`下载动作图失败: ${imgRes.status}`);
  return Buffer.from(await imgRes.arrayBuffer());
}
```

- [ ] **Step 2: 创建 `serve/src/lib/poseImageCache.ts`**

```ts
// 动作图磁盘缓存：按动作 id hash 存 png，每种只生成一次。路由与预热脚本共用。
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { generatePoseImage } from '../ai/poseImage.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
export const poseImagesDir = join(__dirname, '..', '..', 'pose-images');

function cacheFile(id: string): string {
  const hash = createHash('sha256').update(id).digest('hex');
  return join(poseImagesDir, `${hash}.png`);
}

// 返回该动作图 png Buffer；无缓存则调用 AI 生成并落盘（约 70s）。
export async function ensurePoseImage(id: string): Promise<Buffer> {
  mkdirSync(poseImagesDir, { recursive: true });
  const file = cacheFile(id);
  if (existsSync(file)) return readFile(file);
  const buf = await generatePoseImage(id);
  await writeFile(file, buf);
  return buf;
}

export function isPoseCached(id: string): boolean {
  return existsSync(cacheFile(id));
}
```

- [ ] **Step 3: 创建 `serve/src/routes/poseImage.ts`**

```ts
// 动作图路由：GET /api/pose-image?id=hands-up 返回 png（懒生成+磁盘缓存）。
import type { FastifyInstance } from 'fastify';
import { ensurePoseImage } from '../lib/poseImageCache.js';
import { POSE_DEFS } from '../ai/poseImage.js';

export function registerPoseImageRoutes(app: FastifyInstance): void {
  app.get('/pose-image', async (request, reply) => {
    const id = ((request.query as { id?: string }).id ?? '').trim();
    if (!id || !POSE_DEFS.some((p) => p.id === id)) {
      return reply.status(400).send({ error: '无效的动作 id' });
    }
    try {
      const png = await ensurePoseImage(id);
      return reply
        .header('Content-Type', 'image/png')
        .header('Cache-Control', 'public, max-age=31536000, immutable')
        .send(png);
    } catch (err) {
      const message = err instanceof Error ? err.message : '动作图生成失败';
      return reply.status(502).send({ error: message });
    }
  });
}
```

- [ ] **Step 4: 在 `serve/src/index.ts` 注册路由**

在其它 `import ... Routes` 附近加入（紧跟 `registerAnimalImageRoutes` 那行之后）：

```ts
import { registerPoseImageRoutes } from './routes/poseImage.js';
```

在注册区块里 `registerAnimalImageRoutes(instance);` 之后加入：

```ts
      registerPoseImageRoutes(instance);
```

- [ ] **Step 5: 创建预热脚本 `serve/src/scripts/warmupPoseImages.ts`**

```ts
// 手动预热：把 6 个动作图一次性生成并缓存。串行执行（避免并发触发限流）。
// 运行：npm run warmup:poses
import 'dotenv/config';
import { POSE_DEFS } from '../ai/poseImage.js';
import { ensurePoseImage, isPoseCached } from '../lib/poseImageCache.js';

async function main(): Promise<void> {
  console.log(`开始预热 ${POSE_DEFS.length} 个动作图（单张约 70s，串行）…`);
  for (const def of POSE_DEFS) {
    if (isPoseCached(def.id)) {
      console.log(`  ✓ ${def.name} 已缓存，跳过`);
      continue;
    }
    const t = Date.now();
    try {
      const buf = await ensurePoseImage(def.id);
      console.log(`  ✓ ${def.name} 生成完成 ${(buf.length / 1024).toFixed(0)}KB，用时 ${((Date.now() - t) / 1000).toFixed(0)}s`);
    } catch (err) {
      console.error(`  ✗ ${def.name} 失败：${err instanceof Error ? err.message : String(err)}`);
    }
  }
  console.log('预热结束。');
}

main();
```

- [ ] **Step 6: 在 `serve/package.json` 的 `scripts` 加预热命令**

在 `"warmup:images": "tsx src/scripts/warmupAnimalImages.ts"` 之后加：

```json
    "warmup:poses": "tsx src/scripts/warmupPoseImages.ts"
```

- [ ] **Step 7: 验证路由已挂载（快速，不触发生成）**

启动后端：`cd serve && npm run dev`
另开终端：`curl -s -o /dev/null -w "%{http_code}\n" "http://localhost:8787/api/pose-image?id=bad"`
Expected: `400`（说明路由生效、参数校验正常）。

- [ ] **Step 8: 预热真实图片（较慢，单张约 70s）**

`cd serve && npm run warmup:poses`
Expected: 6 个动作依次打印「生成完成 …KB」；`serve/pose-images/` 下出现 6 个 png。
（若已配好 `.env`。未配则会报缺少环境变量——此时先补 `.env` 再跑。）

- [ ] **Step 9: 提交**

```bash
git add serve/src/ai/poseImage.ts serve/src/lib/poseImageCache.ts serve/src/routes/poseImage.ts serve/src/scripts/warmupPoseImages.ts serve/src/index.ts serve/package.json
git commit -m "feat(serve): 动作参考图生成/缓存/路由 + 预热脚本"
```

---

## Task 2: 前端动作定义与姿态判定模块

**Files:**
- Create: `web/src/games/poses.ts`
- Modify: `web/package.json`（加依赖）

**Interfaces:**
- Consumes: 后端 `GET /api/pose-image?id=<id>`（Task 1）
- Produces:
  - `interface Landmark { x: number; y: number; z?: number; visibility?: number }`
  - `interface Pose { id: string; name: string; emoji: string; hint: string }`
  - `POSES: Pose[]`
  - `poseForLevel(level: number): Pose`
  - `poseImageUrl(pose: Pose): string`
  - `scorePose(landmarks: Landmark[] | undefined, pose: Pose): number` → 0–100

- [ ] **Step 1: 安装 MediaPipe 依赖**

```bash
cd web && npm install @mediapipe/tasks-vision@^0.10.14
```

Expected: `web/package.json` 的 `dependencies` 出现 `@mediapipe/tasks-vision`。

- [ ] **Step 2: 创建 `web/src/games/poses.ts`**

```ts
// 「跟我做动作」的动作定义与姿态判定。
// 判定基于关节角度（与身体位置/远近/体型无关）：从 MediaPipe 的 33 个骨骼点算出每侧
// 手臂的「肘角」和「大臂抬起角」，再按各动作模板打分，得出 0–100 相似度。

const RAW_BASE = import.meta.env.VITE_API_BASE ?? 'http://localhost:8787'
const API_BASE = RAW_BASE.replace(/\/$/, '')

// MediaPipe NormalizedLandmark：x/y 归一化到 [0,1]，y 向下为正。
export interface Landmark {
  x: number
  y: number
  z?: number
  visibility?: number
}

export interface Pose {
  id: string
  name: string
  emoji: string
  hint: string // 给小朋友的动作提示
}

// id 必须与后端 POSE_DEFS 一致。
export const POSES: Pose[] = [
  { id: 'hands-up', name: '双手举高', emoji: '🙌', hint: '双手用力举过头顶！' },
  { id: 't-pose', name: '双臂平举', emoji: '✋', hint: '两只手臂向两边伸平，像个大字！' },
  { id: 'hands-hip', name: '叉腰', emoji: '🤟', hint: '两只手叉在腰上，神气一点！' },
  { id: 'one-hand-up', name: '单手举起', emoji: '🙋', hint: '举起一只手，像回答问题！' },
  { id: 'hands-head', name: '抱抱头', emoji: '🤲', hint: '两只手抱住头顶！' },
  { id: 'arms-cross', name: '双臂交叉', emoji: '🙅', hint: '两只手臂在胸前交叉成 X！' },
]

// 第 level 关（从 1 开始）要模仿的动作，超出后循环。
export function poseForLevel(level: number): Pose {
  return POSES[(level - 1) % POSES.length]
}

export function poseImageUrl(pose: Pose): string {
  return `${API_BASE}/api/pose-image?id=${encodeURIComponent(pose.id)}`
}

// BlazePose 33 点里用到的下标。
const L = { shoulder: 11, elbow: 13, wrist: 15 }
const R = { shoulder: 12, elbow: 14, wrist: 16 }

// 三点 A-B-C 在 B 处的夹角（度）。手臂伸直≈180，弯曲≈90。
function angleAt(a: Landmark, b: Landmark, c: Landmark): number {
  const v1x = a.x - b.x, v1y = a.y - b.y
  const v2x = c.x - b.x, v2y = c.y - b.y
  const dot = v1x * v2x + v1y * v2y
  const m1 = Math.hypot(v1x, v1y), m2 = Math.hypot(v2x, v2y)
  if (m1 === 0 || m2 === 0) return 0
  const cos = Math.min(1, Math.max(-1, dot / (m1 * m2)))
  return (Math.acos(cos) * 180) / Math.PI
}

// 大臂相对「竖直向下」的抬起角：0=垂手，90=水平，180=举过头。
function elevation(shoulder: Landmark, elbow: Landmark): number {
  const vx = elbow.x - shoulder.x, vy = elbow.y - shoulder.y
  const m = Math.hypot(vx, vy)
  if (m === 0) return 0
  const cos = Math.min(1, Math.max(-1, vy / m)) // 与向下向量 (0,1) 的夹角
  return (Math.acos(cos) * 180) / Math.PI
}

interface Features {
  valid: boolean
  leftElbow: number
  rightElbow: number
  leftRaise: number
  rightRaise: number
  leftWristAbove: boolean
  rightWristAbove: boolean
  crossed: boolean
}

function extract(lm: Landmark[]): Features {
  const need = [L.shoulder, L.elbow, L.wrist, R.shoulder, R.elbow, R.wrist]
  const valid = lm.length >= 33 && need.every((i) => (lm[i]?.visibility ?? 1) > 0.5)
  const ls = lm[L.shoulder], le = lm[L.elbow], lw = lm[L.wrist]
  const rs = lm[R.shoulder], re = lm[R.elbow], rw = lm[R.wrist]
  return {
    valid,
    leftElbow: valid ? angleAt(ls, le, lw) : 0,
    rightElbow: valid ? angleAt(rs, re, rw) : 0,
    leftRaise: valid ? elevation(ls, le) : 0,
    rightRaise: valid ? elevation(rs, re) : 0,
    leftWristAbove: valid ? lw.y < ls.y : false,
    rightWristAbove: valid ? rw.y < rs.y : false,
    // 手腕左右次序相对肩膀左右次序反号 → 双臂交叉。
    crossed: valid ? Math.sign(lw.x - rw.x) !== Math.sign(ls.x - rs.x) : false,
  }
}

// target±tol 内线性得分 0..1。
function near(v: number, target: number, tol: number): number {
  return Math.max(0, 1 - Math.abs(v - target) / tol)
}

function avg(...xs: number[]): number {
  return xs.reduce((a, b) => a + b, 0) / xs.length
}

// 返回 0–100 相似度。未检测到有效人体时为 0。
export function scorePose(landmarks: Landmark[] | undefined, pose: Pose): number {
  if (!landmarks) return 0
  const f = extract(landmarks)
  if (!f.valid) return 0
  let s = 0
  switch (pose.id) {
    case 'hands-up':
      s = avg(near(f.leftRaise, 175, 40), near(f.rightRaise, 175, 40), near(f.leftElbow, 170, 50), near(f.rightElbow, 170, 50))
      break
    case 't-pose':
      s = avg(near(f.leftRaise, 90, 30), near(f.rightRaise, 90, 30), near(f.leftElbow, 170, 45), near(f.rightElbow, 170, 45))
      break
    case 'hands-hip':
      s = avg(near(f.leftElbow, 95, 45), near(f.rightElbow, 95, 45), near(f.leftRaise, 45, 40), near(f.rightRaise, 45, 40))
      break
    case 'one-hand-up': {
      // 一只手举高伸直、另一只手垂下；左右任一侧满足都算对。
      const oneUp = (upRaise: number, upElbow: number, downRaise: number) =>
        avg(near(upRaise, 175, 40), near(upElbow, 170, 50), near(downRaise, 10, 40))
      s = Math.max(oneUp(f.leftRaise, f.leftElbow, f.rightRaise), oneUp(f.rightRaise, f.rightElbow, f.leftRaise))
      break
    }
    case 'hands-head': {
      // 双手举到头顶：手腕高于肩、大臂高抬、肘部弯曲。
      const base = avg(near(f.leftElbow, 55, 45), near(f.rightElbow, 55, 45), near(f.leftRaise, 150, 45), near(f.rightRaise, 150, 45))
      s = base * (f.leftWristAbove && f.rightWristAbove ? 1 : 0.3)
      break
    }
    case 'arms-cross': {
      // 胸前交叉：手腕左右次序交换、肘部弯曲、大臂偏水平。
      const base = avg(near(f.leftElbow, 80, 50), near(f.rightElbow, 80, 50), near(f.leftRaise, 70, 45), near(f.rightRaise, 70, 45))
      s = base * (f.crossed ? 1 : 0.3)
      break
    }
    default:
      s = 0
  }
  return Math.round(s * 100)
}
```

- [ ] **Step 3: 编译校验**

```bash
cd web && npm run build
```

Expected: 编译通过（`poses.ts` 无类型错误）。此时页面还没引用它，只验证类型与导入正确。

- [ ] **Step 4: 提交**

```bash
git add web/package.json web/package-lock.json web/src/games/poses.ts
git commit -m "feat(web): 动作定义与姿态判定模块 + MediaPipe 依赖"
```

---

## Task 3: 游戏页 PoseMimic.tsx

**Files:**
- Create: `web/src/pages/PoseMimic.tsx`

**Interfaces:**
- Consumes:
  - `poses.ts`：`poseForLevel`、`poseImageUrl`、`scorePose`、`Landmark`
  - `storage.ts`：`loadProgress(gameId)`、`saveProgress(gameId, { level, score, best })`
  - `@mediapipe/tasks-vision`：`FilesetResolver`、`PoseLandmarker`、`PoseLandmarkerResult`
- Produces: `export default function PoseMimic`（供 App 路由挂载于 `/games/pose-mimic`）

- [ ] **Step 1: 创建 `web/src/pages/PoseMimic.tsx`**

```tsx
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { FilesetResolver, PoseLandmarker, type PoseLandmarkerResult } from '@mediapipe/tasks-vision'
import { loadProgress, saveProgress } from '../games/storage'
import { poseForLevel, poseImageUrl, scorePose, type Landmark } from '../games/poses'

// 「跟我做动作」游戏。
// 左侧是 AI 生成的卡通动作参考图，右侧是摄像头。小朋友模仿动作，浏览器用 MediaPipe
// 提取骨骼点算相似度；相似度≥阈值且连续保持约 2 秒即通关 +10 分，进入下一关。
// 分数与关卡自动存 storage（localStorage + 登录后端同步）。

const GAME_ID = 'pose-mimic'
const SCORE_PER_POSE = 10
const MATCH_THRESHOLD = 75 // 相似度达标线（0–100）
const HOLD_MS = 2000 // 需保持的时长
const DETECT_INTERVAL_MS = 100 // 检测节流，约 10fps

const WASM_URL = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm'
const MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task'

type Phase = 'loading' | 'ready' | 'error'

function PoseMimic() {
  const saved = useMemo(() => loadProgress(GAME_ID), [])
  const [level, setLevel] = useState(saved.level)
  const [score, setScore] = useState(saved.score)
  const [best, setBest] = useState(saved.best)
  const [phase, setPhase] = useState<Phase>('loading')
  const [errMsg, setErrMsg] = useState('')
  const [similarity, setSimilarity] = useState(0)
  const [holdMs, setHoldMs] = useState(0)
  const [levelDone, setLevelDone] = useState(false)

  const videoRef = useRef<HTMLVideoElement>(null)
  const landmarkerRef = useRef<PoseLandmarker | null>(null)
  const rafRef = useRef<number>(0)
  const streamRef = useRef<MediaStream | null>(null)
  const holdStartRef = useRef<number | null>(null)
  const lastDetectRef = useRef(0)
  const levelRef = useRef(level)
  const doneRef = useRef(false)

  const pose = poseForLevel(level)

  // 关卡变化：同步给检测循环用的 ref，并重置本关状态。
  useEffect(() => {
    levelRef.current = level
    doneRef.current = false
    holdStartRef.current = null
    setHoldMs(0)
    setSimilarity(0)
    setLevelDone(false)
  }, [level])

  // 分数/关卡变化即持久化。
  useEffect(() => {
    saveProgress(GAME_ID, { level, score, best })
  }, [level, score, best])

  // 初始化：开摄像头 + 加载 MediaPipe 模型 + 启动检测循环（仅一次，全程保持挂载）。
  useEffect(() => {
    let cancelled = false

    async function init() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false })
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop())
          return
        }
        streamRef.current = stream
        const video = videoRef.current!
        video.srcObject = stream
        await video.play()

        const vision = await FilesetResolver.forVisionTasks(WASM_URL)
        const landmarker = await PoseLandmarker.createFromOptions(vision, {
          baseOptions: { modelAssetPath: MODEL_URL, delegate: 'GPU' },
          runningMode: 'VIDEO',
          numPoses: 1,
        })
        if (cancelled) {
          landmarker.close()
          return
        }
        landmarkerRef.current = landmarker
        setPhase('ready')
        rafRef.current = requestAnimationFrame(loop)
      } catch (err) {
        if (cancelled) return
        const msg = err instanceof Error ? err.message : String(err)
        setErrMsg(
          /permission|denied|notallowed/i.test(msg)
            ? '需要摄像头权限才能玩哦，请在浏览器允许摄像头后刷新页面～'
            : `摄像头或模型加载失败：${msg}`,
        )
        setPhase('error')
      }
    }

    function loop() {
      const video = videoRef.current
      const landmarker = landmarkerRef.current
      if (video && landmarker && video.readyState >= 2) {
        const now = performance.now()
        if (now - lastDetectRef.current >= DETECT_INTERVAL_MS) {
          lastDetectRef.current = now
          const result: PoseLandmarkerResult = landmarker.detectForVideo(video, now)
          const landmarks = result.landmarks?.[0] as Landmark[] | undefined
          const current = poseForLevel(levelRef.current)
          const sim = scorePose(landmarks, current)
          setSimilarity(sim)

          if (!doneRef.current) {
            if (sim >= MATCH_THRESHOLD) {
              if (holdStartRef.current == null) holdStartRef.current = now
              const held = now - holdStartRef.current
              setHoldMs(held)
              if (held >= HOLD_MS) {
                doneRef.current = true
                setLevelDone(true)
              }
            } else {
              holdStartRef.current = null
              setHoldMs(0)
            }
          }
        }
      }
      rafRef.current = requestAnimationFrame(loop)
    }

    init()
    return () => {
      cancelled = true
      cancelAnimationFrame(rafRef.current)
      landmarkerRef.current?.close()
      landmarkerRef.current = null
      streamRef.current?.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 通关结算：加分（函数式更新，避免闭包旧值 / 重复加分）。
  useEffect(() => {
    if (!levelDone) return
    setScore((s) => {
      const ns = s + SCORE_PER_POSE
      setBest((b) => Math.max(b, ns))
      return ns
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [levelDone])

  function nextLevel() {
    setLevel((l) => l + 1)
  }

  function restart() {
    if (!window.confirm('确定要从第 1 关重新开始？当前分数会清零（最高分保留）。')) return
    setScore(0)
    setLevel(1)
  }

  const holdPct = Math.min(100, Math.round((holdMs / HOLD_MS) * 100))
  const hit = similarity >= MATCH_THRESHOLD

  return (
    <div className="min-h-screen bg-gradient-to-b from-brand-50 via-brand-100/60 to-brand-50 py-8 px-4">
      <div className="max-w-3xl mx-auto">
        {/* 顶部状态条 */}
        <div className="flex items-center justify-between mb-6">
          <Link to="/games" className="text-sm font-bold text-brand-600 hover:underline">
            ← 返回游戏乐园
          </Link>
          <button
            type="button"
            onClick={restart}
            className="text-xs font-bold text-rose-500 bg-rose-50 hover:bg-rose-100 rounded-full px-3 py-1 transition-colors"
          >
            重新开始
          </button>
        </div>

        <div className="grid grid-cols-3 gap-3 mb-6">
          <Stat label="关卡" value={`第 ${level} 关`} />
          <Stat label="得分" value={`${score}`} />
          <Stat label="最高分" value={`${best}`} />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* 参考图 */}
          <div className="bg-white rounded-2xl shadow-card ring-1 ring-brand-100 p-5 text-center">
            <div className="text-sm font-black text-stone-900 mb-1">
              {pose.emoji} 模仿这个动作：{pose.name}
            </div>
            <p className="text-xs text-stone-500 mb-3">{pose.hint}</p>
            <div className="aspect-square w-full rounded-xl bg-stone-50 overflow-hidden flex items-center justify-center">
              <img
                key={pose.id}
                src={poseImageUrl(pose)}
                alt={pose.name}
                className="w-full h-full object-contain"
              />
            </div>
          </div>

          {/* 摄像头 + 判定反馈 */}
          <div className="bg-white rounded-2xl shadow-card ring-1 ring-brand-100 p-5">
            <div className="relative aspect-square w-full rounded-xl bg-stone-900 overflow-hidden">
              <video
                ref={videoRef}
                playsInline
                muted
                className="w-full h-full object-cover"
                style={{ transform: 'scaleX(-1)' }} // 镜像显示，像照镜子；不影响判定
              />

              {phase === 'loading' && (
                <div className="absolute inset-0 flex items-center justify-center bg-stone-900/80 text-white text-sm font-bold">
                  正在准备摄像头和 AI…
                </div>
              )}

              {phase === 'error' && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-stone-900/85 text-white text-center px-4">
                  <p className="text-sm">{errMsg}</p>
                  <button
                    type="button"
                    onClick={() => window.location.reload()}
                    className="bg-white text-stone-900 font-bold text-xs px-4 py-2 rounded-full"
                  >
                    刷新重试
                  </button>
                </div>
              )}

              {levelDone && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-green-600/85 text-white text-center px-4">
                  <div className="text-5xl">🎉</div>
                  <div className="text-lg font-black">动作正确！+{SCORE_PER_POSE} 分</div>
                  <button
                    type="button"
                    onClick={nextLevel}
                    className="bg-white text-green-700 font-black px-5 py-2 rounded-full shadow-soft"
                  >
                    下一个动作 →
                  </button>
                </div>
              )}
            </div>

            {/* 相似度进度条 */}
            {phase === 'ready' && !levelDone && (
              <div className="mt-4">
                <div className="flex justify-between text-xs font-bold text-stone-500 mb-1">
                  <span>相似度</span>
                  <span className={hit ? 'text-green-600' : 'text-stone-500'}>{similarity}</span>
                </div>
                <div className="h-3 rounded-full bg-stone-100 overflow-hidden">
                  <div
                    className={'h-full transition-all ' + (hit ? 'bg-green-500' : 'bg-brand-400')}
                    style={{ width: `${similarity}%` }}
                  />
                </div>
                <p className="text-center text-xs mt-2 font-bold text-stone-500">
                  {hit ? `保持住！${Math.ceil((HOLD_MS - holdMs) / 1000)}…` : '调整动作，让相似度超过 75 分'}
                </p>
                {hit && (
                  <div className="mt-1 h-1.5 rounded-full bg-green-100 overflow-hidden">
                    <div className="h-full bg-green-500 transition-all" style={{ width: `${holdPct}%` }} />
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white rounded-2xl shadow-card ring-1 ring-brand-100 py-3 text-center">
      <div className="text-xs text-stone-400 font-bold">{label}</div>
      <div className="text-lg font-black text-stone-900">{value}</div>
    </div>
  )
}

export default PoseMimic
```

- [ ] **Step 2: 编译校验**

```bash
cd web && npm run build
```

Expected: 编译通过（`@mediapipe/tasks-vision` 类型导入正确、页面无类型错误）。

- [ ] **Step 3: 提交**

```bash
git add web/src/pages/PoseMimic.tsx
git commit -m "feat(web): 跟我做动作 游戏页(摄像头+姿态判定+计分)"
```

---

## Task 4: 接线（路由 + 卡片 + 进度同步）与端到端验证

**Files:**
- Modify: `web/src/App.tsx`
- Modify: `web/src/pages/Games.tsx`
- Modify: `web/src/games/storage.ts`

**Interfaces:**
- Consumes: `PoseMimic`（Task 3）、游戏 id `'pose-mimic'`

- [ ] **Step 1: `web/src/App.tsx` 加路由**

在 `import ShapeMatch from './pages/ShapeMatch'` 之后加：

```tsx
import PoseMimic from './pages/PoseMimic'
```

在 `<Route path="/games/shape-match" element={<ShapeMatch />} />` 之后加：

```tsx
        <Route path="/games/pose-mimic" element={<PoseMimic />} />
```

- [ ] **Step 2: `web/src/pages/Games.tsx` 加游戏卡片**

在 `GAMES` 数组里，`memory-flip` 那项之后、`coming-soon` 之前插入：

```tsx
  {
    id: 'pose-mimic',
    to: '/games/pose-mimic',
    title: '跟我做动作',
    desc: '看 AI 画的小人做动作，用摄像头模仿它，做对就得分！',
    emoji: '🤸',
    ready: true,
  },
```

- [ ] **Step 3: `web/src/games/storage.ts` 把游戏加入 hydrate 列表**

将：

```ts
export const KNOWN_GAME_IDS = ['animal-sound', 'shape-match'];
```

改为：

```ts
export const KNOWN_GAME_IDS = ['animal-sound', 'shape-match', 'pose-mimic'];
```

- [ ] **Step 4: 编译校验**

```bash
cd web && npm run build
```

Expected: 编译通过。

- [ ] **Step 5: 端到端验证（浏览器，需 https 或 localhost 才能开摄像头）**

前置：`cd serve && npm run dev`（另一个终端）；`cd web && npm run dev`。
用 Chrome 打开 `http://localhost:5173/games`，逐项确认：
1. 「游戏乐园」出现「🤸 跟我做动作」卡片，点击进入 `/games/pose-mimic`。
2. 浏览器弹出摄像头授权，允许后看到自己的镜像画面（加载中先显示「正在准备摄像头和 AI…」）。
3. 左侧显示第 1 关动作参考图（`双手举高`）与提示文字。
4. 举起双手，右下「相似度」升到 75 以上变绿，出现「保持住！2…1…」倒计时；保持约 2 秒后出现 🎉「动作正确！+10 分」，得分变为 10。
5. 点「下一个动作 →」进入第 2 关，参考图换成「双臂平举」。
6. 拒绝摄像头授权时（可在浏览器站点设置里禁用后刷新）显示友好提示 + 「刷新重试」，不白屏。
7. 刷新页面后关卡与得分保留（localStorage 生效）。

- [ ] **Step 6: 提交**

```bash
git add web/src/App.tsx web/src/pages/Games.tsx web/src/games/storage.ts
git commit -m "feat(web): 接入 跟我做动作 游戏(路由/卡片/进度同步)"
```

---

## Self-Review

- **Spec 覆盖**：动作集/判定/关卡记分/AI 参考图/接线/容错——分别落在 Task 2（poses+判定）、Task 3（页面+保持机制+摄像头容错）、Task 1（后端参考图+预热）、Task 4（接线+持久化）。✔
- **Placeholder**：无 TBD/TODO，代码均完整。✔
- **类型一致**：前后端动作 id 集合一致（6 个）；`Landmark`/`Pose`/`scorePose`/`poseForLevel`/`poseImageUrl` 在 Task 2 定义、Task 3 消费，签名一致；`ensurePoseImage`/`isPoseCached`/`POSE_DEFS`/`registerPoseImageRoutes` 在 Task 1 内自洽。✔
- **约定**：无测试，均用 build + 浏览器验证；ESM `.js` 后缀导入；UI/存储复用现有模式。✔
