import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { DbClient } from '../db/client.js';
import {
  createCase,
  deleteCase,
  getCase,
  getCaseByShareToken,
  listCases,
  updateCase,
} from '../db/cases.js';
import {
  createCaseSession,
  listCaseSessions,
  submitGuardianFeedback,
  type CaseSessionRecord,
} from '../db/caseSessions.js';
import { deleteLesson, getLesson, insertLesson, listLessons } from '../db/index.js';
import { listPictureBooksByCase } from '../db/pictureBooks.js';
import { listGameSessionsByCase } from '../db/gameSessions.js';
import { listVideoAnalysesByCase } from '../db/videoAnalyses.js';
import { LessonInputSchema } from '../schema/lesson.js';
import type { generateLesson as defaultGenerateLesson } from '../services/generateLesson.js';
import type { generateCaseSummary as defaultGenerateCaseSummary } from '../services/generateCaseSummary.js';

export interface CaseRoutesDeps {
  db: DbClient;
  generateLesson: typeof defaultGenerateLesson;
  generateCaseSummary: typeof defaultGenerateCaseSummary;
}

const CaseBodySchema = z.object({
  name: z.string().min(1),
  baseline: z.string().default(''),
  targets: z.array(z.string()).default([]),
});

const CaseSessionBodySchema = z.object({
  lessonId: z.string().nullable().default(null),
  trialsTotal: z.number().int().min(0),
  trialsCorrect: z.number().int().min(0),
  teacherCooperation: z.number().int().min(1).max(5),
  teacherProgress: z.number().int().min(1).max(5),
});

const GuardianFeedbackBodySchema = z.object({
  difficulty: z.enum(['too_easy', 'just_right', 'too_hard']),
  interest: z.number().int().min(1).max(5),
  comment: z.string().nullable().default(null),
});

// 简单规则：不用 AI，按最近若干次执行记录的正确率与家长难度反馈给出调整建议文案。
function buildInsight(sessions: CaseSessionRecord[]): string | null {
  const recent = sessions.slice(0, 3);
  if (recent.length < 3) return null;

  const accuracies = recent.map((s) => (s.trialsTotal > 0 ? s.trialsCorrect / s.trialsTotal : 0));
  const highAccuracy = accuracies.every((a) => a >= 0.9);
  const lowAccuracy = accuracies.every((a) => a <= 0.5);
  const difficulties = recent.map((s) => s.guardianDifficulty).filter(Boolean);
  const mostlyTooEasy = difficulties.length > 0 && difficulties.every((d) => d === 'too_easy');
  const mostlyTooHard = difficulties.length > 0 && difficulties.every((d) => d === 'too_hard');

  if (highAccuracy && mostlyTooEasy) {
    return '最近 3 次正确率均在 90% 以上，家长反馈偏易，建议提高目标难度或进入下一阶段。';
  }
  if (lowAccuracy || mostlyTooHard) {
    return '最近 3 次正确率偏低或家长反馈偏难，建议降低目标难度或拆分为更小的子目标。';
  }
  return null;
}

