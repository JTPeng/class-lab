# 培训测评模块（学习 + 测评）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 上线康复师培训测评模块的"学习"（视频文字稿 → AI 结构化图文）与"测评"（AI 生成题库 → 答题 → AI 反馈）两个环节。

**Architecture:** 独立于现有 Cases/PictureBook 儿童训练闭环的新模块：3 张新表（`training_topics`/`training_questions`/`training_attempts`），复用现有 `generateJson` + zod 校验重试一次的 AI 调用模式，独立路由 `/api/training/*`，独立前端页面 + 顶部/底部导航新增一个 Tab。设计详情见 [`docs/superpowers/specs/2026-07-04-training-learning-quiz-design.md`](../specs/2026-07-04-training-learning-quiz-design.md)。

**Tech Stack:** Fastify + better-sqlite3/mysql2（后端），React + react-router-dom + Tailwind（前端），阿里云百炼 MAAS（AI，通过现有 `serve/src/ai/textClient.ts`），`xlsx`（一次性导入脚本读 Excel，新增依赖）。

## Global Constraints

- **不写新测试文件**：本项目 Slice 2+ 阶段用户已明确指示不再新增 test 文件（见项目记忆 `class-lab-no-test-files`）。每个任务的验证方式改为：后端用 `npx tsc --noEmit` 类型检查 + 手动运行验证；前端用 `npm run build`；全部完成后做一次真实浏览器端到端验证（chrome-devtools）。
- 数据一次性导入：`docs/riceai 培训视频文字内容.xlsx` 的 159 条数据不做持续增量管理后台，只有一次性脚本。
- 表结构 id 列在 MySQL 下为 `VARCHAR(191)`，SQLite 下为 `TEXT`；长文本字段 MySQL 下为 `LONGTEXT`，SQLite 下为 `TEXT`（与 `serve/src/db/cases.ts` 一致）。
- 每个 topic 固定生成 10 道题，首次请求题库时生成并落库，之后复用，不重复调用 AI。
- 学习内容"图文"指纯文字结构化排版（标题+分段+摘要），不生成/使用真实图片。

---

### Task 1: 培训模块的 schema 类型与 zod 校验

**Files:**
- Create: `serve/src/schema/training.ts`

**Interfaces:**
- Produces: `StructuredContentSchema`（zod）、`StructuredContent`（type）、`QuestionBankSchema`（zod）、`GeneratedQuestion`（type）、`FeedbackSchema`（zod）、`TrainingTopic`、`TrainingQuestion`、`TrainingAttempt`（interface，供 db 层使用）

- [ ] **Step 1: 创建 schema 文件**

```typescript
// serve/src/schema/training.ts
import { z } from 'zod';

export const TrainingSectionSchema = z.object({
  heading: z.string(),
  body: z.string(),
});
export type TrainingSection = z.infer<typeof TrainingSectionSchema>;

export const StructuredContentSchema = z.object({
  summary: z.string(),
  sections: z.array(TrainingSectionSchema).min(1),
});
export type StructuredContent = z.infer<typeof StructuredContentSchema>;

export const QuestionTypeSchema = z.enum(['single', 'multi']);
export type QuestionType = z.infer<typeof QuestionTypeSchema>;

export const GeneratedQuestionSchema = z.object({
  type: QuestionTypeSchema,
  question: z.string(),
  options: z.array(z.string()).min(2),
  correctAnswers: z.array(z.number().int().min(0)).min(1),
  explanation: z.string(),
});
export type GeneratedQuestion = z.infer<typeof GeneratedQuestionSchema>;

export const QuestionBankSchema = z.object({
  questions: z.array(GeneratedQuestionSchema).length(10),
});
export type QuestionBank = z.infer<typeof QuestionBankSchema>;

export const FeedbackSchema = z.object({
  feedback: z.string(),
});

export interface TrainingTopic {
  id: string;
  title: string;
  rawTranscript: string;
  structuredContent: StructuredContent | null;
  createdAt: string;
}

export interface TrainingQuestion {
  id: string;
  topicId: string;
  type: QuestionType;
  question: string;
  options: string[];
  correctAnswers: number[];
  explanation: string;
  createdAt: string;
}

export interface TrainingAttempt {
  id: string;
  topicId: string;
  userId: string;
  answers: number[][];
  score: number;
  feedback: string;
  createdAt: string;
}
```

- [ ] **Step 2: 类型检查**

Run: `cd serve && npx tsc --noEmit`
Expected: 无报错（新文件未被任何地方引用，只做语法/类型检查）

- [ ] **Step 3: Commit**

```bash
git add serve/src/schema/training.ts
git commit -m "feat(serve): 培训模块 schema 类型定义"
```

---

### Task 2: AI Prompt 构造函数

**Files:**
- Create: `serve/src/ai/trainingPrompts.ts`

**Interfaces:**
- Consumes: 无
- Produces: `STRUCTURE_SYSTEM_PROMPT`、`buildStructurePrompt(title, rawTranscript): string`、`QUESTION_SYSTEM_PROMPT`、`buildQuestionPrompt(summary, sections): string`、`FEEDBACK_SYSTEM_PROMPT`、`buildFeedbackPrompt(score, total, wrongItems): string`

- [ ] **Step 1: 创建 prompt 文件**

```typescript
// serve/src/ai/trainingPrompts.ts
import type { TrainingSection } from '../schema/training.js';

export const STRUCTURE_SYSTEM_PROMPT = `你是特教/康复行业的培训内容编辑。你会收到一段培训视频的逐字稿（可能包含语音识别错别字），
请将其整理成结构化的图文学习内容，输出 JSON 对象，格式为：
{"summary": "整体内容的一段话摘要", "sections": [{"heading": "小标题", "body": "该部分内容，可分段，纯文字，不要使用图片或markdown语法"}]}
要求：
1. 修正明显的语音识别错别字，但不要改变原意
2. 按内容逻辑拆分为多个 section，每个 section 有清晰小标题
3. summary 控制在 100 字以内
4. 只输出 JSON，不要有多余文字`;

export function buildStructurePrompt(title: string, rawTranscript: string): string {
  return `培训主题：${title}\n\n逐字稿：\n${rawTranscript}`;
}

export const QUESTION_SYSTEM_PROMPT = `你是特教/康复行业的培训测评出题老师。你会收到一段结构化的培训学习内容，
请据此生成恰好 10 道测评题目（单选题和多选题混合），输出 JSON 对象，格式为：
{"questions": [{"type": "single或multi", "question": "题干", "options": ["选项1","选项2"], "correctAnswers": [0], "explanation": "解析：为什么这个答案是对的"}]}
要求：
1. 题目必须能从给定内容中找到依据，不要编造内容之外的知识点
2. type 为 single 时 correctAnswers 只有一个下标（从 0 开始）；为 multi 时至少两个下标
3. 每题 3-5 个选项
4. 只输出 JSON，不要有多余文字`;

export function buildQuestionPrompt(summary: string, sections: TrainingSection[]): string {
  const body = sections.map((s) => `## ${s.heading}\n${s.body}`).join('\n\n');
  return `内容摘要：${summary}\n\n${body}`;
}

