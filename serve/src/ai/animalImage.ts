// 动物卡通图生成：走阿里百炼 qwen-image（IMAGE_MODEL）。
// 与 imageClient 同鉴权，但响应结构不同：qwen-image-2.0-pro 返回
// output.choices[0].message.content[0].image，需按此解析。
// 单张约 70s，调用方务必缓存。

// 游戏用到的 12 种动物名（与前端 animals.ts 保持一致，供预热脚本遍历）。
export const ANIMAL_NAMES = [
  '小猫', '小狗', '奶牛', '绵羊', '公鸡', '鸭子',
  '青蛙', '小猪', '老虎', '大象', '猴子', '小马',
];

function buildPrompt(name: string): string {
  return `儿童绘本卡通插画风格，一只可爱的${name}，纯白色背景，居中构图，完整身体，色彩明亮温馨，适合幼儿，画面中不要出现任何文字`;
}

export async function generateAnimalImage(name: string): Promise<Buffer> {
  const baseUrl = process.env.DASHSCOPE_BASE_URL;
  const apiKey = process.env.MAAS_API_KEY;
  const model = process.env.IMAGE_MODEL;
  if (!baseUrl || !apiKey || !model) {
    throw new Error('缺少 DASHSCOPE_BASE_URL / MAAS_API_KEY / IMAGE_MODEL，请在 serve/.env 配置');
  }

  const res = await fetch(`${baseUrl}/services/aigc/multimodal-generation/generation`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      input: {
        messages: [{ role: 'user', content: [{ text: buildPrompt(name) }] }],
      },
    }),
  });

  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`动物图生成请求失败: ${res.status} ${detail}`);
  }

  const data = (await res.json()) as {
    output?: { choices?: Array<{ message?: { content?: Array<{ image?: string }> } }> };
  };
  const url = data.output?.choices?.[0]?.message?.content?.[0]?.image;
  if (!url) {
    throw new Error(`动物图生成响应缺少图片 URL: ${JSON.stringify(data)}`);
  }

  const imgRes = await fetch(url);
  if (!imgRes.ok) {
    throw new Error(`下载动物图失败: ${imgRes.status}`);
  }
  return Buffer.from(await imgRes.arrayBuffer());
}
