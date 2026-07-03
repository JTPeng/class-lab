// 动物图路由：GET /api/animal-image?name=小猫 返回 png（懒生成+磁盘缓存）。
import type { FastifyInstance } from 'fastify';
import { ensureAnimalImage } from '../lib/animalImageCache.js';
import { ANIMAL_NAMES } from '../ai/animalImage.js';

export function registerAnimalImageRoutes(app: FastifyInstance): void {
  app.get('/animal-image', async (request, reply) => {
    const name = ((request.query as { name?: string }).name ?? '').trim();
    if (!name || !ANIMAL_NAMES.includes(name)) {
      return reply.status(400).send({ error: '无效的动物名 name' });
    }
    try {
      const png = await ensureAnimalImage(name);
      return reply
        .header('Content-Type', 'image/png')
        .header('Cache-Control', 'public, max-age=31536000, immutable')
        .send(png);
    } catch (err) {
      const message = err instanceof Error ? err.message : '动物图生成失败';
      return reply.status(502).send({ error: message });
    }
  });
}
