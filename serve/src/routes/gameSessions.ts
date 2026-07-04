import type { FastifyInstance } from 'fastify';
import type { DbClient } from '../db/client.js';
import { z } from 'zod';
import { insertGameSession, listGameSessionsByCase } from '../db/gameSessions.js';

export interface GameSessionsRoutesDeps {
  db: DbClient;
}

const CreateBodySchema = z.object({
  level: z.number(),
  score: z.number(),
  caseId: z.string().min(1).nullable().optional(),
  teacherCooperation: z.number().min(1).max(5).nullable().optional(),
  teacherProgress: z.number().min(1).max(5).nullable().optional(),
});

export async function registerGameSessionsRoutes(app: FastifyInstance, deps: GameSessionsRoutesDeps) {
  const { db } = deps;

  app.post<{ Params: { userId: string; gameId: string } }>(
    '/users/:userId/games/:gameId/sessions',
    async (request, reply) => {
      const parsed = CreateBodySchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: 'Invalid input', issues: parsed.error.issues });
      }
      const record = await insertGameSession(db, {
        userId: request.params.userId,
        gameId: request.params.gameId,
        caseId: parsed.data.caseId ?? null,
        level: parsed.data.level,
        score: parsed.data.score,
        teacherCooperation: parsed.data.teacherCooperation ?? null,
        teacherProgress: parsed.data.teacherProgress ?? null,
      });
      return reply.status(201).send(record);
    },
  );

  app.get<{ Params: { caseId: string } }>('/cases/:caseId/game-sessions', async (request, reply) => {
    return reply.status(200).send(await listGameSessionsByCase(db, request.params.caseId));
  });
}
