import { createWriteStream } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { join, extname } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import type { DbClient } from '../db/client.js';
import { z } from 'zod';
import {
  deleteVideoAnalysis,
  getVideoAnalysis,
  insertVideoAnalysis,
  listVideoAnalyses,
} from '../db/videoAnalyses.js';
import {
  REPORT_STYLES,
  type ReportStyle,
  type VideoAnalysis,
  type VideoAnalysisSource,
} from '../schema/videoAnalysis.js';
import { deleteKeptFrames, runAnalysisJob, videosDir } from '../lib/videoJobs.js';

export interface VideoAnalysisRoutesDeps {
  db: DbClient;
}

const StyleSchema = z.enum(REPORT_STYLES as [ReportStyle, ...ReportStyle[]]).optional();
const UrlBodySchema = z.object({ url: z.string().url(), style: StyleSchema });
const ALLOWED_EXT = new Set(['.mp4', '.mov', '.webm', '.mkv', '.avi', '.m4v']);

// 新建一条 processing 记录并落库，返回其初始对象。
function createRecord(source: VideoAnalysisSource, style?: ReportStyle): VideoAnalysis {
  return {
    id: randomUUID(),
    source,
    ...(style ? { style } : {}),
    durationSec: 0,
    createdAt: new Date().toISOString(),
    status: 'processing',
    progress: { phase: 'created', windowDone: 0, windowTotal: 0 },
  };
}

export function registerVideoAnalysisRoutes(app: FastifyInstance, deps: VideoAnalysisRoutesDeps): void {
  const { db } = deps;

  // 创建分析任务：multipart（文件）或 application/json { url }，二选一。
  app.post<{ Params: { userId: string } }>('/users/:userId/video/analyses', async (request, reply) => {
    const { userId } = request.params;
    // —— 文件上传 ——
    if (request.isMultipart()) {
      const file = await request.file();
      if (!file) return reply.status(400).send({ error: '未收到上传文件。' });
      const ext = extname(file.filename || '').toLowerCase();
      if (!/^video\//i.test(file.mimetype) && !ALLOWED_EXT.has(ext)) {
        return reply.status(400).send({ error: '请上传视频文件（mp4/mov/webm 等）。' });
      }
      // style 作为普通表单字段随文件一起上传（前端须在 file 之前 append，才会出现在 file.fields）。
      const styleRaw = (file.fields as Record<string, { value?: string } | undefined>)?.style?.value;
      const style = REPORT_STYLES.includes(styleRaw as ReportStyle) ? (styleRaw as ReportStyle) : undefined;
      const record = createRecord({ type: 'upload', filename: file.filename }, style);
      const dest = join(videosDir, `${record.id}${ALLOWED_EXT.has(ext) ? ext : '.mp4'}`);
      await mkdir(videosDir, { recursive: true });
      await pipeline(file.file, createWriteStream(dest));
      await insertVideoAnalysis(db, record, userId);
      void runAnalysisJob(db, record.id, dest);
      return reply.status(201).send({ id: record.id });
    }

    // —— 视频 URL ——
    const parsed = UrlBodySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: '请提供有效的视频链接（url），或改用文件上传。' });
    }
    const record = createRecord({ type: 'url', url: parsed.data.url }, parsed.data.style);
    await insertVideoAnalysis(db, record, userId);
    void runAnalysisJob(db, record.id, undefined); // 由 job 下载
    return reply.status(201).send({ id: record.id });
  });

  // 轮询任务状态 / 进度 / 报告。
  app.get<{ Params: { userId: string; id: string } }>('/users/:userId/video/jobs/:id', async (request, reply) => {
    const analysis = await getVideoAnalysis(db, request.params.id, request.params.userId);
    if (!analysis) return reply.status(404).send({ error: '任务不存在或已失效，请重新上传。' });
    return reply.status(200).send(analysis);
  });

  // 历史分析列表。
  app.get<{ Params: { userId: string } }>('/users/:userId/video/analyses', async (request, reply) => {
    return reply.status(200).send(await listVideoAnalyses(db, request.params.userId));
  });

  // 单条详情。
  app.get<{ Params: { userId: string; id: string } }>('/users/:userId/video/analyses/:id', async (request, reply) => {
    const analysis = await getVideoAnalysis(db, request.params.id, request.params.userId);
    if (!analysis) return reply.status(404).send({ error: '未找到该分析记录。' });
    return reply.status(200).send(analysis);
  });

  // 删除一条。
  app.delete<{ Params: { userId: string; id: string } }>('/users/:userId/video/analyses/:id', async (request, reply) => {
    const deleted = await deleteVideoAnalysis(db, request.params.id, request.params.userId);
    if (!deleted) return reply.status(404).send({ error: '未找到该分析记录。' });
    return reply.status(204).send();
  });
}
