import { randomBytes } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { FastifyInstance } from 'fastify';
import { getLanIp } from '../lib/network.js';
import { generatePicturebook as defaultGeneratePicturebook } from '../ai/picturebook.js';

// 分享图片的存放目录（serve/shared），静态托管在 /shared 下。
export const sharedDir = join(dirname(fileURLToPath(import.meta.url)), '../../shared');

// 分享图为导出的整张长图 PNG（base64 data URL），可能达数 MB，需放宽请求体上限。
const SHARE_BODY_LIMIT = 12 * 1024 * 1024;

export interface PicturebookRoutesDeps {
  generatePicturebook?: typeof defaultGeneratePicturebook;
}

// 解析 data URL，返回 { ext, buffer }；非法则返回 null
function parseDataUrl(dataUrl: string): { ext: string; buffer: Buffer } | null {
  const m = /^data:image\/(png|jpeg|jpg|webp);base64,(.+)$/i.exec(dataUrl || '');
  if (!m) return null;
  const ext = m[1].toLowerCase() === 'jpeg' ? 'jpg' : m[1].toLowerCase();
  return { ext, buffer: Buffer.from(m[2], 'base64') };
}

export async function registerPicturebookRoutes(app: FastifyInstance, deps: PicturebookRoutesDeps = {}) {
  const generatePicturebook = deps.generatePicturebook ?? defaultGeneratePicturebook;

  app.post<{
    Body: { title?: string; thoughts?: string; style?: string; n?: number; size?: string };
  }>('/picturebook/generate', async (request, reply) => {
    const { title, thoughts, style, n, size } = request.body ?? {};
    if (!title || !String(title).trim()) {
      return reply.status(400).send({ error: '请填写书名' });
    }
    try {
      const { scenes, cover } = await generatePicturebook({
        title: String(title).trim(),
        thoughts: thoughts ? String(thoughts).trim() : '',
        style: style ? String(style) : undefined,
        n,
        size: size ? String(size) : undefined,
      });
      return reply.status(200).send({ scenes, cover });
    } catch (err) {
      app.log.error(err);
      return reply.status(502).send({ error: (err as Error).message || '生成失败，请重试' });
    }
  });

  app.post<{ Body: { image?: string } }>(
    '/picturebook/share',
    { bodyLimit: SHARE_BODY_LIMIT },
    async (request, reply) => {
      const parsed = parseDataUrl(request.body?.image ?? '');
      if (!parsed) {
        return reply.status(400).send({ error: '无效的图片数据' });
      }
      try {
        await mkdir(sharedDir, { recursive: true });
        const name = `${Date.now()}-${randomBytes(4).toString('hex')}.${parsed.ext}`;
        await writeFile(join(sharedDir, name), parsed.buffer);

        const port = Number(process.env.PORT ?? 8787);
        const ip = getLanIp();
        // 分享图由后端（监听 0.0.0.0）直接托管，手机可在同一局域网直连。
        const base = ip ? `http://${ip}:${port}` : `http://${request.headers.host}`;
        return reply.status(200).send({ url: `${base}/shared/${name}` });
      } catch (err) {
        app.log.error(err);
        return reply.status(500).send({ error: '生成分享链接失败，请重试' });
      }
    },
  );

  // 只返回局域网 IP（不含端口）；前端用 IP + 当前页面端口拼「扫码上手机」链接。
  app.get('/lan-url', async (_request, reply) => {
    return reply.status(200).send({ ip: getLanIp() });
  });
}
