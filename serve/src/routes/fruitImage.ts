// 水果图路由：GET /api/fruit-image?name=苹果 返回 png（懒生成+磁盘缓存）。
import type { FastifyInstance } from 'fastify';
import { ensureFruitImage } from '../lib/fruitImageCache.js';
import { FRUIT_NAMES } from '../ai/fruitImage.js';

export function registerFruitImageRoutes(app: FastifyInstance): void {
  app.get('/fruit-image', async (request, reply) => {
    const name = ((request.query as { name?: string }).name ?? '').trim();
    if (!name || !FRUIT_NAMES.includes(name)) {
      return reply.status(400).send({ error: '无效的水果名 name' });
    }
    try {
      const png = await ensureFruitImage(name);
      return reply
        .header('Content-Type', 'image/png')
        .header('Cache-Control', 'public, max-age=31536000, immutable')
        .send(png);
    } catch (err) {
      const message = err instanceof Error ? err.message : '水果图生成失败';
      return reply.status(502).send({ error: message });
    }
  });
}