export async function registerCaseRoutes(app: FastifyInstance, deps: CaseRoutesDeps) {
  const { db, generateLesson, generateCaseSummary } = deps;

  // ===== 个案建档 CRUD =====

  app.post<{ Params: { userId: string } }>('/users/:userId/cases', async (request, reply) => {
    const parsed = CaseBodySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Invalid input', issues: parsed.error.issues });
    }
    const record = await createCase(db, { teacherId: request.params.userId, ...parsed.data });
    return reply.status(201).send(record);
  });

  app.get<{ Params: { userId: string } }>('/users/:userId/cases', async (request, reply) => {
    return reply.status(200).send(await listCases(db, request.params.userId));
  });

  app.get<{ Params: { userId: string; caseId: string } }>(
    '/users/:userId/cases/:caseId',
    async (request, reply) => {
      const record = await getCase(db, request.params.caseId, request.params.userId);
      if (!record) return reply.status(404).send({ error: 'Case not found' });
      return reply.status(200).send(record);
    },
  );

  app.put<{ Params: { userId: string; caseId: string } }>(
    '/users/:userId/cases/:caseId',
    async (request, reply) => {
      const parsed = CaseBodySchema.partial().safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: 'Invalid input', issues: parsed.error.issues });
      }
      const updated = await updateCase(db, request.params.caseId, request.params.userId, parsed.data);
      if (!updated) return reply.status(404).send({ error: 'Case not found' });
      return reply.status(200).send(await getCase(db, request.params.caseId, request.params.userId));
    },
  );

  app.delete<{ Params: { userId: string; caseId: string } }>(
    '/users/:userId/cases/:caseId',
    async (request, reply) => {
      const deleted = await deleteCase(db, request.params.caseId, request.params.userId);
      if (!deleted) return reply.status(404).send({ error: 'Case not found' });
      return reply.status(204).send();
    },
  );

  // ===== 教案：按 caseId 归属（从 /users/:userId/lessons* 迁移而来） =====

  app.post<{ Params: { userId: string; caseId: string } }>(
    '/users/:userId/cases/:caseId/lessons/generate',
    async (request, reply) => {
      const parsed = LessonInputSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: 'Invalid input', issues: parsed.error.issues });
      }
      try {
        const lesson = await generateLesson(parsed.data);
        await insertLesson(db, lesson, request.params.userId, request.params.caseId);
        return reply.status(200).send(lesson);
      } catch (err) {
        app.log.error(err);
        return reply.status(502).send({ error: '教案生成失败，请稍后重试' });
      }
    },
  );

  app.get<{ Params: { caseId: string } }>('/cases/:caseId/lessons', async (request, reply) => {
    return reply.status(200).send(await listLessons(db, request.params.caseId));
  });

  app.get<{ Params: { caseId: string; id: string } }>('/cases/:caseId/lessons/:id', async (request, reply) => {
    const lesson = await getLesson(db, request.params.id, request.params.caseId);
    if (!lesson) return reply.status(404).send({ error: 'Lesson not found' });
    return reply.status(200).send(lesson);
  });

  app.delete<{ Params: { caseId: string; id: string } }>('/cases/:caseId/lessons/:id', async (request, reply) => {
    const deleted = await deleteLesson(db, request.params.id, request.params.caseId);
    if (!deleted) return reply.status(404).send({ error: 'Lesson not found' });
    return reply.status(204).send();
  });

  // ===== 执行记录 + 教师打分 =====

  app.post<{ Params: { caseId: string } }>('/cases/:caseId/sessions', async (request, reply) => {
    const parsed = CaseSessionBodySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Invalid input', issues: parsed.error.issues });
    }
    const record = await createCaseSession(db, { caseId: request.params.caseId, ...parsed.data });
    return reply.status(201).send(record);
  });

  app.get<{ Params: { caseId: string } }>('/cases/:caseId/sessions', async (request, reply) => {
    const sessions = await listCaseSessions(db, request.params.caseId);
    return reply.status(200).send({ sessions, insight: buildInsight(sessions) });
  });

  // ===== 视频分析：按 caseId 归属 =====

  app.get<{ Params: { caseId: string } }>('/cases/:caseId/video-analyses', async (request, reply) => {
    return reply.status(200).send(await listVideoAnalysesByCase(db, request.params.caseId));
  });

  // ===== AI 总结：汇总执行记录/绘本打卡/游戏记录/视频分析四类活动 =====

  app.post<{ Params: { caseId: string } }>('/cases/:caseId/summary/generate', async (request, reply) => {
    const record = await getCase(db, request.params.caseId);
    if (!record) return reply.status(404).send({ error: 'Case not found' });

    const [sessions, pictureBooks, gameSessions, videoAnalyses] = await Promise.all([
      listCaseSessions(db, request.params.caseId),
      listPictureBooksByCase(db, request.params.caseId),
      listGameSessionsByCase(db, request.params.caseId),
      listVideoAnalysesByCase(db, request.params.caseId),
    ]);

    try {
      const summary = await generateCaseSummary({ record, sessions, pictureBooks, gameSessions, videoAnalyses });
      return reply.status(200).send({ summary });
    } catch (err) {
      app.log.error(err);
      return reply.status(502).send({ error: '总结生成失败，请稍后重试' });
    }
  });

  // ===== 家长/督导免登录分享视图 =====

  app.get<{ Params: { shareToken: string } }>('/share/:shareToken', async (request, reply) => {
    const record = await getCaseByShareToken(db, request.params.shareToken);
    if (!record) return reply.status(404).send({ error: 'Not found' });
    const sessions = await listCaseSessions(db, record.id);
    return reply.status(200).send({
      case: { name: record.name, baseline: record.baseline, targets: record.targets },
      sessions,
    });
  });

  app.post<{ Params: { shareToken: string; sessionId: string } }>(
    '/share/:shareToken/sessions/:sessionId/guardian-feedback',
    async (request, reply) => {
      const record = await getCaseByShareToken(db, request.params.shareToken);
      if (!record) return reply.status(404).send({ error: 'Not found' });

      const parsed = GuardianFeedbackBodySchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: 'Invalid input', issues: parsed.error.issues });
      }
      const updated = await submitGuardianFeedback(db, request.params.sessionId, parsed.data);
      if (!updated) return reply.status(404).send({ error: 'Session not found' });
      return reply.status(204).send();
    },
  );
}