export const FEEDBACK_SYSTEM_PROMPT = `你是一位温暖、鼓励的培训导师。你会收到一位康复师本次测评的得分和错题详情，请给出：
1) 针对错题涉及知识点的具体学习建议 2) 一段鼓励性的话（无论分数高低都要给情绪价值，认可其付出）。
输出 JSON 对象：{"feedback": "建议与鼓励的完整文字，可分段"}。只输出 JSON，不要有多余文字。`;

export function buildFeedbackPrompt(
  score: number,
  total: number,
  wrongItems: { question: string; explanation: string }[],
): string {
  const wrongText = wrongItems.length
    ? wrongItems.map((w) => `题目：${w.question}\n解析：${w.explanation}`).join('\n\n')
    : '本次全部答对，没有错题。';
  return `得分：${score}/${total}\n\n错题详情：\n${wrongText}`;
}
```

- [ ] **Step 2: 类型检查**

Run: `cd serve && npx tsc --noEmit`
Expected: 无报错

- [ ] **Step 3: Commit**

```bash
git add serve/src/ai/trainingPrompts.ts
git commit -m "feat(serve): 培训模块 AI prompt 构造函数"
```

---

### Task 3: 结构化内容生成 service

**Files:**
- Create: `serve/src/services/generateTrainingContent.ts`

**Interfaces:**
- Consumes: `generateJson` (`serve/src/ai/textClient.ts`)、`STRUCTURE_SYSTEM_PROMPT`/`buildStructurePrompt` (Task 2)、`StructuredContentSchema`/`StructuredContent` (Task 1)
- Produces: `generateStructuredContent(title: string, rawTranscript: string, deps?): Promise<StructuredContent>`

- [ ] **Step 1: 创建 service 文件**

```typescript
// serve/src/services/generateTrainingContent.ts
import { generateJson as defaultGenerateJson } from '../ai/textClient.js';
import { buildStructurePrompt, STRUCTURE_SYSTEM_PROMPT } from '../ai/trainingPrompts.js';
import { StructuredContentSchema, type StructuredContent } from '../schema/training.js';

export interface GenerateTrainingContentDeps {
  generateJson?: typeof defaultGenerateJson;
}

export async function generateStructuredContent(
  title: string,
  rawTranscript: string,
  deps: GenerateTrainingContentDeps = {},
): Promise<StructuredContent> {
  const generateJson = deps.generateJson ?? defaultGenerateJson;
  const userPrompt = buildStructurePrompt(title, rawTranscript);

  const firstRaw = await generateJson(STRUCTURE_SYSTEM_PROMPT, userPrompt);
  const firstResult = StructuredContentSchema.safeParse(firstRaw);
  if (firstResult.success) return firstResult.data;

  const retryPrompt = `${userPrompt}\n\n上一次生成的 JSON 未通过校验，错误如下，请修正后重新输出一个完整、合法的 JSON 对象：\n${JSON.stringify(firstResult.error.issues)}`;
  const secondRaw = await generateJson(STRUCTURE_SYSTEM_PROMPT, retryPrompt);
  const secondResult = StructuredContentSchema.safeParse(secondRaw);
  if (!secondResult.success) {
    throw new Error(`结构化内容生成两次校验均失败: ${JSON.stringify(secondResult.error.issues)}`);
  }
  return secondResult.data;
}
```

- [ ] **Step 2: 类型检查**

Run: `cd serve && npx tsc --noEmit`
Expected: 无报错

- [ ] **Step 3: Commit**

```bash
git add serve/src/services/generateTrainingContent.ts
git commit -m "feat(serve): 培训学习内容 AI 结构化生成 service"
```

---

### Task 4: 题库生成 service

**Files:**
- Create: `serve/src/services/generateTrainingQuestions.ts`

**Interfaces:**
- Consumes: `generateJson`、`QUESTION_SYSTEM_PROMPT`/`buildQuestionPrompt` (Task 2)、`QuestionBankSchema`/`GeneratedQuestion`/`StructuredContent` (Task 1)
- Produces: `generateTrainingQuestions(content: StructuredContent, deps?): Promise<GeneratedQuestion[]>`

- [ ] **Step 1: 创建 service 文件**

```typescript
// serve/src/services/generateTrainingQuestions.ts
import { generateJson as defaultGenerateJson } from '../ai/textClient.js';
import { buildQuestionPrompt, QUESTION_SYSTEM_PROMPT } from '../ai/trainingPrompts.js';
import { QuestionBankSchema, type GeneratedQuestion, type StructuredContent } from '../schema/training.js';

export interface GenerateTrainingQuestionsDeps {
  generateJson?: typeof defaultGenerateJson;
}

export async function generateTrainingQuestions(
  content: StructuredContent,
  deps: GenerateTrainingQuestionsDeps = {},
): Promise<GeneratedQuestion[]> {
  const generateJson = deps.generateJson ?? defaultGenerateJson;
  const userPrompt = buildQuestionPrompt(content.summary, content.sections);

  const firstRaw = await generateJson(QUESTION_SYSTEM_PROMPT, userPrompt);
  const firstResult = QuestionBankSchema.safeParse(firstRaw);
  if (firstResult.success) return firstResult.data.questions;

  const retryPrompt = `${userPrompt}\n\n上一次生成的 JSON 未通过校验，错误如下，请修正后重新输出一个完整、合法的 JSON 对象：\n${JSON.stringify(firstResult.error.issues)}`;
  const secondRaw = await generateJson(QUESTION_SYSTEM_PROMPT, retryPrompt);
  const secondResult = QuestionBankSchema.safeParse(secondRaw);
  if (!secondResult.success) {
    throw new Error(`题库生成两次校验均失败: ${JSON.stringify(secondResult.error.issues)}`);
  }
  return secondResult.data.questions;
}
```

- [ ] **Step 2: 类型检查**

Run: `cd serve && npx tsc --noEmit`
Expected: 无报错

- [ ] **Step 3: Commit**

```bash
git add serve/src/services/generateTrainingQuestions.ts
git commit -m "feat(serve): 培训测评题库 AI 生成 service"
```

---

### Task 5: 答题反馈生成 service

**Files:**
- Create: `serve/src/services/generateTrainingFeedback.ts`

**Interfaces:**
- Consumes: `generateJson`、`FEEDBACK_SYSTEM_PROMPT`/`buildFeedbackPrompt` (Task 2)、`FeedbackSchema` (Task 1)
- Produces: `generateTrainingFeedback(score: number, total: number, wrongItems: {question: string; explanation: string}[], deps?): Promise<string>`

- [ ] **Step 1: 创建 service 文件**

```typescript
// serve/src/services/generateTrainingFeedback.ts
import { generateJson as defaultGenerateJson } from '../ai/textClient.js';
import { buildFeedbackPrompt, FEEDBACK_SYSTEM_PROMPT } from '../ai/trainingPrompts.js';
import { FeedbackSchema } from '../schema/training.js';

