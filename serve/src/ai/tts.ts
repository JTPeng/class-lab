// 语音合成客户端：走阿里百炼 qwen-tts（多模态生成接口）。
// 与 imageClient 相同的鉴权/端点模式：DASHSCOPE_BASE_URL + MAAS_API_KEY。
// qwen-tts 返回一段签名 OSS 的 wav URL（约 24h 失效），这里下载为 Buffer 交给调用方落盘缓存。

const TTS_MODEL = process.env.TTS_MODEL || 'qwen-tts';
// 音色：Cherry（芊悦，活泼女声），适合儿童游戏。可用 TTS_VOICE 覆盖。
const TTS_VOICE = process.env.TTS_VOICE || 'Cherry';

export async function synthesizeSpeech(text: string): Promise<Buffer> {
  const baseUrl = process.env.DASHSCOPE_BASE_URL;
  const apiKey = process.env.MAAS_API_KEY;
  if (!baseUrl || !apiKey) {
    throw new Error('缺少 DASHSCOPE_BASE_URL 或 MAAS_API_KEY，请在 serve/.env 中配置');
  }

  const res = await fetch(`${baseUrl}/services/aigc/multimodal-generation/generation`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: TTS_MODEL,
      input: { text, voice: TTS_VOICE },
    }),
  });

  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`语音合成请求失败: ${res.status} ${detail}`);
  }

  const data = (await res.json()) as {
    output?: { audio?: { url?: string; data?: string } };
  };
  const url = data.output?.audio?.url;
  if (!url) {
    throw new Error(`语音合成响应缺少音频 URL: ${JSON.stringify(data)}`);
  }

  const audioRes = await fetch(url);
  if (!audioRes.ok) {
    throw new Error(`下载合成音频失败: ${audioRes.status}`);
  }
  return Buffer.from(await audioRes.arrayBuffer());
}
