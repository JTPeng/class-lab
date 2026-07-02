import type { FastifyInstance } from 'fastify';
import type Database from 'better-sqlite3';
import { deleteLesson, getLesson, insertLesson, listLessons } from '../db/index.js';
import { LessonInputSchema } from '../schema/lesson.js';
import type { generateLesson as defaultGenerateLesson } from '../services/generateLesson.js';

export interface LessonRoutesDeps {
  db: Database.Database;
  generateLesson: typeof defaultGenerateLesson;
}

export async function registerLessonRoutes(app: FastifyInstance, deps: LessonRoutesDeps) {
  const { db, generateLesson } = deps;

  app.post('/lessons/generate', async (request, reply) => {
    const parsed = LessonInputSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Invalid input', issues: parsed.error.issues });
    }

    try {
      const lesson = await generateLesson(parsed.data);
      insertLesson(db, lesson);
      return reply.status(200).send(lesson);
    } catch (err) {
      app.log.error(err);
      return reply.status(502).send({ error: '教案生成失败，请稍后重试' });
    }
  });

  app.get('/lessons', async (_request, reply) => {
    return reply.status(200).send(listLessons(db));
  });

  app.get<{ Params: { id: string } }>('/lessons/:id', async (request, reply) => {
    const lesson = getLesson(db, request.params.id);
    if (!lesson) {
      return reply.status(404).send({ error: 'Lesson not found' });
    }
    return reply.status(200).send(lesson);
  });

  app.delete<{ Params: { id: string } }>('/lessons/:id', async (request, reply) => {
    const deleted = deleteLesson(db, request.params.id);
    if (!deleted) {
      return reply.status(404).send({ error: 'Lesson not found' });
    }
    return reply.status(204).send();
  });
}
