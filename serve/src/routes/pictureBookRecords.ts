import type { FastifyInstance } from 'fastify';
import type { DbClient } from '../db/client.js';
import { z } from 'zod';
import { deletePictureBook, insertPictureBook, listPictureBooks } from '../db/pictureBooks.js';

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

export async function registerPictureBookRecordsRoutes(app: FastifyInstance, deps: PictureBookRecordsRoutesDeps) {
  const { db } = deps;

  app.get<{ Params: { userId: string } }>('/users/:userId/picturebooks', async (request, reply) => {
    return reply.status(200).send(await listPictureBooks(db, request.params.userId));
  });

  app.post<{ Params: { userId: string } }>('/users/:userId/picturebooks', async (request, reply) => {
    const parsed = RecordBodySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Invalid input', issues: parsed.error.issues });
    }
    await insertPictureBook(db, { ...parsed.data, userId: request.params.userId });
    return reply.status(201).send({ ok: true });
  });

  app.delete<{ Params: { userId: string; id: string } }>('/users/:userId/picturebooks/:id', async (request, reply) => {
    const deleted = await deletePictureBook(db, request.params.userId, request.params.id);
    if (!deleted) {
      return reply.status(404).send({ error: 'Record not found' });
    }
    return reply.status(204).send();
  });
}
