# 《跟我做动作》(Pose Mimic) 人机互动小游戏 — 设计文档

日期：2026-07-03
模块：游戏乐园（class-lab / web + serve）

## 1. 背景与目标

在现有「游戏乐园」中新增一个人机互动小游戏：AI 生成一张卡通小人做某个动作的参考图，
小朋友通过摄像头模仿该动作，浏览器实时判断动作是否一致，达标即通关得分。
分数与关卡沿用现有进度存储（localStorage + 登录后端同步）。

面向用户：儿童（class-lab 是儿童教育/ABA 训练应用）。因此动作要简单、正面、
坐着或站着对着笔记本摄像头都能完成，判定要宽容、避免手抖误判。

## 2. 玩法概述

- 页面左侧：AI 生成的卡通参考图（小人做某个动作）。
- 页面右侧：摄像头实时画面（可叠加骨骼点/进度反馈）。
- 小朋友模仿参考图动作，姿态相似度 ≥ 阈值并**连续保持约 2 秒**即通关。
- 通关 +10 分，进入下一关，展示下一个动作。中途相似度掉下来则保持计时重置。

## 3. 预设动作集

全部只依赖上半身/手臂关键点，保证摄像头常见取景（半身正面）即可识别：

| id | 名称 | emoji | 动作描述（用于生成参考图 & 判定） |
|---|---|---|---|
| `hands-up` | 双手举高 | 🙌 | 双臂向上高举过头 |
| `t-pose` | 双臂平举 | ✋ | 双臂水平向两侧伸直（T 字） |
| `hands-hip` | 叉腰 | 🤟 | 双手叉在腰间，肘部向外 |
| `one-hand-up` | 单手举起 | 🙋 | 举起一只手（左右手均算对） |
| `hands-head` | 抱头 | 🤲 | 双手放在头顶/后脑 |
| `arms-cross` | 双臂交叉 | 🙅 | 双臂在胸前交叉 |

每个动作用**关键关节角度模板**定义（见下）。单手类动作对左右手都判定通过，
规避摄像头镜像导致的左右误判。

## 4. 判定逻辑（浏览器端，实时、免费）

- 使用 `@mediapipe/tasks-vision` 的 `PoseLandmarker` 从摄像头逐帧提取 33 个骨骼点。
  模型（`pose_landmarker_lite.task`）与 wasm 运行时从 CDN 加载。
- 采用**关节角度**而非原始坐标做匹配 —— 角度对身体位置、距离摄像头远近、体型都无关，
  比裸坐标距离鲁棒得多，也无需归一化。
- 每个动作模板 = 若干 `{ 关节角度定义, 目标值, 容差 }`。常用角度：
  - 肘部角度：肩–肘–腕 三点夹角（判断手臂伸直/弯曲）。
  - 大臂抬起角度：上臂向量相对躯干竖直方向的夹角（判断手臂举高/平举/下垂）。
- `scorePose(landmarks, pose)` 返回 0–100 相似度：各角度与目标的接近程度综合。
  相似度 ≥ 阈值（如 75）视为「命中当前帧」。
- **保持机制**：命中帧连续累计到 ~2 秒 → 通关。任一帧未命中则计时归零重来。
  UI 显示实时相似度进度条 + 保持倒计时。
- 检测循环约 10fps（`requestAnimationFrame` 或定时器），足够且省电。

## 5. 关卡与记分（复用现有 storage）

- 每关 = 一个动作。完成当前动作 +10 分（`SCORE_PER_MATCH = 10`），进入下一关。
- 动作按顺序循环取用，`level` 持续递增（与 shape-match 一致的递增模型）。
- 进度 `{ level, score, best }` 走现成 [storage.ts](../../../web/src/games/storage.ts)：
  localStorage 同步缓存 + 登录后 `putModuleData/getModuleData` 后端同步。
- 在 `KNOWN_GAME_IDS` 加入 `'pose-mimic'`，使登录时能从后端 hydrate 该游戏进度。

## 6. AI 参考图（复用现有图片生成 + 磁盘缓存模式）

后端仿照现有动物图三件套：

- `serve/src/ai/poseImage.ts`：仿 [animalImage.ts](../../../serve/src/ai/animalImage.ts)，
  维护 `POSE_PROMPTS`（id → 中文动作描述），按描述调 qwen-image（`IMAGE_MODEL`）生成卡通图。
  prompt 形如：`儿童绘本卡通插画风格，一个可爱的小朋友正在<动作描述>，纯白背景，正面半身构图，色彩明亮，画面中不要出现任何文字`。
- `serve/src/lib/poseImageCache.ts`：仿 [animalImageCache.ts](../../../serve/src/lib/animalImageCache.ts)，
  按动作 id（hash）磁盘缓存 png，单张只生成一次（约 70s）。目录 `serve/pose-images/`。
- `serve/src/routes/poseImage.ts`：`GET /api/pose-image?id=hands-up` 返回 png（懒生成 + 长缓存头），
  在 [index.ts](../../../serve/src/index.ts) 用 `registerPoseImageRoutes` 注册。
- 预热脚本 `serve/src/scripts/`（仿现有）：一次性把 6 张动作图预生成，避免首玩等待。

动作 id 与名称在前后端各维护一份（前端 `poses.ts` 含角度模板，后端 `poseImage.ts` 含图片 prompt），
与现有 `ANIMAL_NAMES` 前后端各存一份的做法一致，可接受。

## 7. 新增 / 改动文件

| 文件 | 作用 |
|---|---|
| `web/src/games/poses.ts` | 动作定义（id/名称/emoji/角度模板）+ `scorePose()` + 角度工具 |
| `web/src/pages/PoseMimic.tsx` | 游戏页：摄像头 + PoseLandmarker + 判定 + 记分 UI |
| `web/src/pages/Games.tsx` | 新增游戏卡片 `pose-mimic` |
| `web/src/App.tsx` | 新增路由 `/games/pose-mimic` |
| `web/src/games/storage.ts` | `KNOWN_GAME_IDS` 加入 `'pose-mimic'` |
| `web/package.json` | 依赖 `@mediapipe/tasks-vision` |
| `serve/src/ai/poseImage.ts` | 动作参考图生成 |
| `serve/src/lib/poseImageCache.ts` | 动作图磁盘缓存 |
| `serve/src/routes/poseImage.ts` | 参考图路由 |
| `serve/src/index.ts` | 注册路由 |
| `serve/src/scripts/prewarm-pose-images.ts` | 预热 6 张动作图（可选运行） |

## 8. 边界与容错

- **摄像头权限被拒**：捕获 `getUserMedia` 异常，页面显示友好提示（如「需要摄像头权限才能玩哦」），不崩溃。
- **模型/wasm 加载失败**（无网络 / CDN 不可达）：显示加载失败提示与重试按钮。
- **首次图片慢**：某动作图第一次进入需等 AI 生成（~70s），显示「正在画画中…」占位；预热脚本可提前消除等待。
- **未检测到人**：无骨骼点时相似度为 0，进度条为空，不误判通关。
- **组件卸载**：停止摄像头轨道与检测循环，释放 PoseLandmarker，避免资源泄漏。

## 9. 明确不做（YAGNI）

- 不做全身/腿部动作（单腿站立等），规避取景与安全问题。
- 不写自动化测试（遵循项目约定：build + 浏览器 E2E 手动验证）。
- 不做多人 / 排行榜 / 分享。
- 不从生成图反推姿态（已确认走预设角度模板方案，更稳更快）。
