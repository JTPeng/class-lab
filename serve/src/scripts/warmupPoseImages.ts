// 手动预热：把 6 个动作图一次性生成并缓存。串行执行（避免并发触发限流）。
// 运行：npm run warmup:poses
import 'dotenv/config';
import { POSE_DEFS } from '../ai/poseImage.js';
import { ensurePoseImage, isPoseCached } from '../lib/poseImageCache.js';

async function main(): Promise<void> {
  console.log(`开始预热 ${POSE_DEFS.length} 个动作图（单张约 70s，串行）…`);
  for (const def of POSE_DEFS) {
    if (isPoseCached(def.id)) {
      console.log(`  ✓ ${def.name} 已缓存，跳过`);
      continue;
    }
    const t = Date.now();
    try {
      const buf = await ensurePoseImage(def.id);
      console.log(`  ✓ ${def.name} 生成完成 ${(buf.length / 1024).toFixed(0)}KB，用时 ${((Date.now() - t) / 1000).toFixed(0)}s`);
    } catch (err) {
      console.error(`  ✗ ${def.name} 失败：${err instanceof Error ? err.message : String(err)}`);
    }
  }
  console.log('预热结束。');
}

main();