export interface GenerateTrainingFeedbackDeps {
  generateJson?: typeof defaultGenerateJson;
}

export async function generateTrainingFeedback(
  score: number,
  total: number,
  wrongItems: { question: string; explanation: string }[],
  deps: GenerateTrainingFeedbackDeps = {},
): Promise<string> {
  const generateJson = deps.generateJson ?? defaultGenerateJson;
  const userPrompt = buildFeedbackPrompt(score, total, wrongItems);

  const firstRaw = await generateJson(FEEDBACK_SYSTEM_PROMPT, userPrompt);
  const firstResult = FeedbackSchema.safeParse(firstRaw);
  if (firstResult.success) return firstResult.data.feedback;

  const retryPrompt = `${userPrompt}\n\n上一次生成的 JSON 未通过校验，错误如下，请修正后重新输出一个完整、合法的 JSON 对象：\n${JSON.stringify(firstResult.error.issues)}`;
  const secondRaw = await generateJson(FEEDBACK_SYSTEM_PROMPT, retryPrompt);
  const secondResult = FeedbackSchema.safeParse(secondRaw);
  if (!secondResult.success) {
    throw new Error(`反馈生成两次校验均失败: ${JSON.stringify(secondResult.error.issues)}`);
  }
  return secondResult.data.feedback;
}
```

- [ ] **Step 2: 类型检查**

Run: `cd serve && npx tsc --noEmit`
Expected: 无报错

- [ ] **Step 3: Commit**

```bash
git add serve/src/services/generateTrainingFeedback.ts
git commit -m "feat(serve): 培训测评反馈 AI 生成 service"
```

---

### Task 6: `training_topics` 表与 db 操作

**Files:**
- Create: `serve/src/db/trainingTopics.ts`
- Modify: `serve/src/db/index.ts`

**Interfaces:**
- Consumes: `DbClient` (`serve/src/db/client.ts`)、`StructuredContent`/`TrainingTopic` (Task 1)
- Produces: `createTrainingTopicsTable(db)`、`insertTrainingTopic(db, input)`、`listTrainingTopics(db)`、`getTrainingTopic(db, id)`

- [ ] **Step 1: 创建 db 文件**

```typescript
// serve/src/db/trainingTopics.ts
import { randomUUID } from 'node:crypto';
import type { DbClient } from './client.js';
import type { StructuredContent, TrainingTopic } from '../schema/training.js';

type TrainingTopicRow = {
  id: string;
  title: string;
  rawTranscript: string;
  structuredContent: string | null;
  createdAt: string;
};

function rowToTopic(row: TrainingTopicRow): TrainingTopic {
  return {
    id: row.id,
    title: row.title,
    rawTranscript: row.rawTranscript,
    structuredContent: row.structuredContent ? (JSON.parse(row.structuredContent) as StructuredContent) : null,
    createdAt: row.createdAt,
  };
}

export async function createTrainingTopicsTable(db: DbClient): Promise<void> {
  const idColType = db.dialect === 'mysql' ? 'VARCHAR(191)' : 'TEXT';
  const dataType = db.dialect === 'mysql' ? 'LONGTEXT' : 'TEXT';
  await db.exec(
    `CREATE TABLE IF NOT EXISTS training_topics(
      id ${idColType} PRIMARY KEY,
      title TEXT,
      rawTranscript ${dataType},
      structuredContent ${dataType},
      createdAt TEXT
    )`,
  );
}

export async function insertTrainingTopic(
  db: DbClient,
  input: { title: string; rawTranscript: string; structuredContent: StructuredContent },
): Promise<TrainingTopic> {
  const record: TrainingTopic = {
    id: randomUUID(),
    title: input.title,
    rawTranscript: input.rawTranscript,
    structuredContent: input.structuredContent,
    createdAt: new Date().toISOString(),
  };
  await db.run(
    `INSERT INTO training_topics (id, title, rawTranscript, structuredContent, createdAt) VALUES (?, ?, ?, ?, ?)`,
    [record.id, record.title, record.rawTranscript, JSON.stringify(record.structuredContent), record.createdAt],
  );
  return record;
}

export async function listTrainingTopics(db: DbClient): Promise<TrainingTopic[]> {
  const rows = await db.all<TrainingTopicRow>(`SELECT * FROM training_topics ORDER BY createdAt ASC`);
  return rows.map(rowToTopic);
}

export async function getTrainingTopic(db: DbClient, id: string): Promise<TrainingTopic | null> {
  const row = await db.get<TrainingTopicRow>(`SELECT * FROM training_topics WHERE id = ?`, [id]);
  return row ? rowToTopic(row) : null;
}
```

- [ ] **Step 2: 注册建表到 `initSchema`**

在 `serve/src/db/index.ts` 顶部 import 区新增：

```typescript
import { createTrainingTopicsTable } from './trainingTopics.js';
```

在 `initSchema` 函数内 `await createCaseSessionsTable(client);` 之后新增一行：

```typescript
  await createTrainingTopicsTable(client);
```

- [ ] **Step 3: 类型检查**

Run: `cd serve && npx tsc --noEmit`
Expected: 无报错

- [ ] **Step 4: Commit**

```bash
git add serve/src/db/trainingTopics.ts serve/src/db/index.ts
git commit -m "feat(serve): training_topics 表与 db 操作"
```

---

### Task 7: `training_questions` 表与 db 操作

**Files:**
- Create: `serve/src/db/trainingQuestions.ts`
- Modify: `serve/src/db/index.ts`

**Interfaces:**
- Consumes: `DbClient`、`GeneratedQuestion`/`TrainingQuestion` (Task 1)
- Produces: `createTrainingQuestionsTable(db)`、`insertTrainingQuestions(db, topicId, questions)`、`listTrainingQuestionsByTopic(db, topicId)`

- [ ] **Step 1: 创建 db 文件**

```typescript
// serve/src/db/trainingQuestions.ts
import { randomUUID } from 'node:crypto';
import type { DbClient } from './client.js';
import type { GeneratedQuestion, TrainingQuestion } from '../schema/training.js';

type TrainingQuestionRow = {
  id: string;
  topicId: string;
  type: string;
  question: string;
  options: string;
  correctAnswers: string;
  explanation: string;
  createdAt: string;
};

