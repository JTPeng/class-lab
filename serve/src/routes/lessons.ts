import type { FastifyInstance } from 'fastify';
import type { DbClient } from '../db/client.js';
import { deleteLesson, getLesson, insertLesson, listLessons } from '../db/index.js';
import { LessonInputSchema } from '../schema/lesson.js';
import type { generateLesson as defaultGenerateLesson } from '../services/generateLesson.js';

export interface LessonRoutesDeps {
  db: DbClient;
  generateLesson: typeof defaultGenerateLesson;
}

export async function registerLessonRoutes(app: FastifyInstance, deps: LessonRoutesDeps) {
  const { db, generateLesson } = deps;

  app.post<{ Params: { userId: string } }>('/users/:userId/lessons/generate', async (request, reply) => {
    const parsed = LessonInputSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Invalid input', issues: parsed.error.issues });
    }

    try {
      const lesson = await generateLesson(parsed.data);
      await insertLesson(db, lesson, request.params.userId);
      return reply.status(200).send(lesson);
    } catch (err) {
      app.log.error(err);
      return reply.status(502).send({ error: '教案生成失败，请稍后重试' });
    }
  });

  app.get<{ Params: { userId: string } }>('/users/:userId/lessons', async (request, reply) => {
    return reply.status(200).send(await listLessons(db, request.params.userId));
  });

  app.get<{ Params: { userId: string; id: string } }>('/users/:userId/lessons/:id', async (request, reply) => {
    const lesson = await getLesson(db, request.params.id, request.params.userId);
    if (!lesson) {
      return reply.status(404).send({ error: 'Lesson not found' });
    }
    return reply.status(200).send(lesson);
  });

  app.delete<{ Params: { userId: string; id: string } }>('/users/:userId/lessons/:id', async (request, reply) => {
    const deleted = await deleteLesson(db, request.params.id, request.params.userId);
    if (!deleted) {
      return reply.status(404).send({ error: 'Lesson not found' });
    }
    return reply.status(204).send();
  });
}
