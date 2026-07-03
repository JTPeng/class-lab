// 动作图磁盘缓存：按动作 id hash 存 png，每种只生成一次。路由与预热脚本共用。
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { generatePoseImage } from '../ai/poseImage.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
export const poseImagesDir = join(__dirname, '..', '..', 'pose-images');

function cacheFile(id: string): string {
  const hash = createHash('sha256').update(id).digest('hex');
  return join(poseImagesDir, `${hash}.png`);
}

// 返回该动作图 png Buffer；无缓存则调用 AI 生成并落盘（约 70s）。
export async function ensurePoseImage(id: string): Promise<Buffer> {
  mkdirSync(poseImagesDir, { recursive: true });
  const file = cacheFile(id);
  if (existsSync(file)) return readFile(file);
  const buf = await generatePoseImage(id);
  await writeFile(file, buf);
  return buf;
}

export function isPoseCached(id: string): boolean {
  return existsSync(cacheFile(id));
}