function rowToQuestion(row: TrainingQuestionRow): TrainingQuestion {
  return {
    id: row.id,
    topicId: row.topicId,
    type: row.type as TrainingQuestion['type'],
    question: row.question,
    options: JSON.parse(row.options),
    correctAnswers: JSON.parse(row.correctAnswers),
    explanation: row.explanation,
    createdAt: row.createdAt,
  };
}

export async function createTrainingQuestionsTable(db: DbClient): Promise<void> {
  const idColType = db.dialect === 'mysql' ? 'VARCHAR(191)' : 'TEXT';
  const dataType = db.dialect === 'mysql' ? 'LONGTEXT' : 'TEXT';
  await db.exec(
    `CREATE TABLE IF NOT EXISTS training_questions(
      id ${idColType} PRIMARY KEY,
      topicId ${idColType},
      type TEXT,
      question TEXT,
      options ${dataType},
      correctAnswers ${dataType},
      explanation ${dataType},
      createdAt TEXT
    )`,
  );
}

export async function insertTrainingQuestions(
  db: DbClient,
  topicId: string,
  questions: GeneratedQuestion[],
): Promise<TrainingQuestion[]> {
  const records: TrainingQuestion[] = questions.map((q) => ({
    id: randomUUID(),
    topicId,
    type: q.type,
    question: q.question,
    options: q.options,
    correctAnswers: q.correctAnswers,
    explanation: q.explanation,
    createdAt: new Date().toISOString(),
  }));
  for (const r of records) {
    await db.run(
      `INSERT INTO training_questions (id, topicId, type, question, options, correctAnswers, explanation, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [r.id, r.topicId, r.type, r.question, JSON.stringify(r.options), JSON.stringify(r.correctAnswers), r.explanation, r.createdAt],
    );
  }
  return records;
}

export async function listTrainingQuestionsByTopic(db: DbClient, topicId: string): Promise<TrainingQuestion[]> {
  const rows = await db.all<TrainingQuestionRow>(
    `SELECT * FROM training_questions WHERE topicId = ? ORDER BY createdAt ASC`,
    [topicId],
  );
  return rows.map(rowToQuestion);
}
```

- [ ] **Step 2: 注册建表**

在 `serve/src/db/index.ts` import 区新增：

```typescript
import { createTrainingQuestionsTable } from './trainingQuestions.js';
```

在 `initSchema` 内紧接 Task 6 新增的那行之后新增：

```typescript
  await createTrainingQuestionsTable(client);
```

- [ ] **Step 3: 类型检查**

Run: `cd serve && npx tsc --noEmit`
Expected: 无报错

- [ ] **Step 4: Commit**

```bash
git add serve/src/db/trainingQuestions.ts serve/src/db/index.ts
git commit -m "feat(serve): training_questions 表与 db 操作"
```

---

### Task 8: `training_attempts` 表与 db 操作

**Files:**
- Create: `serve/src/db/trainingAttempts.ts`
- Modify: `serve/src/db/index.ts`

**Interfaces:**
- Consumes: `DbClient`、`TrainingAttempt` (Task 1)
- Produces: `createTrainingAttemptsTable(db)`、`insertTrainingAttempt(db, input)`、`listTrainingAttempts(db, topicId, userId)`

- [ ] **Step 1: 创建 db 文件**

```typescript
// serve/src/db/trainingAttempts.ts
import { randomUUID } from 'node:crypto';
import type { DbClient } from './client.js';
import type { TrainingAttempt } from '../schema/training.js';

type TrainingAttemptRow = {
  id: string;
  topicId: string;
  userId: string;
  answers: string;
  score: number;
  feedback: string;
  createdAt: string;
};

function rowToAttempt(row: TrainingAttemptRow): TrainingAttempt {
  return {
    id: row.id,
    topicId: row.topicId,
    userId: row.userId,
    answers: JSON.parse(row.answers),
    score: row.score,
    feedback: row.feedback,
    createdAt: row.createdAt,
  };
}

export async function createTrainingAttemptsTable(db: DbClient): Promise<void> {
  const idColType = db.dialect === 'mysql' ? 'VARCHAR(191)' : 'TEXT';
  const dataType = db.dialect === 'mysql' ? 'LONGTEXT' : 'TEXT';
  await db.exec(
    `CREATE TABLE IF NOT EXISTS training_attempts(
      id ${idColType} PRIMARY KEY,
      topicId ${idColType},
      userId ${idColType},
      answers ${dataType},
      score INTEGER,
      feedback ${dataType},
      createdAt TEXT
    )`,
  );
}

export async function insertTrainingAttempt(
  db: DbClient,
  input: { topicId: string; userId: string; answers: number[][]; score: number; feedback: string },
): Promise<TrainingAttempt> {
  const record: TrainingAttempt = {
    id: randomUUID(),
    topicId: input.topicId,
    userId: input.userId,
    answers: input.answers,
    score: input.score,
    feedback: input.feedback,
    createdAt: new Date().toISOString(),
  };
  await db.run(
    `INSERT INTO training_attempts (id, topicId, userId, answers, score, feedback, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [record.id, record.topicId, record.userId, JSON.stringify(record.answers), record.score, record.feedback, record.createdAt],
  );
  return record;
}

export async function listTrainingAttempts(db: DbClient, topicId: string, userId: string): Promise<TrainingAttempt[]> {
  const rows = await db.all<TrainingAttemptRow>(
    `SELECT * FROM training_attempts WHERE topicId = ? AND userId = ? ORDER BY createdAt DESC`,
    [topicId, userId],
  );
  return rows.map(rowToAttempt);
}
```

- [ ] **Step 2: 注册建表**

在 `serve/src/db/index.ts` import 区新增：

```typescript
import { createTrainingAttemptsTable } from './trainingAttempts.js';
```

在 `initSchema` 内紧接 Task 7 新增的那行之后新增：

```typescript
  await createTrainingAttemptsTable(client);
```

- [ ] **Step 3: 类型检查**

Run: `cd serve && npx tsc --noEmit`
Expected: 无报错

- [ ] **Step 4: Commit**

```bash
git add serve/src/db/trainingAttempts.ts serve/src/db/index.ts
git commit -m "feat(serve): training_attempts 表与 db 操作"
```

---

### Task 9: 培训模块路由

**Files:**
- Create: `serve/src/routes/training.ts`
- Modify: `serve/src/index.ts`

**Interfaces:**
- Consumes: `listTrainingTopics`/`getTrainingTopic` (Task 6)、`insertTrainingQuestions`/`listTrainingQuestionsByTopic` (Task 7)、`insertTrainingAttempt`/`listTrainingAttempts` (Task 8)、`generateTrainingQuestions` (Task 4)、`generateTrainingFeedback` (Task 5)
- Produces: `registerTrainingRoutes(app, deps)`；API `GET /training/topics`、`GET /training/topics/:id`、`GET /training/topics/:id/questions`、`POST /training/topics/:id/attempts`、`GET /training/topics/:id/attempts?userId=`

- [ ] **Step 1: 创建路由文件**

```typescript
// serve/src/routes/training.ts
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { DbClient } from '../db/client.js';
import { getTrainingTopic, listTrainingTopics } from '../db/trainingTopics.js';
import { insertTrainingQuestions, listTrainingQuestionsByTopic } from '../db/trainingQuestions.js';
import { insertTrainingAttempt, listTrainingAttempts } from '../db/trainingAttempts.js';
import { generateTrainingQuestions as defaultGenerateTrainingQuestions } from '../services/generateTrainingQuestions.js';
import { generateTrainingFeedback as defaultGenerateTrainingFeedback } from '../services/generateTrainingFeedback.js';
import type { TrainingQuestion } from '../schema/training.js';

export interface TrainingRoutesDeps {
  db: DbClient;
  generateTrainingQuestions?: typeof defaultGenerateTrainingQuestions;
  generateTrainingFeedback?: typeof defaultGenerateTrainingFeedback;
}

const AttemptBodySchema = z.object({
  userId: z.string().min(1),
  answers: z.array(z.array(z.number().int().min(0))),
});

const AttemptQuerySchema = z.object({ userId: z.string().min(1) });

function isSameAnswer(given: number[], correct: number[]): boolean {
  const g = [...given].sort((a, b) => a - b);
  const c = [...correct].sort((a, b) => a - b);
  return g.length === c.length && g.every((v, idx) => v === c[idx]);
}

function scoreAnswers(questions: TrainingQuestion[], answers: number[][]): number {
  return questions.reduce((score, q, i) => (isSameAnswer(answers[i] ?? [], q.correctAnswers) ? score + 1 : score), 0);
}

export async function registerTrainingRoutes(app: FastifyInstance, deps: TrainingRoutesDeps): Promise<void> {
  const { db } = deps;
  const generateTrainingQuestions = deps.generateTrainingQuestions ?? defaultGenerateTrainingQuestions;
  const generateTrainingFeedback = deps.generateTrainingFeedback ?? defaultGenerateTrainingFeedback;

  app.get('/training/topics', async (_request, reply) => {
    return reply.status(200).send(await listTrainingTopics(db));
  });

  app.get<{ Params: { id: string } }>('/training/topics/:id', async (request, reply) => {
    const topic = await getTrainingTopic(db, request.params.id);
    if (!topic) return reply.status(404).send({ error: 'Topic not found' });
    return reply.status(200).send(topic);
  });

  app.get<{ Params: { id: string } }>('/training/topics/:id/questions', async (request, reply) => {
    const topic = await getTrainingTopic(db, request.params.id);
    if (!topic || !topic.structuredContent) return reply.status(404).send({ error: 'Topic not found' });

    const existing = await listTrainingQuestionsByTopic(db, topic.id);
    if (existing.length > 0) return reply.status(200).send(existing);

    const generated = await generateTrainingQuestions(topic.structuredContent);
    const inserted = await insertTrainingQuestions(db, topic.id, generated);
    return reply.status(200).send(inserted);
  });

  app.post<{ Params: { id: string } }>('/training/topics/:id/attempts', async (request, reply) => {
    const parsed = AttemptBodySchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: 'Invalid input', issues: parsed.error.issues });

    const questions = await listTrainingQuestionsByTopic(db, request.params.id);
    if (questions.length === 0) return reply.status(404).send({ error: 'Questions not found' });

    const score = scoreAnswers(questions, parsed.data.answers);
    const wrongItems = questions
      .filter((q, i) => !isSameAnswer(parsed.data.answers[i] ?? [], q.correctAnswers))
      .map((q) => ({ question: q.question, explanation: q.explanation }));
    const feedback = await generateTrainingFeedback(score, questions.length, wrongItems);

    const attempt = await insertTrainingAttempt(db, {
      topicId: request.params.id,
      userId: parsed.data.userId,
      answers: parsed.data.answers,
      score,
      feedback,
    });
    return reply.status(200).send(attempt);
  });

  app.get<{ Params: { id: string }; Querystring: { userId?: string } }>(
    '/training/topics/:id/attempts',
    async (request, reply) => {
      const parsed = AttemptQuerySchema.safeParse(request.query);
      if (!parsed.success) return reply.status(400).send({ error: 'Missing userId' });
      return reply.status(200).send(await listTrainingAttempts(db, request.params.id, parsed.data.userId));
    },
  );
}
```

- [ ] **Step 2: 注册路由**

在 `serve/src/index.ts` import 区新增：

```typescript
import { registerTrainingRoutes } from './routes/training.js';
```

在 `app.register(async (instance) => { ... }, { prefix: '/api' })` 回调内，`await registerPictureBookRecordsRoutes(instance, { db });` 之后新增：

```typescript
      await registerTrainingRoutes(instance, { db });
