import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { FastifyInstance } from 'fastify';
import type Database from 'better-sqlite3';
import { z } from 'zod';
import { getLesson, updateLesson } from '../db/index.js';
import { generateImageUrl as defaultGenerateImageUrl } from '../ai/imageClient.js';
import type { Image } from '../schema/lesson.js';

const ImageRequestBodySchema = z.object({
  refKey: z.string().min(1),
  prompt: z.string().min(1),
});

export interface ImageRoutesDeps {
  db: Database.Database;
  generateImageUrl?: typeof defaultGenerateImageUrl;
  fetchImpl?: typeof fetch;
}

export const uploadsDir = join(dirname(fileURLToPath(import.meta.url)), '../../uploads');

function sanitizeRefKey(refKey: string): string {
  return refKey.replace(/[^a-zA-Z0-9]/g, '_');
}

// 内容安全审核拒绝（政治人物/敏感内容等）无法通过重试解决——需明确提示换描述，
// 且绝不能重试（否则每次都失败，白白浪费调用）。
function isContentRejection(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return /DataInspectionFailed|inappropriate content|Green net|data_inspection/i.test(msg);
}

// 把底层错误归类成给老师看的失败原因。
function failureReason(err: unknown): string {
  if (isContentRejection(err)) {
    return '内容被 AI 安全策略拒绝（可能涉及政治人物、名人或敏感内容），无法生成配图，请调整该目标的描述后重试。';
  }
  return '配图生成失败，请稍后重试。';
}

// 临时错误（限流/网络/下载失败等）最多自动重试 2 次（共 3 次尝试）；重试间隔递增退避。
const MAX_IMAGE_RETRIES = 2;
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function upsertImage(images: Image[], entry: Image): Image[] {
  const idx = images.findIndex((img) => img.refKey === entry.refKey);
  if (idx === -1) return [...images, entry];
  const next = [...images];
  next[idx] = entry;
  return next;
}

// Re-reads the lesson right before persisting so that concurrent generations
// for different refKeys on the same lesson don't clobber each other's writes.
// If the lesson was deleted in the meantime, skip the write gracefully.
function persistImageEntry(db: Database.Database, lessonId: string, entry: Image): void {
  const fresh = getLesson(db, lessonId);
  if (!fresh) return;
  fresh.images = upsertImage(fresh.images, entry);
  updateLesson(db, fresh);
}

export async function registerImageRoutes(app: FastifyInstance, deps: ImageRoutesDeps) {
  const { db } = deps;
  const generateImageUrl = deps.generateImageUrl ?? defaultGenerateImageUrl;
  const fetchImpl = deps.fetchImpl ?? fetch;

  app.post<{ Params: { id: string }; Body: { refKey: string; prompt: string } }>(
    '/lessons/:id/images',
    async (request, reply) => {
      const parsed = ImageRequestBodySchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: 'Invalid request body' });
      }
      const { refKey, prompt } = parsed.data;

      const lesson = getLesson(db, request.params.id);
      if (!lesson) {
        return reply.status(404).send({ error: 'Lesson not found' });
      }
      const lessonId = lesson.id;

      // 生成 + 下载 + 落盘：成功返回本地路径，失败抛出（供重试/降级处理）。
      async function attempt(): Promise<string> {
        const ossUrl = await generateImageUrl(prompt);
        const imageResponse = await fetchImpl(ossUrl);
        if (!imageResponse.ok) {
          throw new Error(`下载配图失败: ${imageResponse.status}`);
        }
        const bytes = Buffer.from(await imageResponse.arrayBuffer());
        await mkdir(uploadsDir, { recursive: true });
        const filename = `${lessonId}__${sanitizeRefKey(refKey)}.png`;
        await writeFile(join(uploadsDir, filename), bytes);
        return `/uploads/${filename}`;
      }

      let lastErr: unknown;
      for (let tryNo = 0; tryNo <= MAX_IMAGE_RETRIES; tryNo++) {
        try {
          const url = await attempt();
          const entry: Image = { refKey, prompt, status: 'done', url };
          persistImageEntry(db, lessonId, entry);
          return reply.status(200).send({ image: entry });
        } catch (err) {
          lastErr = err;
          app.log.error(err);
          // 内容安全拒绝：重试无意义，立即降级并说明原因。
          if (isContentRejection(err)) break;
          // 临时错误：还有重试次数则退避后再试。
          if (tryNo < MAX_IMAGE_RETRIES) await sleep(2000 * (tryNo + 1));
        }
      }

      const entry: Image = { refKey, prompt, status: 'failed', reason: failureReason(lastErr) };
      persistImageEntry(db, lessonId, entry);
      return reply.status(200).send({ image: entry });
    },
  );
}
