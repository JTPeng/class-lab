// TTS 路由：GET /api/tts?text=... 返回 wav 音频。
// 文本固定且有限（动物谜语），按 text+voice 的 hash 做磁盘缓存，每段只合成一次，省 token。
import type { FastifyInstance } from 'fastify';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { synthesizeSpeech } from '../ai/tts.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
export const ttsCacheDir = join(__dirname, '..', '..', 'tts-cache');

function cacheKey(text: string): string {
  const voice = process.env.TTS_VOICE || 'Cherry';
  return createHash('sha256').update(`${voice}::${text}`).digest('hex');
}

export function registerTtsRoutes(app: FastifyInstance): void {
  mkdirSync(ttsCacheDir, { recursive: true });

  app.get('/tts', async (request, reply) => {
    const text = ((request.query as { text?: string }).text ?? '').trim();
    if (!text) {
      return reply.status(400).send({ error: '缺少 text 参数' });
    }

    const file = join(ttsCacheDir, `${cacheKey(text)}.wav`);
    try {
      let audio: Buffer;
      if (existsSync(file)) {
        audio = await readFile(file);
      } else {
        audio = await synthesizeSpeech(text);
        await writeFile(file, audio);
      }
      // 音频可长期缓存（内容随 text 固定不变）
      return reply
        .header('Content-Type', 'audio/wav')
        .header('Cache-Control', 'public, max-age=31536000, immutable')
        .send(audio);
    } catch (err) {
      const message = err instanceof Error ? err.message : '语音合成失败';
      return reply.status(502).send({ error: message });
    }
  });
}