```

- [ ] **Step 3: 类型检查**

Run: `cd serve && npx tsc --noEmit`
Expected: 无报错

- [ ] **Step 4: 启动服务手动验证路由已挂载**

Run: `cd serve && npm run dev`（另开一个终端窗口，跑起来后用下面命令验证，验证完 Ctrl+C 停止）
Run: `curl -s http://localhost:8787/api/training/topics`
Expected: `[]`（表已建好，尚无数据，返回空数组而非 404/500）

- [ ] **Step 5: Commit**

```bash
git add serve/src/routes/training.ts serve/src/index.ts
git commit -m "feat(serve): 培训模块路由 /api/training/*"
```

---

### Task 10: 一次性导入脚本（先导 10 条）

**Files:**
- Modify: `serve/package.json`（新增 `xlsx` 依赖与 `import:training` 脚本）
- Create: `serve/src/scripts/importTrainingTopics.ts`

**Interfaces:**
- Consumes: `createDbClient` (`serve/src/db/client.ts`)、`createTrainingTopicsTable`/`insertTrainingTopic`/`listTrainingTopics` (Task 6)、`generateStructuredContent` (Task 3)
- Produces: 命令行脚本，运行后 `training_topics` 表中新增数据

- [ ] **Step 1: 安装 `xlsx` 依赖**

Run: `cd serve && npm install xlsx@^0.18.5`
Expected: `serve/package.json` 的 `dependencies` 中新增 `"xlsx": "^0.18.5"`，`package-lock.json` 更新

- [ ] **Step 2: 创建导入脚本**

