// 水果图磁盘缓存：按水果名 hash 存 png，每种只生成一次。
// 路由与预热脚本共用 ensureFruitImage。镜像 animalImageCache。
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { generateFruitImage } from '../ai/fruitImage.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
export const fruitImagesDir = join(__dirname, '..', '..', 'fruit-images');

function cacheFile(name: string): string {
  const hash = createHash('sha256').update(name).digest('hex');
  return join(fruitImagesDir, `${hash}.png`);
}

// 返回该水果图的 png Buffer；无缓存则调用 AI 生成并落盘（约 70s）。
export async function ensureFruitImage(name: string): Promise<Buffer> {
  mkdirSync(fruitImagesDir, { recursive: true });
  const file = cacheFile(name);
  if (existsSync(file)) {
    return readFile(file);
  }
  const buf = await generateFruitImage(name);
  await writeFile(file, buf);
  return buf;
}

export function isCached(name: string): boolean {
  return existsSync(cacheFile(name));
}
