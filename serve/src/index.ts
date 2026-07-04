import 'dotenv/config';
import { mkdirSync, rmSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import fastifyStatic from '@fastify/static';
import multipart from '@fastify/multipart';
import type { DbClient } from './db/client.js';
import { createDbClient } from './db/client.js';
import { initSchema } from './db/index.js';
import { generateLesson as defaultGenerateLesson } from './services/generateLesson.js';
import { registerCaseRoutes } from './routes/cases.js';
import { registerImageRoutes, uploadsDir } from './routes/images.js';
import { registerPicturebookRoutes, sharedDir } from './routes/picturebook.js';
import { registerUserRoutes } from './routes/users.js';
import { registerTtsRoutes } from './routes/tts.js';
import { registerAnimalImageRoutes } from './routes/animalImage.js';
import { registerFruitImageRoutes } from './routes/fruitImage.js';
import { registerPoseImageRoutes } from './routes/poseImage.js';
import { registerVideoAnalysisRoutes } from './routes/videoAnalysis.js';
import { registerPictureBookRecordsRoutes } from './routes/pictureBookRecords.js';
import { registerGameSessionsRoutes } from './routes/gameSessions.js';
import { markInterruptedJobsFailed, videosDir } from './lib/videoJobs.js';
import type { generateImageUrl as defaultGenerateImageUrl } from './ai/imageClient.js';

export interface BuildAppDeps {
  db?: DbClient;
  generateLesson?: typeof defaultGenerateLesson;
  generateImageUrl?: typeof defaultGenerateImageUrl;
  fetchImpl?: typeof fetch;
}

export async function buildApp(deps: BuildAppDeps = {}): Promise<FastifyInstance> {
  const app = Fastify();
  const db = deps.db ?? (await createDbClient());
  if (!deps.db) await initSchema(db);
  const generateLesson = deps.generateLesson ?? defaultGenerateLesson;

  app.register(cors, { origin: true });
  // 视频分析上传：不限制单文件大小（Infinity 关闭上限，否则默认约 1MB）。注册在根实例，子路由可用 request.file()。
  app.register(multipart, { limits: { fileSize: Infinity } });

  mkdirSync(uploadsDir, { recursive: true });
  app.register(fastifyStatic, { root: uploadsDir, prefix: '/uploads/' });

  // 视频落盘目录；并把上次进程遗留的 processing 记录标记为失败（内存 job 已丢）。
  mkdirSync(videosDir, { recursive: true });
  await markInterruptedJobsFailed(db);

  // 绘本分享图目录：每次启动清空，避免临时图堆积（与原 picture-book 项目行为一致）。
  rmSync(sharedDir, { recursive: true, force: true });
  mkdirSync(sharedDir, { recursive: true });
  app.register(fastifyStatic, { root: sharedDir, prefix: '/shared/', decorateReply: false });

  app.get('/health', async () => ({ ok: true }));

  app.register(
    async (instance) => {
      await registerCaseRoutes(instance, { db, generateLesson });
      await registerImageRoutes(instance, {
        db,
        generateImageUrl: deps.generateImageUrl,
        fetchImpl: deps.fetchImpl,
      });
      await registerPicturebookRoutes(instance);
      await registerUserRoutes(instance, { db });
      registerTtsRoutes(instance);
      registerAnimalImageRoutes(instance);
      registerFruitImageRoutes(instance);
      registerPoseImageRoutes(instance);
      registerVideoAnalysisRoutes(instance, { db });
      await registerPictureBookRecordsRoutes(instance, { db });
      await registerGameSessionsRoutes(instance, { db });
    },
    { prefix: '/api' },
  );

  return app;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const port = Number(process.env.PORT ?? 8787);

  buildApp().then((app) => {
    app.listen({ port, host: '0.0.0.0' }, (err, address) => {
      if (err) {
        app.log.error(err);
        process.exit(1);
      }
      console.log(`Server listening at ${address}`);
    });
  });
}
