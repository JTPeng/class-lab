// 视频分析任务编排：串行推进 download?(仅URL) → extracting → analyzing(k/N) → reducing → done|failed。
// 进度写回 DB（单一事实源），前端轮询 GET /video/jobs/:id 直接读 DB。
// 单窗失败重试 2 次仍失败则降级标注、不阻断整体（见设计 §3/§9）。
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type Database from 'better-sqlite3';
import { getVideoAnalysis, updateVideoAnalysis } from '../db/videoAnalyses.js';
import type { VideoAnalysis, VideoReport } from '../schema/videoAnalysis.js';
import {
  extractClip,
  extractFrames,
  frameCountForWindow,
  probeDurationSec,
} from './ffmpeg.js';
import {
  analyzeWindow,
  computeReportStats,
  reduceReport,
  type WindowObservation,
} from '../ai/videoAnalysis.js';

const serveRoot = join(dirname(fileURLToPath(import.meta.url)), '../..');
export const videosDir = join(serveRoot, 'uploads/videos'); // 上传/下载的视频落盘处
const framesRoot = join(serveRoot, 'uploads/frames'); // 抽帧临时目录（分析完清理）
// 时间轴配图用的持久短视频片段目录；在 uploads 下，故静态服务地址为 /uploads/video-clips/<id>/<file>。
const keptClipsRoot = join(serveRoot, 'uploads/video-clips');

// 删除某记录持久化的时间轴片段（DELETE 端点调用，避免磁盘残留）。
export async function deleteKeptFrames(id: string): Promise<void> {
  await rm(join(keptClipsRoot, id), { recursive: true, force: true }).catch(() => {});
}

const CLIP_HALF_SEC = 3; // 每条时间轴证据截取 atSec 前后 3s，共 6s（落在 3~10s 范围内）

// 为报告时间轴每条证据从原视频截取一段短片（atSec 前后各 CLIP_HALF_SEC 秒），写回 clipUrl。
async function attachTimelineClips(
  id: string,
  report: VideoReport,
  videoPath: string,
  durationSec: number,
): Promise<void> {
  if (report.timeline.length === 0) return;
  const keptDir = join(keptClipsRoot, id);
  await mkdir(keptDir, { recursive: true });
  for (let i = 0; i < report.timeline.length; i++) {
    const ev = report.timeline[i];
    const start = Math.max(0, Math.min(ev.atSec - CLIP_HALF_SEC, durationSec - CLIP_HALF_SEC * 2));
    const dur = Math.min(CLIP_HALF_SEC * 2, durationSec - start);
    if (dur <= 0) continue;
    const base = `clip${i}.mp4`;
    await extractClip(videoPath, start, dur, join(keptDir, base));
    ev.clipUrl = `/uploads/video-clips/${id}/${base}`;
  }
}

const WINDOW_SEC = 180; // 时间窗大小
const MIN_DURATION_SEC = 1; // 支持从几秒起；仅挡 0 秒/损坏视频
const MAX_DURATION_SEC = 50 * 60; // 50 分钟
const MAX_DOWNLOAD_BYTES = 500 * 1024 * 1024; // URL 下载体积上限 500MB
const MAX_WINDOW_RETRIES = 2;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// 把进度/状态写回 DB。每次都重读最新记录，避免覆盖并发写（此处串行，稳妥起见仍重读）。
function patch(db: Database.Database, id: string, mut: (a: VideoAnalysis) => void): void {
  const fresh = getVideoAnalysis(db, id);
  if (!fresh) return;
  mut(fresh);
  updateVideoAnalysis(db, fresh);
}

function fail(db: Database.Database, id: string, message: string): void {
  patch(db, id, (a) => {
    a.status = 'failed';
    a.progress.phase = 'failed';
    a.error = message;
  });
}

// URL 入口：下载视频到本地。校验可达/类型/体积。
async function downloadToFile(url: string, dest: string): Promise<void> {
  let res: Response;
  try {
    res = await fetch(url);
  } catch {
    throw new Error('无法访问该视频链接（网络不可达或域名解析失败）。');
  }
  if (!res.ok) throw new Error(`视频链接返回 ${res.status}，无法下载。`);
  const type = res.headers.get('content-type') ?? '';
  if (type && !/^video\//i.test(type) && !/octet-stream/i.test(type)) {
    throw new Error(`该链接不是视频类型（Content-Type: ${type}）。`);
  }
  const len = Number(res.headers.get('content-length') ?? '0');
  if (len && len > MAX_DOWNLOAD_BYTES) {
    throw new Error('视频体积超过 500MB 上限。');
  }
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.byteLength > MAX_DOWNLOAD_BYTES) throw new Error('视频体积超过 500MB 上限。');
  await mkdir(dirname(dest), { recursive: true });
  await writeFile(dest, buf);
}

