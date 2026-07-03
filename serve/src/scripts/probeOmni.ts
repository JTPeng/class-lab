// 能力探针：验证 VIDEO_MODEL（qwen3.7-plus）能接收哪些模态——图片帧 / video 帧序列 / 音频段。
// 这是视频分析模块的实现第一步（见 docs .../2026-07-03-video-analysis-design.md §7）。
// 用真实 MAAS_API_KEY 分别发请求，打印真实响应，得出精确结论。结论必须来自真实响应，禁止臆测。
//
// 2026-07-03 实测：图片 ✅ / video 帧序列 ✅（帧数须 4~8000）/ 音频 ❌。
// 据此 v1 走 video 帧序列做视觉分析，不接音频（见 memory: video-model-capabilities）。
//
// 运行：npm run probe:omni
import 'dotenv/config';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(import.meta.dirname, '..', '..'); // serve/

// 从现有资源目录挑真实素材作为探针输入（不依赖 ffmpeg）。按体积升序，取前 n 个以减小 payload。
function pickSmallest(dir: string, exts: string[], n = 1): string[] {
  const abs = join(ROOT, dir);
  const files = readdirSync(abs)
    .filter((f) => exts.some((e) => f.toLowerCase().endsWith(e)))
    .map((f) => join(abs, f));
  if (files.length < n) throw new Error(`目录 ${dir} 下 ${exts.join('/')} 素材不足 ${n} 个`);
  files.sort((a, b) => readFileSync(a).length - readFileSync(b).length);
  return files.slice(0, n);
}

async function chat(content: unknown[]): Promise<{ status: number; reply: string }> {
  const res = await fetch(`${process.env.MAAS_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.MAAS_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: process.env.VIDEO_MODEL,
      messages: [{ role: 'user', content }],
    }),
  });
  const text = await res.text();
  let reply = text;
  try {
    reply = JSON.parse(text)?.choices?.[0]?.message?.content ?? text;
  } catch {
    /* 保留原文 */
  }
  return { status: res.status, reply: (reply || text).slice(0, 600) };
}

async function main(): Promise<void> {
  const model = process.env.VIDEO_MODEL;
  if (!process.env.MAAS_API_KEY || !process.env.MAAS_BASE_URL || !model) {
    throw new Error('缺少 MAAS_API_KEY / MAAS_BASE_URL / VIDEO_MODEL，请检查 serve/.env');
  }
  console.log(`探针模型：${model}\n`);

  const toDataUrl = (p: string) =>
    `data:${p.endsWith('.png') ? 'image/png' : 'image/jpeg'};base64,${readFileSync(p).toString('base64')}`;

  // 第 1 路：单张图片。
  const [imgPath] = pickSmallest('animal-images', ['.png', '.jpg', '.jpeg', '.webp']);
  console.log(`[图片] ${imgPath} (${(readFileSync(imgPath).length / 1024).toFixed(0)}KB)`);
  const imgRes = await chat([
    { type: 'text', text: '这张图里有什么？用一句话描述。' },
    { type: 'image_url', image_url: { url: toDataUrl(imgPath) } },
  ]);
  const imageOk = imgRes.status === 200;
  console.log(imageOk ? `  ✅ 图片可用。回复：${imgRes.reply}` : `  ❌ 图片失败 ${imgRes.status}：${imgRes.reply}`);

  // 第 2 路：video 帧序列（v1 实际依赖的机制，帧数须 4~8000）。
  const framePaths = pickSmallest('animal-images', ['.png', '.jpg', '.jpeg', '.webp'], 4);
  console.log(`\n[video] ${framePaths.length} 帧作为一个 video 项`);
  const videoRes = await chat([
    { type: 'text', text: '这是一段视频的若干帧，请一句话描述里面发生了什么。' },
    { type: 'video', video: framePaths.map(toDataUrl) },
  ]);
  const videoOk = videoRes.status === 200;
  console.log(videoOk ? `  ✅ video 帧序列可用。回复：${videoRes.reply}` : `  ❌ video 失败 ${videoRes.status}：${videoRes.reply}`);

  // 第 3 路：音频（OpenAI 兼容 input_audio，裸 base64）。
  const [audioPath] = pickSmallest('tts-cache', ['.wav', '.mp3']);
  console.log(`\n[音频] ${audioPath} (${(readFileSync(audioPath).length / 1024).toFixed(0)}KB)`);
  const audioRes = await chat([
    { type: 'text', text: '这段音频里说了什么？用一句话描述。' },
    { type: 'input_audio', input_audio: { data: readFileSync(audioPath).toString('base64'), format: audioPath.endsWith('.mp3') ? 'mp3' : 'wav' } },
  ]);
  const audioOk = audioRes.status === 200;
  console.log(audioOk ? `  ✅ 音频可用。回复：${audioRes.reply}` : `  ❌ 音频失败 ${audioRes.status}：${audioRes.reply}`);

  // 结论。
  console.log('\n──────── 结论 ────────');
  if (videoOk) {
    console.log(
      `✅ video 帧序列可用${imageOk ? '（图片亦可用）' : ''}：v1 走 video 帧序列做视觉分析。` +
        (audioOk ? '音频也可用，可考虑接入语音维度。' : '音频不支持——口头奖励/听指令维度改由视觉证据判断并标注。'),
    );
    return;
  }
  console.log('❌ video 帧序列不可用：请勿继续搭建，检查模型名/鉴权/端点，并回到用户确认。');
  process.exitCode = 1;
}

main().catch((err) => {
  console.error('探针异常：', err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