```typescript
// serve/src/scripts/importTrainingTopics.ts
// 一次性批量导入：从 docs/riceai 培训视频文字内容.xlsx 读取 主题/视频内容 两列，
// 调 AI 结构化后落库。先跑 10 条验证链路，验证通过后把 TRAINING_IMPORT_LIMIT 提高到 159 跑完剩余数据。
// 运行：npm run import:training
import 'dotenv/config';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import * as XLSX from 'xlsx';
import { createDbClient } from '../db/client.js';
import { createTrainingTopicsTable, insertTrainingTopic, listTrainingTopics } from '../db/trainingTopics.js';
import { generateStructuredContent } from '../services/generateTrainingContent.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const XLSX_PATH = join(__dirname, '../../../docs/riceai 培训视频文字内容.xlsx');
const IMPORT_LIMIT = Number(process.env.TRAINING_IMPORT_LIMIT ?? 10);

interface SheetRow {
  主题?: string;
  视频内容?: string;
}

interface TopicRow {
  title: string;
  rawTranscript: string;
}

function readRows(): TopicRow[] {
  const workbook = XLSX.readFile(XLSX_PATH);
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const raw = XLSX.utils.sheet_to_json<SheetRow>(sheet);
  return raw
    .filter((r) => r.主题 && r.视频内容)
    .map((r) => ({ title: r.主题 as string, rawTranscript: r.视频内容 as string }));
}

async function main(): Promise<void> {
  const db = await createDbClient();
  await createTrainingTopicsTable(db);

  const existing = await listTrainingTopics(db);
  const existingTitles = new Set(existing.map((t) => t.title));

  const rows = readRows()
    .filter((r) => !existingTitles.has(r.title))
    .slice(0, IMPORT_LIMIT);
  console.log(`本次导入 ${rows.length} 条（已存在 ${existingTitles.size} 条，limit=${IMPORT_LIMIT}）`);

  for (const row of rows) {
    try {
      const structured = await generateStructuredContent(row.title, row.rawTranscript);
      await insertTrainingTopic(db, {
        title: row.title,
        rawTranscript: row.rawTranscript,
        structuredContent: structured,
      });
      console.log(`  ✓ ${row.title}`);
    } catch (err) {
      console.error(`  ✗ ${row.title} 失败：${err instanceof Error ? err.message : String(err)}`);
    }
  }
  await db.close();
  console.log('导入结束。');
}

main();
```

- [ ] **Step 3: 新增 npm script**

在 `serve/package.json` 的 `"scripts"` 中，`"migrate:mysql": "tsx src/scripts/migrateToMysql.ts"` 之后新增一行：

```json
    "import:training": "tsx src/scripts/importTrainingTopics.ts"
```

（记得给上一行末尾补逗号）

- [ ] **Step 4: 类型检查**

Run: `cd serve && npx tsc --noEmit`
Expected: 无报错

- [ ] **Step 5: 真实运行导入（先 10 条），核对落库结果**

Run: `cd serve && npm run import:training`
Expected: 终端输出"本次导入 10 条（已存在 0 条，limit=10）"，随后 10 行 `✓ <标题>`，最后"导入结束。"（若某条因 AI 校验失败输出 `✗`，属正常重试后仍失败个例，不影响其余条目落库）

Run: `cd serve && node -e "const Database=require('better-sqlite3'); const db=new Database('lessons.db'); console.log(db.prepare('SELECT COUNT(*) as c FROM training_topics').get()); console.log(db.prepare('SELECT title, structuredContent FROM training_topics LIMIT 1').get());"`
Expected: 第一行 `{ c: 10 }`（或因个别失败略少于 10），第二行能看到某条 `structuredContent` 是形如 `{"summary":...,"sections":[...]}` 的 JSON 字符串

- [ ] **Step 6: Commit**

```bash
git add serve/package.json serve/package-lock.json serve/src/scripts/importTrainingTopics.ts
git commit -m "feat(serve): 培训主题一次性导入脚本（先导10条验证）"
```

---

### Task 11: 前端类型与 API client

**Files:**
- Create: `web/src/types/training.ts`
- Modify: `web/src/api/client.ts`

**Interfaces:**
- Consumes: `request<T>` 内部 helper（已存在于 `web/src/api/client.ts`）
- Produces: `TrainingTopic`/`TrainingQuestion`/`TrainingAttempt` 类型；`api.listTrainingTopics()`、`api.getTrainingTopic(id)`、`api.getTrainingQuestions(topicId)`、`api.submitTrainingAttempt(topicId, userId, answers)`

- [ ] **Step 1: 创建类型文件**

```typescript
// web/src/types/training.ts
// 与后端 serve/src/schema/training.ts 同构的纯 TS 类型。

export type TrainingSection = { heading: string; body: string };
export type TrainingStructuredContent = { summary: string; sections: TrainingSection[] };

export type TrainingTopic = {
  id: string;
  title: string;
  rawTranscript: string;
  structuredContent: TrainingStructuredContent | null;
  createdAt: string;
};

export type TrainingQuestionType = 'single' | 'multi';

export type TrainingQuestion = {
  id: string;
  topicId: string;
  type: TrainingQuestionType;
  question: string;
  options: string[];
  correctAnswers: number[];
  explanation: string;
  createdAt: string;
};

export type TrainingAttempt = {
  id: string;
  topicId: string;
  userId: string;
  answers: number[][];
  score: number;
  feedback: string;
  createdAt: string;
};
```

- [ ] **Step 2: 在 client.ts 顶部新增 import**

在 `web/src/api/client.ts` 顶部现有 import 之后新增：

```typescript
import type { TrainingAttempt, TrainingQuestion, TrainingTopic } from '../types/training';
```

- [ ] **Step 3: 在 client.ts 新增函数**

在 `web/src/api/client.ts` 文件内、`export const api = {` 定义之前，新增：

```typescript
// ===== 培训测评：学习 + 测评 =====

function listTrainingTopics(): Promise<TrainingTopic[]> {
  return request<TrainingTopic[]>('/training/topics');
}

function getTrainingTopic(id: string): Promise<TrainingTopic> {
  return request<TrainingTopic>(`/training/topics/${id}`);
}

function getTrainingQuestions(topicId: string): Promise<TrainingQuestion[]> {
  return request<TrainingQuestion[]>(`/training/topics/${topicId}/questions`);
}

function submitTrainingAttempt(topicId: string, userId: string, answers: number[][]): Promise<TrainingAttempt> {
  return request<TrainingAttempt>(`/training/topics/${topicId}/attempts`, {
    method: 'POST',
    body: { userId, answers },
  });
}
```

- [ ] **Step 4: 在 `api` 导出对象中注册新函数**

在 `web/src/api/client.ts` 的 `export const api = { ... }` 对象末尾（`deleteVideoAnalysis,` 之后）新增：

```typescript
  listTrainingTopics,
  getTrainingTopic,
  getTrainingQuestions,
  submitTrainingAttempt,
```

- [ ] **Step 5: 类型检查**

Run: `cd web && npx tsc -b`
Expected: 无报错（新函数暂未被页面引用，但类型齐备不会报错；若报"未使用"之类的 lint 问题不算类型错误，可忽略，等 Task 12 接入即解决）

- [ ] **Step 6: Commit**

