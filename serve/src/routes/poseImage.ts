// 动作图路由：GET /api/pose-image?id=hands-up 返回 png（懒生成+磁盘缓存）。
import type { FastifyInstance } from 'fastify';
import { ensurePoseImage } from '../lib/poseImageCache.js';
import { POSE_DEFS } from '../ai/poseImage.js';

export function registerPoseImageRoutes(app: FastifyInstance): void {
  app.get('/pose-image', async (request, reply) => {
    const id = ((request.query as { id?: string }).id ?? '').trim();
    if (!id || !POSE_DEFS.some((p) => p.id === id)) {
      return reply.status(400).send({ error: '无效的动作 id' });
    }
    try {
      const png = await ensurePoseImage(id);
      return reply
        .header('Content-Type', 'image/png')
        .header('Cache-Control', 'public, max-age=31536000, immutable')
        .send(png);
    } catch (err) {
      const message = err instanceof Error ? err.message : '动作图生成失败';
      return reply.status(502).send({ error: message });
    }
  });
}
