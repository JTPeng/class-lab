# 康复师培训测评模块 —— 学习 + 测评 设计

## 背景

面向康复师本人的"学练测一体"培训体系（模块五）中的前两个环节：**学习**（培训视频文字稿 → 结构化图文）与**测评**（AI 生成题库 → 答题 → 反馈）。"练习"环节（AI 情景模拟）不在本次范围内，后续单独设计。

该模块与现有儿童训练闭环（Cases / PictureBook / Games）服务对象不同（培训康复师本人 vs 训练儿童），因此作为**独立模块**新增路由、页面与数据表，不复用儿童训练相关表结构。参见 [[project_training_module]]。

## 数据来源

`docs/riceai 培训视频文字内容.xlsx`，159 行，每行代表一个培训视频主题，列：

- `主题`：标题
- `视频内容`：完整逐字稿（ASR 转写，含少量错别字，无需再做语音转文字）
- `视频各时段内容`：带时间戳的分句 JSON（`{text, begin_time, end_time, sentence_id}`），本次不使用

数据已是现成文字稿，**不需要接入 ASR 服务**。导入是一次性批量操作，导入后数据不再变化（不做后续持续新增的管理后台）。

## 数据模型

复用现有 `id`/`createdAt` 约定（`randomUUID()` 生成 id，MySQL 下 id 列 `VARCHAR(191)`，长文本用 `LONGTEXT`，SQLite 下用 `TEXT`），参考 `serve/src/db/cases.ts` 的写法。

### `training_topics`

| 字段 | 类型 | 说明 |
|---|---|---|
| id | id | 主键 |
| title | TEXT | 主题（来自 Excel `主题` 列） |
| rawTranscript | LONGTEXT | 原始逐字稿（来自 Excel `视频内容` 列） |
| structuredContent | LONGTEXT | AI 生成的结构化图文内容（标题/分段小标题/重点摘要的纯文字排版，无需真实配图），首次访问或导入时生成后落库，之后复用 |
| createdAt | TEXT | 创建时间 |

不做分类/标签字段，前端平铺列表展示。

### `training_questions`

| 字段 | 类型 | 说明 |
|---|---|---|
| id | id | 主键 |
| topicId | id | 外键 → training_topics.id |
| type | TEXT | `single` \| `multi` |
| question | TEXT | 题干 |
| options | LONGTEXT (JSON) | 选项数组 |
| correctAnswers | LONGTEXT (JSON) | 正确答案下标数组 |
| explanation | LONGTEXT | 解析 |
| createdAt | TEXT | 创建时间 |

每个 topic 固定生成 **10 道题**（单选+多选混合），首次请求题库时通过 AI 生成一次并落库，之后复用，不重复调用 AI。

### `training_attempts`

| 字段 | 类型 | 说明 |
|---|---|---|
| id | id | 主键 |
| topicId | id | 外键 → training_topics.id |
| userId | id | 康复师账号 id |
| answers | LONGTEXT (JSON) | 每题作答记录 |
| score | INTEGER | 得分（正确题数） |
| feedback | LONGTEXT | AI 生成的学习建议 + 鼓励性反馈（情绪价值） |
| createdAt | TEXT | 创建时间 |

## 学习模块流程

1. **一次性导入脚本**（`serve/src/scripts/` 下新增，参考现有脚本约定）：
   - 读取 xlsx 的 `主题`、`视频内容` 两列（忽略 `视频各时段内容`）
   - 先跑 **10 条**验证完整链路（提取 → AI 结构化 → 落库 → 前端可查看），验证通过后再补齐剩余 149 条
   - 对每条调用 AI（复用 `serve/src/ai/textClient.ts` 的 `generateJson`）把逐字稿整理成结构化图文，写入 `structuredContent`
2. **前端展示**：`TrainingTopics.tsx` 平铺列表（标题+简介），点击进入 `TrainingTopicDetail.tsx` 查看结构化内容，页面内提供"开始测评"入口

## 测评模块流程

1. 进入某主题测评时，若该 topic 尚无题库，触发 AI 生成固定 10 道题（单选+多选混合，每题带解析），落库
2. 答题页 `TrainingQuiz.tsx`：一题一题作答，"上一题/下一题"导航，不做进度条等复杂 UI
3. 交卷后：
   - 计算得分（正确题数 / 10）
   - 调 AI 根据答题情况（哪些题错了、涉及哪些知识点）生成一段学习建议 + 鼓励性反馈
   - 结果直接在 Quiz 页面内展示（不单独开结果页路由），写入 `training_attempts`

## API

| Method | Path | 说明 |
|---|---|---|
| GET | `/training/topics` | 主题列表 |
| GET | `/training/topics/:id` | 主题详情（结构化图文内容） |
| GET | `/training/topics/:id/questions` | 题库（若未生成，触发 AI 生成后返回） |
| POST | `/training/topics/:id/attempts` | 提交答题，返回分数 + AI 建议与反馈 |
| GET | `/training/topics/:id/attempts` | 历史测评记录（按当前康复师账号过滤） |

## 页面

- `TrainingTopics.tsx` — 主题列表
- `TrainingTopicDetail.tsx` — 学习内容 + 进入测评入口
- `TrainingQuiz.tsx` — 答题（上一题/下一题）+ 交卷后在同页展示分数/建议/反馈

## 范围外（不做）

- ASR 语音转文字（数据已是现成文字稿）
- 视频时间戳分段内容的使用
- 主题分类/标签/分组
- 真实配图/关键帧截图
- 持续增量导入的管理后台（本次是一次性批量导入）
- "练习"环节（AI 情景模拟）——后续单独设计