```bash
git add web/src/types/training.ts web/src/api/client.ts
git commit -m "feat(web): 培训模块前端类型与 API client"
```

---

### Task 12: 培训学习列表页 + 详情页

**Files:**
- Create: `web/src/pages/TrainingTopics.tsx`
- Create: `web/src/pages/TrainingTopicDetail.tsx`

**Interfaces:**
- Consumes: `api.listTrainingTopics`/`api.getTrainingTopic` (Task 11)、`apiErrorMessage` (已存在于 `web/src/api/client.ts`)、`TrainingTopic` (Task 11)
- Produces: `TrainingTopics` 组件（默认导出）、`TrainingTopicDetail` 组件（默认导出），后者内含指向 `/training/:id/quiz` 的入口链接（Task 13 会创建该页面）

- [ ] **Step 1: 创建列表页**

```tsx
// web/src/pages/TrainingTopics.tsx
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api, apiErrorMessage } from '../api/client'
import type { TrainingTopic } from '../types/training'

export default function TrainingTopics() {
  const [topics, setTopics] = useState<TrainingTopic[]>([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api
      .listTrainingTopics()
      .then(setTopics)
      .catch((err) => setError(apiErrorMessage(err, '加载失败')))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="max-w-4xl mx-auto px-4 py-8 text-stone-500">加载中…</div>
  if (error) return <div className="max-w-4xl mx-auto px-4 py-8 text-red-500">{error}</div>

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <h1 className="text-xl font-black text-stone-900 mb-4">培训学习</h1>
      <div className="grid gap-3">
        {topics.map((t) => (
          <Link
            key={t.id}
            to={`/training/${t.id}`}
            className="bg-white rounded-2xl shadow-card ring-1 ring-brand-100 p-4 hover:bg-brand-50 transition-colors"
          >
            <h2 className="font-bold text-stone-800">{t.title}</h2>
            {t.structuredContent && (
              <p className="text-sm text-stone-500 mt-1 line-clamp-2">{t.structuredContent.summary}</p>
            )}
          </Link>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: 创建详情页**

```tsx
// web/src/pages/TrainingTopicDetail.tsx
import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api, apiErrorMessage } from '../api/client'
import type { TrainingTopic } from '../types/training'

export default function TrainingTopicDetail() {
  const { id } = useParams<{ id: string }>()
  const [topic, setTopic] = useState<TrainingTopic | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!id) return
    api
      .getTrainingTopic(id)
      .then(setTopic)
      .catch((err) => setError(apiErrorMessage(err, '加载失败')))
  }, [id])

  if (error) return <div className="max-w-2xl mx-auto px-4 py-8 text-red-500">{error}</div>
  if (!topic) return <div className="max-w-2xl mx-auto px-4 py-8 text-stone-500">加载中…</div>

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <Link to="/training" className="text-sm text-stone-500 hover:underline">
        ← 返回列表
      </Link>
      <h1 className="text-xl font-black text-stone-900 mt-2 mb-3">{topic.title}</h1>
      {topic.structuredContent && (
        <>
          <p className="bg-brand-50 rounded-xl p-3 text-sm text-stone-700 mb-4">{topic.structuredContent.summary}</p>
          <div className="space-y-4">
            {topic.structuredContent.sections.map((s, i) => (
              <div key={i}>
                <h3 className="font-bold text-stone-800 mb-1">{s.heading}</h3>
                <p className="text-sm text-stone-600 whitespace-pre-wrap">{s.body}</p>
              </div>
            ))}
          </div>
        </>
      )}
      <Link
        to={`/training/${topic.id}/quiz`}
        className="inline-block mt-6 px-5 py-2 rounded-full bg-brand-500 text-white font-bold shadow-soft"
      >
        开始测评
      </Link>
    </div>
  )
}
```

- [ ] **Step 3: 类型检查**

Run: `cd web && npx tsc -b`
Expected: 无报错

- [ ] **Step 4: Commit**

```bash
git add web/src/pages/TrainingTopics.tsx web/src/pages/TrainingTopicDetail.tsx
git commit -m "feat(web): 培训学习列表页与详情页"
```

---

### Task 13: 测评答题页

**Files:**
- Create: `web/src/pages/TrainingQuiz.tsx`

**Interfaces:**
- Consumes: `api.getTrainingQuestions`/`api.submitTrainingAttempt` (Task 11)、`useAuth` (`web/src/auth/AuthContext.tsx`)、`TrainingQuestion`/`TrainingAttempt` (Task 11)
- Produces: `TrainingQuiz` 组件（默认导出）

- [ ] **Step 1: 创建答题页**

```tsx
// web/src/pages/TrainingQuiz.tsx
import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api, apiErrorMessage } from '../api/client'
import { useAuth } from '../auth/AuthContext'
import type { TrainingAttempt, TrainingQuestion } from '../types/training'

