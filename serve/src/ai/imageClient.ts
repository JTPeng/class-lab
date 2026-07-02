export interface GenerateImageOptions {
  fetchImpl?: typeof fetch;
}

// 调用 qwen-image 多模态生成接口，返回签名 OSS 图片 URL（该 URL 约 2 小时后失效，
// 调用方需自行下载落盘）。
export async function generateImageUrl(
  prompt: string,
  opts: GenerateImageOptions = {},
): Promise<string> {
  const fetchImpl = opts.fetchImpl ?? fetch;
  const baseUrl = process.env.DASHSCOPE_BASE_URL;
  const apiKey = process.env.MAAS_API_KEY;
  const model = process.env.IMAGE_MODEL;

  const response = await fetchImpl(`${baseUrl}/services/aigc/multimodal-generation/generation`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      input: {
        messages: [{ role: 'user', content: [{ text: prompt }] }],
      },
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`多模态生成接口调用失败: ${response.status} ${body}`);
  }

  const data = await response.json();
  const image = data?.output?.choices?.[0]?.message?.content?.[0]?.image;

  if (typeof image !== 'string' || !image) {
    throw new Error('多模态生成接口响应缺少 output.choices[0].message.content[0].image');
  }

  return image;
}