async function analyzeWindowWithRetry(
  framePaths: string[],
  startSec: number,
  endSec: number,
  windowIndex: number,
): Promise<WindowObservation> {
  let lastErr: unknown;
  for (let tryNo = 0; tryNo <= MAX_WINDOW_RETRIES; tryNo++) {
    try {
      return await analyzeWindow(framePaths, startSec, endSec, windowIndex);
    } catch (err) {
      lastErr = err;
      if (tryNo < MAX_WINDOW_RETRIES) await sleep(2000 * (tryNo + 1));
    }
  }
  // 降级：该窗标注失败，不阻断整体。
  return {
    windowIndex,
    startSec,
    endSec,
    child: '（本时段分析失败，已跳过）',
    teacher: '（本时段分析失败，已跳过）',
    reward: { present: false, type: '无', note: `本时段分析失败：${lastErr instanceof Error ? lastErr.message : String(lastErr)}` },
    instruction: { present: false, childResponded: false, note: '本时段分析失败' },
    timeline: [],
  };
}

// 编排主流程。localPath 为上传已落盘的视频路径；URL 入口传 undefined，由本函数下载。
export async function runAnalysisJob(
  db: Database.Database,
  id: string,
  localPath: string | undefined,
): Promise<void> {
  const jobFramesDir = join(framesRoot, id);
  try {
    const analysis = getVideoAnalysis(db, id);
    if (!analysis) return;

    // 1) URL 入口：下载。
    let videoPath = localPath;
    if (!videoPath) {
      if (analysis.source.type !== 'url' || !analysis.source.url) {
        return fail(db, id, '任务缺少视频来源。');
      }
      patch(db, id, (a) => (a.progress.phase = 'downloading'));
      videoPath = join(videosDir, `${id}.mp4`);
      await downloadToFile(analysis.source.url, videoPath);
    }

    // 2) 探测时长 + 校验（几秒 ~ 50 分钟）。
    patch(db, id, (a) => (a.progress.phase = 'extracting'));
    const durationSec = await probeDurationSec(videoPath);
    if (durationSec < MIN_DURATION_SEC) {
      return fail(db, id, '视频过短或无法解析时长，请确认文件有效后重试。');
    }
    if (durationSec > MAX_DURATION_SEC) {
      return fail(
        db,
        id,
        `视频时长 ${Math.round(durationSec / 60)} 分钟，超出支持范围（最长 50 分钟），请裁剪后重试。`,
      );
    }

    // 3) 切窗。
    const windowTotal = Math.ceil(durationSec / WINDOW_SEC);
    patch(db, id, (a) => {
      a.durationSec = durationSec;
      a.progress.windowTotal = windowTotal;
    });

    // 4) 逐窗抽帧 + Map（串行，进度逐窗推进）。
    patch(db, id, (a) => (a.progress.phase = 'analyzing'));
    const observations: WindowObservation[] = [];
    for (let w = 0; w < windowTotal; w++) {
      const startSec = w * WINDOW_SEC;
      const endSec = Math.min(durationSec, startSec + WINDOW_SEC);
      const durSec = endSec - startSec;
      const count = frameCountForWindow(durSec);
      const frames = await extractFrames(videoPath, startSec, durSec, count, jobFramesDir, `w${w}`);
      const obs =
        frames.length > 0
          ? await analyzeWindowWithRetry(frames, startSec, endSec, w)
          : await analyzeWindowWithRetry([], startSec, endSec, w); // 抽帧为空也走降级
      observations.push(obs);
      patch(db, id, (a) => (a.progress.windowDone = w + 1));
    }

    // 5) Reduce 汇总成报告（按记录选定的风格）；再补行为统计与时间轴短视频。
    patch(db, id, (a) => (a.progress.phase = 'reducing'));
    const report = await reduceReport(observations, durationSec, analysis.style);
    report.stats = computeReportStats(observations);
    await attachTimelineClips(id, report, videoPath, durationSec); // 从原视频截取片段（视频文件此时仍保留）

    patch(db, id, (a) => {
      a.report = report;
      a.status = 'done';
      a.progress.phase = 'done';
    });
  } catch (err) {
    fail(db, id, err instanceof Error ? err.message : String(err));
  } finally {
    // 清理该任务的抽帧临时目录（视频文件保留，历史可追溯来源）。
    await rm(jobFramesDir, { recursive: true, force: true }).catch(() => {});
  }
}

// 服务启动时把上次进程遗留的 processing 记录标记为失败（内存 job 已丢，见设计 §9）。
export function markInterruptedJobsFailed(db: Database.Database): void {
  const rows = db.prepare(`SELECT data FROM video_analyses`).all() as { data: string }[];
  for (const row of rows) {
    const a = JSON.parse(row.data) as VideoAnalysis;
    if (a.status === 'processing') {
      a.status = 'failed';
      a.progress.phase = 'failed';
      a.error = '任务因服务重启中断，请重新上传分析。';
      updateVideoAnalysis(db, a);
    }
  }
}
