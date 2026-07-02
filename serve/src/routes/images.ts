import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { FastifyInstance } from 'fastify';
import type Database from 'better-sqlite3';
import { getLesson, updateLesson } from '../db/index.js';
import { generateImageUrl as defaultGenerateImageUrl } from '../ai/imageClient.js';
import type { Image } from '../schema/lesson.js';

export interface ImageRoutesDeps {
  db: Database.Database;
  generateImageUrl?: typeof defaultGenerateImageUrl;
  fetchImpl?: typeof fetch;
}

export const uploadsDir = join(dirname(fileURLToPath(import.meta.url)), '../../uploads');

function sanitizeRefKey(refKey: string): string {
  return refKey.replace(/[^a-zA-Z0-9]/g, '_');
}

function upsertImage(images: Image[], entry: Image): Image[] {
  const idx = images.findIndex((img) => img.refKey === entry.refKey);
  if (idx === -1) return [...images, entry];
  const next = [...images];
  next[idx] = entry;
  return next;
}

export async function registerImageRoutes(app: FastifyInstance, deps: ImageRoutesDeps) {
  const { db } = deps;
  const generateImageUrl = deps.generateImageUrl ?? defaultGenerateImageUrl;
  const fetchImpl = deps.fetchImpl ?? fetch;

  app.post<{ Params: { id: string }; Body: { refKey: string; prompt: string } }>(
    '/lessons/:id/images',
    async (request, reply) => {
      const lesson = getLesson(db, request.params.id);
      if (!lesson) {
        return reply.status(404).send({ error: 'Lesson not found' });
      }

      const { refKey, prompt } = request.body;

      try {
        const ossUrl = await generateImageUrl(prompt);
        const imageResponse = await fetchImpl(ossUrl);
        if (!imageResponse.ok) {
          throw new Error(`下载配图失败: ${imageResponse.status}`);
        }
        const bytes = Buffer.from(await imageResponse.arrayBuffer());

        await mkdir(uploadsDir, { recursive: true });
        const filename = `${lesson.id}__${sanitizeRefKey(refKey)}.png`;
        await writeFile(join(uploadsDir, filename), bytes);

        const entry: Image = { refKey, prompt, status: 'done', url: `/uploads/${filename}` };
        lesson.images = upsertImage(lesson.images, entry);
        updateLesson(db, lesson);

        return reply.status(200).send({ image: entry });
      } catch (err) {
        app.log.error(err);
        const entry: Image = { refKey, prompt, status: 'failed' };
        lesson.images = upsertImage(lesson.images, entry);
        updateLesson(db, lesson);

        return reply.status(200).send({ image: entry });
      }
    },
  );
}
