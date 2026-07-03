// 手动预热：把 8 种水果图一次性生成并缓存。串行执行（避免并发触发限流）。
// 运行：npm run warmup:fruits
import 'dotenv/config';
import { FRUIT_NAMES } from '../ai/fruitImage.js';
import { ensureFruitImage, isCached } from '../lib/fruitImageCache.js';

async function main(): Promise<void> {
  console.log(`开始预热 ${FRUIT_NAMES.length} 种水果图（单张约 70s，串行）…`);
  for (const name of FRUIT_NAMES) {
    if (isCached(name)) {
      console.log(`  ✓ ${name} 已缓存，跳过`);
      continue;
    }
    const t = Date.now();
    try {
      const buf = await ensureFruitImage(name);
      console.log(`  ✓ ${name} 生成完成 ${(buf.length / 1024).toFixed(0)}KB，用时 ${((Date.now() - t) / 1000).toFixed(0)}s`);
    } catch (err) {
      console.error(`  ✗ ${name} 失败：${err instanceof Error ? err.message : String(err)}`);
    }
  }
  console.log('预热结束。');
}

main();