export default function TrainingQuiz() {
  const { id } = useParams<{ id: string }>()
  const { user } = useAuth()
  const [questions, setQuestions] = useState<TrainingQuestion[]>([])
  const [answers, setAnswers] = useState<number[][]>([])
  const [index, setIndex] = useState(0)
  const [result, setResult] = useState<TrainingAttempt | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!id) return
    api
      .getTrainingQuestions(id)
      .then((qs) => {
        setQuestions(qs)
        setAnswers(qs.map(() => []))
      })
      .catch((err) => setError(apiErrorMessage(err, '加载题目失败')))
      .finally(() => setLoading(false))
  }, [id])

  function toggleOption(qIndex: number, optionIndex: number, multi: boolean) {
    setAnswers((prev) => {
      const next = [...prev]
      const current = next[qIndex] ?? []
      next[qIndex] = multi
        ? current.includes(optionIndex)
          ? current.filter((v) => v !== optionIndex)
          : [...current, optionIndex]
        : [optionIndex]
      return next
    })
  }

  async function submit() {
    if (!id || !user) return
    setSubmitting(true)
    try {
      setResult(await api.submitTrainingAttempt(id, user.id, answers))
    } catch (err) {
      setError(apiErrorMessage(err, '提交失败'))
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return <div className="max-w-2xl mx-auto px-4 py-8 text-stone-500">加载中…</div>
  if (error) return <div className="max-w-2xl mx-auto px-4 py-8 text-red-500">{error}</div>

  if (result) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-6">
        <h1 className="text-xl font-black text-stone-900 mb-3">测评结果</h1>
        <p className="text-lg font-bold text-brand-600 mb-4">
          得分：{result.score} / {questions.length}
        </p>
        <p className="bg-brand-50 rounded-xl p-4 text-sm text-stone-700 whitespace-pre-wrap mb-4">{result.feedback}</p>
        <Link to={`/training/${id}`} className="text-sm text-stone-500 hover:underline">
          ← 返回主题
        </Link>
      </div>
    )
  }

  const q = questions[index]
  if (!q) return null
  const selected = answers[index] ?? []

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <p className="text-sm text-stone-500 mb-2">
        第 {index + 1} / {questions.length} 题 {q.type === 'multi' ? '（多选）' : '（单选）'}
      </p>
      <h2 className="font-bold text-stone-800 mb-3">{q.question}</h2>
      <div className="space-y-2 mb-6">
        {q.options.map((opt, i) => (
          <button
            key={i}
            onClick={() => toggleOption(index, i, q.type === 'multi')}
            className={
              selected.includes(i)
                ? 'w-full text-left px-4 py-2 rounded-xl bg-brand-500 text-white font-bold'
                : 'w-full text-left px-4 py-2 rounded-xl bg-white ring-1 ring-brand-100 text-stone-700'
            }
          >
            {opt}
          </button>
        ))}
      </div>
      <div className="flex items-center justify-between">
        <button
          disabled={index === 0}
          onClick={() => setIndex((i) => i - 1)}
          className="px-4 py-2 rounded-full font-bold text-stone-500 disabled:opacity-40"
        >
          上一题
        </button>
        {index < questions.length - 1 ? (
          <button
            onClick={() => setIndex((i) => i + 1)}
            className="px-5 py-2 rounded-full bg-brand-500 text-white font-bold shadow-soft"
          >
            下一题
          </button>
        ) : (
          <button
            disabled={submitting}
            onClick={submit}
            className="px-5 py-2 rounded-full bg-brand-500 text-white font-bold shadow-soft disabled:opacity-60"
          >
            {submitting ? '提交中…' : '交卷'}
          </button>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: 类型检查**

Run: `cd web && npx tsc -b`
Expected: 无报错

- [ ] **Step 3: Commit**

```bash
git add web/src/pages/TrainingQuiz.tsx
git commit -m "feat(web): 培训测评答题页"
```

---

### Task 14: 路由接入与导航 Tab

**Files:**
- Modify: `web/src/App.tsx`
- Modify: `web/src/components/AppShell.tsx`
- Modify: `web/src/components/NavIcons.tsx`

**Interfaces:**
- Consumes: `TrainingTopics`/`TrainingTopicDetail` (Task 12)、`TrainingQuiz` (Task 13)

- [ ] **Step 1: `App.tsx` 新增 import**

在 `web/src/App.tsx` 顶部现有 import 之后新增：

```typescript
import TrainingTopics from './pages/TrainingTopics'
import TrainingTopicDetail from './pages/TrainingTopicDetail'
import TrainingQuiz from './pages/TrainingQuiz'
```

- [ ] **Step 2: `App.tsx` 新增路由**

在 `<Route element={<AppShell />}>` 内、`{/* 视频分析模块 */}` 那组路由之后新增：

```tsx
        {/* 培训测评模块 */}
        <Route path="/training" element={<TrainingTopics />} />
        <Route path="/training/:id" element={<TrainingTopicDetail />} />
        <Route path="/training/:id/quiz" element={<TrainingQuiz />} />
```

- [ ] **Step 3: `NavIcons.tsx` 新增 `TrainingIcon`**

在 `web/src/components/NavIcons.tsx` 末尾（`VideoIcon` 之后）新增一个风格一致的图标组件：

```typescript
export function TrainingIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <path
        d="M12 4 3 8.5 12 13l9-4.5L12 4Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path d="M6.5 10.5v4c0 1.4 2.5 3 5.5 3s5.5-1.6 5.5-3v-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}
```

- [ ] **Step 4: `AppShell.tsx` 新增 Tab**

在 `web/src/components/AppShell.tsx` 第 5 行的 import 中新增 `TrainingIcon`：

```typescript
import { GameIcon, LessonIcon, PictureBookIcon, TrainingIcon, VideoIcon } from './NavIcons'
```

将 `tabs` 数组替换为（"DTT 教案" 的 `match` 补上 `!p.startsWith('/training')` 排除条件，并在末尾新增"培训测评"项）：

```typescript
const tabs = [
  {
    label: 'DTT 教案',
    icon: LessonIcon,
    to: '/',
    match: (p: string) =>
      !p.startsWith('/picture-book') &&
      !p.startsWith('/games') &&
      !p.startsWith('/video') &&
      !p.startsWith('/training') &&
      !p.startsWith('/share'),
  },
  {
    label: '绘本打卡',
    icon: PictureBookIcon,
    to: '/picture-book',
    match: (p: string) => p.startsWith('/picture-book'),
  },
  { label: '游戏乐园', icon: GameIcon, to: '/games', match: (p: string) => p.startsWith('/games') },
  { label: '视频分析', icon: VideoIcon, to: '/video', match: (p: string) => p.startsWith('/video') },
  { label: '培训测评', icon: TrainingIcon, to: '/training', match: (p: string) => p.startsWith('/training') },
]
```

- [ ] **Step 5: 类型检查**

Run: `cd web && npx tsc -b`
Expected: 无报错

- [ ] **Step 6: Commit**

```bash
git add web/src/App.tsx web/src/components/AppShell.tsx web/src/components/NavIcons.tsx
git commit -m "feat(web): 培训测评模块接入路由与导航"
```

---

### Task 15: 端到端浏览器验证

**Files:** 无代码改动（纯验证）

- [ ] **Step 1: 启动后端与前端**

Run: `cd serve && npm run dev`（终端 A，保持运行）
Run: `cd web && npm run dev`（终端 B，保持运行，记下打印的本地地址，通常是 `http://localhost:5173`）

- [ ] **Step 2: 浏览器走一遍完整流程**

用 chrome-devtools 打开前端地址并登录（沿用已有账号密码，若没有则任意用户名+密码首次登录即自动注册），依次验证：

1. 顶部/底部导航能看到"培训测评" Tab，点击进入 `/training`，能看到 Task 10 导入的 10 个主题标题+摘要
2. 点击任意一个主题，进入详情页，能看到结构化的小标题+正文内容
3. 点击"开始测评"，进入 `/training/:id/quiz`，首次进入触发 AI 生成题库（可能有几秒延迟），显示第 1/10 题
4. 选择答案后点"下一题"，验证选中态高亮、可以"上一题"回退且保留已选答案
5. 走到第 10 题，按钮变为"交卷"，点击后展示得分（如 `7 / 10`）与一段 AI 生成的建议+鼓励文字
6. 刷新页面重新进入同一主题测评，验证题库不会重新生成（`GET /training/topics/:id/questions` 返回的题目与上次一致，通过 chrome-devtools 网络面板核对返回的 `id` 相同）

Expected: 以上 6 步全部符合预期，控制台无报错（用 `list_console_messages` 检查）

- [ ] **Step 3: 记录验证结果**

若发现问题，回退到对应 Task 修复后重新走 Step 1-2；全部通过后视为本次实现完成，无需额外 commit。
