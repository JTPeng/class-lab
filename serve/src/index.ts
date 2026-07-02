import 'dotenv/config';
import { pathToFileURL } from 'node:url';
import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import type Database from 'better-sqlite3';
import { getDb } from './db/index.js';
import { generateLesson as defaultGenerateLesson } from './services/generateLesson.js';
import { registerLessonRoutes } from './routes/lessons.js';

export interface BuildAppDeps {
  db?: Database.Database;
  generateLesson?: typeof defaultGenerateLesson;
}

export function buildApp(deps: BuildAppDeps = {}): FastifyInstance {
  const app = Fastify();
  const db = deps.db ?? getDb();
  const generateLesson = deps.generateLesson ?? defaultGenerateLesson;

  app.register(cors, { origin: true });

  app.get('/health', async () => ({ ok: true }));

  app.register(
    async (instance) => {
      await registerLessonRoutes(instance, { db, generateLesson });
    },
    { prefix: '/api' },
  );

  return app;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const app = buildApp();
  const port = Number(process.env.PORT ?? 8787);

  app.listen({ port, host: '0.0.0.0' }, (err, address) => {
    if (err) {
      app.log.error(err);
      process.exit(1);
    }
    console.log(`Server listening at ${address}`);
  });
}
