// 动作参考图生成：走阿里百炼 qwen-image（IMAGE_MODEL），与动物图同一套鉴权与解析。
// qwen-image 返回 output.choices[0].message.content[0].image。单张约 70s，调用方务必缓存。

export interface PoseDef {
  id: string;
  name: string;
  action: string; // 动作中文描述，拼进 prompt
}

// 6 个预设动作（id 必须与前端 poses.ts 保持一致）。
export const POSE_DEFS: PoseDef[] = [
  { id: 'hands-up', name: '双手举高', action: '双臂向上高高举过头顶' },
  { id: 't-pose', name: '双臂平举', action: '双臂向身体两侧水平伸直，成大字形' },
  { id: 'hands-hip', name: '叉腰', action: '双手叉在腰间，两个胳膊肘向外' },
  { id: 'one-hand-up', name: '单手举起', action: '高高举起右手，另一只手自然下垂' },
  { id: 'hands-head', name: '抱抱头', action: '双手抱在头顶上' },
  { id: 'arms-cross', name: '双臂交叉', action: '双臂在胸前交叉成 X 形' },
];

function buildPrompt(action: string): string {
  return `儿童绘本卡通插画风格，一个可爱的小朋友正面站立，${action}，纯白色背景，居中构图，完整上半身，色彩明亮温馨，适合幼儿，画面中不要出现任何文字`;
}

export async function generatePoseImage(id: string): Promise<Buffer> {
  const def = POSE_DEFS.find((p) => p.id === id);
  if (!def) throw new Error(`未知动作 id: ${id}`);

  const baseUrl = process.env.DASHSCOPE_BASE_URL;
  const apiKey = process.env.MAAS_API_KEY;
  const model = process.env.IMAGE_MODEL;
  if (!baseUrl || !apiKey || !model) {
    throw new Error('缺少 DASHSCOPE_BASE_URL / MAAS_API_KEY / IMAGE_MODEL，请在 serve/.env 配置');
  }

  const res = await fetch(`${baseUrl}/services/aigc/multimodal-generation/generation`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      input: { messages: [{ role: 'user', content: [{ text: buildPrompt(def.action) }] }] },
    }),
  });

  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`动作图生成请求失败: ${res.status} ${detail}`);
  }

  const data = (await res.json()) as {
    output?: { choices?: Array<{ message?: { content?: Array<{ image?: string }> } }> };
  };
  const url = data.output?.choices?.[0]?.message?.content?.[0]?.image;
  if (!url) throw new Error(`动作图生成响应缺少图片 URL: ${JSON.stringify(data)}`);

  const imgRes = await fetch(url);
  if (!imgRes.ok) throw new Error(`下载动作图失败: ${imgRes.status}`);
  return Buffer.from(await imgRes.arrayBuffer());
}
