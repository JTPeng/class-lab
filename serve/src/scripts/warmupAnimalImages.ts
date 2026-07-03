// 手动预热：把 12 种动物图一次性生成并缓存。串行执行（避免并发触发限流）。
// 运行：npm run warmup:images
import 'dotenv/config';
import { ANIMAL_NAMES } from '../ai/animalImage.js';
import { ensureAnimalImage, isCached } from '../lib/animalImageCache.js';

async function main(): Promise<void> {
  console.log(`开始预热 ${ANIMAL_NAMES.length} 种动物图（单张约 70s，串行）…`);
  for (const name of ANIMAL_NAMES) {
    if (isCached(name)) {
      console.log(`  ✓ ${name} 已缓存，跳过`);
      continue;
    }
    const t = Date.now();
    try {
      const buf = await ensureAnimalImage(name);
      console.log(`  ✓ ${name} 生成完成 ${(buf.length / 1024).toFixed(0)}KB，用时 ${((Date.now() - t) / 1000).toFixed(0)}s`);
    } catch (err) {
      console.error(`  ✗ ${name} 失败：${err instanceof Error ? err.message : String(err)}`);
    }
  }
  console.log('预热结束。');
}

main();
