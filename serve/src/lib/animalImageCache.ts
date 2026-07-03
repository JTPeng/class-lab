// 动物图磁盘缓存：按动物名 hash 存 png，每种只生成一次。
// 路由与预热脚本共用 ensureAnimalImage。
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { generateAnimalImage } from '../ai/animalImage.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
export const animalImagesDir = join(__dirname, '..', '..', 'animal-images');

function cacheFile(name: string): string {
  const hash = createHash('sha256').update(name).digest('hex');
  return join(animalImagesDir, `${hash}.png`);
}

// 返回该动物图的 png Buffer；无缓存则调用 AI 生成并落盘（约 70s）。
export async function ensureAnimalImage(name: string): Promise<Buffer> {
  mkdirSync(animalImagesDir, { recursive: true });
  const file = cacheFile(name);
  if (existsSync(file)) {
    return readFile(file);
  }
  const buf = await generateAnimalImage(name);
  await writeFile(file, buf);
  return buf;
}

export function isCached(name: string): boolean {
  return existsSync(cacheFile(name));
}
