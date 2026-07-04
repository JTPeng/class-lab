import type { FastifyInstance } from 'fastify';
import type { DbClient } from '../db/client.js';
import { z } from 'zod';
import {
  deletePictureBook,
  insertPictureBook,
  linkPictureBookScore,
  listPictureBooks,
  listPictureBooksByCase,
} from '../db/pictureBooks.js';

export interface PictureBookRecordsRoutesDeps {
  db: DbClient;
}

const SceneSchema = z.object({ text: z.string(), image: z.string() });
const RecordBodySchema = z.object({
  id: z.string().min(1),
  title: z.string(),
  thoughts: z.string(),
  stars: z.number(),
  style: z.string(),
  size: z.string(),
  scenes: z.array(SceneSchema),
  date: z.string(),
  createdAt: z.string(),
  count: z.number(),
});
const ScoreBodySchema = z.object({
  caseId: z.string().min(1),
  teacherCooperation: z.number().min(1).max(5),
  teacherProgress: z.number().min(1).max(5),
});

export async function registerPictureBookRecordsRoutes(app: FastifyInstance, deps: PictureBookRecordsRoutesDeps) {
  const { db } = deps;

  app.get<{ Params: { userId: string } }>('/users/:userId/picturebooks', async (request, reply) => {
    return reply.status(200).send(await listPictureBooks(db, request.params.userId));
  });

  // scenes 里内嵌 base64 图片，请求体常超过 Fastify 默认 1MB 的 bodyLimit，单独放宽此路由。
  app.post<{ Params: { userId: string } }>(
    '/users/:userId/picturebooks',
    { bodyLimit: 20 * 1024 * 1024 },
    async (request, reply) => {
      const parsed = RecordBodySchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: 'Invalid input', issues: parsed.error.issues });
      }
      await insertPictureBook(db, {
        ...parsed.data,
        userId: request.params.userId,
        caseId: null,
        teacherCooperation: null,
        teacherProgress: null,
      });
      return reply.status(201).send({ ok: true });
    },
  );

  app.delete<{ Params: { userId: string; id: string } }>('/users/:userId/picturebooks/:id', async (request, reply) => {
    const deleted = await deletePictureBook(db, request.params.userId, request.params.id);
    if (!deleted) {
      return reply.status(404).send({ error: 'Record not found' });
    }
    return reply.status(204).send();
  });

  app.put<{ Params: { userId: string; id: string } }>(
    '/users/:userId/picturebooks/:id/score',
    async (request, reply) => {
      const parsed = ScoreBodySchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: 'Invalid input', issues: parsed.error.issues });
      }
      const updated = await linkPictureBookScore(db, request.params.id, request.params.userId, parsed.data);
      if (!updated) {
        return reply.status(404).send({ error: 'Record not found' });
      }
      return reply.status(204).send();
    },
  );

  app.get<{ Params: { caseId: string } }>('/cases/:caseId/picturebooks', async (request, reply) => {
    return reply.status(200).send(await listPictureBooksByCase(db, request.params.caseId));
  });
}
