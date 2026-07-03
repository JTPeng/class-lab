// ffmpeg / ffprobe 封装：探测时长 + 按时间窗抽帧（v1 不抽音频，见设计 §2 实测更新）。
// 需系统预装 ffmpeg（含 ffprobe）：macOS `brew install ffmpeg`。未装时抛出明确中文错误，
// 由 videoJobs 捕获后把 job 标 failed。
import { execFile } from 'node:child_process';
import { mkdir, readdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

// video 内容类型要求单项帧数在 (4, 8000)；单窗按 ~10s 一帧、下限 4、上限 12 帧。
export const MIN_FRAMES_PER_WINDOW = 4;
export const MAX_FRAMES_PER_WINDOW = 12;

function isNotInstalled(err: unknown): boolean {
  return (err as NodeJS.ErrnoException)?.code === 'ENOENT';
}

const NOT_INSTALLED_MSG =
  '未检测到 ffmpeg/ffprobe，无法处理视频。请先安装：macOS `brew install ffmpeg`（其他平台见 ffmpeg 官网）。';

// 探测视频总时长（秒，向下取整）。
export async function probeDurationSec(videoPath: string): Promise<number> {
  try {
    const { stdout } = await execFileAsync('ffprobe', [
      '-v', 'error',
      '-show_entries', 'format=duration',
      '-of', 'default=noprint_wrappers=1:nokey=1',
      videoPath,
    ]);
    const sec = Number.parseFloat(stdout.trim());
    if (!Number.isFinite(sec) || sec <= 0) {
      throw new Error(`ffprobe 未能解析出有效时长：${stdout.trim() || '(空)'}`);
    }
    return Math.floor(sec);
  } catch (err) {
    if (isNotInstalled(err)) throw new Error(NOT_INSTALLED_MSG);
    throw err;
  }
}

// 单窗应抽多少帧：按 ~10s 一帧，clamp 到 [MIN, MAX]。
export function frameCountForWindow(durSec: number): number {
  const byRate = Math.round(durSec / 10);
  return Math.min(MAX_FRAMES_PER_WINDOW, Math.max(MIN_FRAMES_PER_WINDOW, byRate));
}

// 从 [startSec, startSec+durSec) 时间窗均匀抽 count 帧，落到 outDir，返回帧文件绝对路径（升序）。
// 用 fps 滤镜等距采样；-frames:v 封顶抽帧数。
export async function extractFrames(
  videoPath: string,
  startSec: number,
  durSec: number,
  count: number,
  outDir: string,
  prefix: string,
): Promise<string[]> {
  await mkdir(outDir, { recursive: true });
  const rate = count / durSec; // 每秒抽 count/durSec 帧 → 全窗约 count 帧
  const pattern = join(outDir, `${prefix}_%03d.jpg`);
  try {
    await execFileAsync('ffmpeg', [
      '-hide_banner', '-loglevel', 'error',
      '-ss', String(startSec),
      '-i', videoPath,
      '-t', String(durSec),
      '-vf', `fps=${rate.toFixed(6)}`,
      '-frames:v', String(count),
      '-q:v', '4',
      '-y', pattern,
    ]);
  } catch (err) {
    if (isNotInstalled(err)) throw new Error(NOT_INSTALLED_MSG);
    throw err;
  }
  const files = (await readdir(outDir))
    .filter((f) => f.startsWith(`${prefix}_`) && f.endsWith('.jpg'))
    .sort();
  return files.map((f) => join(outDir, f));
}

// 从 [startSec, startSec+durSec) 截取一段短视频片段（时间轴配图用，3~10s），转码为 mp4 落到 outPath。
export async function extractClip(
  videoPath: string,
  startSec: number,
  durSec: number,
  outPath: string,
): Promise<void> {
  await mkdir(dirname(outPath), { recursive: true });
  try {
    await execFileAsync('ffmpeg', [
      '-hide_banner', '-loglevel', 'error',
      '-ss', String(startSec),
      '-i', videoPath,
      '-t', String(durSec),
      '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '23',
      '-c:a', 'aac', '-b:a', '128k',
      '-movflags', '+faststart',
      '-y', outPath,
    ]);
  } catch (err) {
    if (isNotInstalled(err)) throw new Error(NOT_INSTALLED_MSG);
    throw err;
  }
}
