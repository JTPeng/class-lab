import 'dotenv/config';
import { mkdirSync, rmSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import fastifyStatic from '@fastify/static';
import type Database from 'better-sqlite3';
import { getDb } from './db/index.js';
import { generateLesson as defaultGenerateLesson } from './services/generateLesson.js';
import { registerLessonRoutes } from './routes/lessons.js';
import { registerImageRoutes, uploadsDir } from './routes/images.js';
import { registerPicturebookRoutes, sharedDir } from './routes/picturebook.js';
import { registerUserRoutes } from './routes/users.js';
import { registerTtsRoutes } from './routes/tts.js';
import { registerAnimalImageRoutes } from './routes/animalImage.js';
import type { generateImageUrl as defaultGenerateImageUrl } from './ai/imageClient.js';

export interface BuildAppDeps {
  db?: Database.Database;
  generateLesson?: typeof defaultGenerateLesson;
  generateImageUrl?: typeof defaultGenerateImageUrl;
  fetchImpl?: typeof fetch;
}

export function buildApp(deps: BuildAppDeps = {}): FastifyInstance {
  const app = Fastify();
  const db = deps.db ?? getDb();
  const generateLesson = deps.generateLesson ?? defaultGenerateLesson;

  app.register(cors, { origin: true });

  mkdirSync(uploadsDir, { recursive: true });
  app.register(fastifyStatic, { root: uploadsDir, prefix: '/uploads/' });

  // 绘本分享图目录：每次启动清空，避免临时图堆积（与原 picture-book 项目行为一致）。
  rmSync(sharedDir, { recursive: true, force: true });
  mkdirSync(sharedDir, { recursive: true });
  app.register(fastifyStatic, { root: sharedDir, prefix: '/shared/', decorateReply: false });

  app.get('/health', async () => ({ ok: true }));

  app.register(
    async (instance) => {
      await registerLessonRoutes(instance, { db, generateLesson });
      await registerImageRoutes(instance, {
        db,
        generateImageUrl: deps.generateImageUrl,
        fetchImpl: deps.fetchImpl,
      });
      await registerPicturebookRoutes(instance);
      await registerUserRoutes(instance, { db });
      registerTtsRoutes(instance);
      registerAnimalImageRoutes(instance);
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
