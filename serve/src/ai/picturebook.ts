// 绘本生成管线：通义千问编排分镜 + 通义万相逐场景生图。
// 从 picture-book-reading-card 项目原样移植（TS 化），使用独立的 DASHSCOPE_API_KEY。

const CREATE_URL =
  'https://dashscope.aliyuncs.com/api/v1/services/aigc/text2image/image-synthesis';
const TASK_URL = 'https://dashscope.aliyuncs.com/api/v1/tasks/';
const TEXT_URL =
  'https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation';
const MODEL = 'wanx2.1-t2i-turbo';
const TEXT_MODEL = 'qwen-turbo';
const POLL_INTERVAL_MS = 2000;
const POLL_TIMEOUT_MS = 90000;

// 可选 AI 生图画风：id -> prompt 前缀
export const STYLE_PROMPTS: Record<string, string> = {
  storybook: '儿童绘本插画风格，柔和色彩，温馨可爱',
  watercolor: '水彩画风格，笔触柔和，色彩通透',
  cyberpunk: '赛博朋克风格，霓虹灯光，未来都市，高对比暗调',
  pixel: '像素艺术风格，8-bit 复古游戏画面',
  render3d: '3D 渲染风格，立体质感，柔和光照',
};
const DEFAULT_STYLE = 'storybook';

// 通义万相支持的尺寸白名单（前端传入需在此集合内，否则回退默认）
export const ALLOWED_SIZES = new Set(['1024*1024', '720*1280', '1280*720']);
const DEFAULT_SIZE = '1024*1024';
export const MAX_PAGES = 4;

export interface Scene {
  text: string;
  image: string;
}

export interface GeneratePicturebookInput {
  title: string;
  thoughts?: string;
  style?: string;
  n?: number | string;
  size?: string;
}

// 单个场景的生图 prompt：画风 + 书名 + 场景，强调统一画风、无文字
export function buildScenePrompt(title: string, scene: string, style?: string): string {
  const stylePrefix = STYLE_PROMPTS[style ?? ''] || STYLE_PROMPTS[DEFAULT_STYLE];
  return `${stylePrefix}，绘本《${title}》，画面：${scene}，保持角色与画风统一，画面中不要出现任何文字`;
}

// 封面图 prompt：复用第一个分镜的画面内容，换成居中留白的封面构图
export function buildCoverPrompt(title: string, scene: string, style?: string): string {
  const stylePrefix = STYLE_PROMPTS[style ?? ''] || STYLE_PROMPTS[DEFAULT_STYLE];
  return `${stylePrefix}，绘本《${title}》封面，画面：${scene}，主体居中，构图工整，四周留白便于叠加书名，保持角色与画风统一，画面中不要出现任何文字`;
}

// 规整参数：页数限制 1~MAX_PAGES，尺寸走白名单
export function normalizeOptions({ n, size }: { n?: number | string; size?: string }): {
  pages: number;
  size: string;
} {
  let pages = Number(n) || 1;
  pages = Math.min(Math.max(Math.round(pages), 1), MAX_PAGES);
  const finalSize = size && ALLOWED_SIZES.has(size) ? size : DEFAULT_SIZE;
  return { pages, size: finalSize };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function apiKey(): string {
  const key = process.env.DASHSCOPE_API_KEY;
  if (!key) throw new Error('缺少 DASHSCOPE_API_KEY，请在 serve/.env 中配置');
  return key;
}

// 从文本中解析出场景数组，失败返回 null。
// 兼容 qwen 返回字符串数组或对象数组（如 [{"scene":"..."}]）两种情况。
export function parseScenes(content: string): string[] | null {
  try {
    const m = content.match(/\[[\s\S]*\]/);
    if (m) {
      const arr = JSON.parse(m[0]);
      if (Array.isArray(arr) && arr.length) {
        const scenes = arr
          .map((x: unknown) => {
            if (typeof x === 'string') return x.trim();
            if (x && typeof x === 'object') {
              const obj = x as Record<string, unknown>;
              const v =
                obj.scene ||
                obj.text ||
                obj.desc ||
                obj.description ||
                obj.画面 ||
                obj.场景 ||
                Object.values(obj).find((val) => typeof val === 'string');
              return String(v || '').trim();
            }
            return '';
          })
          .filter(Boolean);
        if (scenes.length) return scenes;
      }
    }
  } catch {
    /* 忽略，走回退 */
  }
  return null;
}

// 用通义千问按书名+心得编 n 段连贯故事场景
export async function generateStoryScenes(
  title: string,
  thoughts: string,
  n: number,
): Promise<string[]> {
  const sys = '你是绘本分镜师，只输出 JSON 数组，不要任何多余文字或解释。';
  const user =
    `为绘本《${title}》设计 ${n} 个连贯的故事场景` +
    (thoughts ? `，参考读者心得：${thoughts}` : '') +
    `。每个场景用一句简短中文描述画面内容（不要包含文字标注）。` +
    `严格返回长度为 ${n} 的 JSON 字符串数组。`;

  let res: Response;
  let data: any;
  try {
    res = await fetch(TEXT_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey()}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: TEXT_MODEL,
        input: {
          messages: [
            { role: 'system', content: sys },
            { role: 'user', content: user },
          ],
        },
        parameters: { result_format: 'message' },
      }),
    });
    data = await res.json();
  } catch (err) {
    throw new Error('调用文本模型失败：' + ((err as Error).message || String(err)));
  }
  if (!res.ok || !data.output) {
    throw new Error(`生成分镜失败：${JSON.stringify(data)}`);
  }
  const content =
    (data.output.choices && data.output.choices[0] && data.output.choices[0].message.content) ||
    data.output.text ||
    '';
  const scenes = parseScenes(content);
  if (scenes && scenes.length >= n) return scenes.slice(0, n);
  // 回退：解析失败时用占位场景，保证流程可用
  return Array.from({ length: n }, (_, i) => `《${title}》故事第 ${i + 1} 幕`);
}

async function createTask(prompt: string, count: number, size: string): Promise<string> {
  let res: Response;
  let data: any;
  try {
    res = await fetch(CREATE_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey()}`,
        'Content-Type': 'application/json',
        'X-DashScope-Async': 'enable',
      },
      body: JSON.stringify({
        model: MODEL,
        input: { prompt },
        parameters: { size, n: count },
      }),
    });
    data = await res.json();
  } catch (err) {
    throw new Error('调用生图服务失败：' + ((err as Error).message || String(err)));
  }
  if (!res.ok || !data.output || !data.output.task_id) {
    throw new Error(`创建生图任务失败：${JSON.stringify(data)}`);
  }
  return data.output.task_id;
}

// 轮询任务，成功后返回所有图片 URL 数组
async function pollTask(taskId: string): Promise<string[]> {
  const deadline = Date.now() + POLL_TIMEOUT_MS;
  while (Date.now() < deadline) {
    let res: Response;
    let data: any;
    try {
      res = await fetch(TASK_URL + taskId, {
        headers: { Authorization: `Bearer ${apiKey()}` },
      });
      data = await res.json();
    } catch (err) {
      throw new Error('查询生图任务失败：' + ((err as Error).message || String(err)));
    }
    const status = data.output && data.output.task_status;
    if (status === 'SUCCEEDED') {
      const results = data.output.results || [];
      const urls = results.map((r: any) => r && r.url).filter(Boolean);
      if (urls.length === 0) {
        throw new Error(`生图成功但未返回图片地址：${JSON.stringify(data)}`);
      }
      return urls;
    }
    if (status === 'FAILED' || status === 'UNKNOWN') {
      throw new Error(`生图任务失败：${JSON.stringify(data)}`);
    }
    await sleep(POLL_INTERVAL_MS);
  }
  throw new Error('生图超时，请重试');
}

async function fetchAsDataUrl(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error('下载生成的图片失败');
  const buf = Buffer.from(await res.arrayBuffer());
  const mime = res.headers.get('content-type') || 'image/png';
  return `data:${mime};base64,${buf.toString('base64')}`;
}

// 生成单张场景插画，返回 base64 data URL
async function generateOneImage(prompt: string, size: string): Promise<string> {
  const taskId = await createTask(prompt, 1, size);
  const urls = await pollTask(taskId);
  return fetchAsDataUrl(urls[0]);
}

export interface GeneratePicturebookResult {
  scenes: Scene[];
  cover: string;
}

// 生成一本绘本图集：先编分镜，再逐场景生图，最后额外生成一张封面图
// 封面复用第一个分镜的画面内容，只是换成封面构图（居中留白）
export async function generatePicturebook(input: GeneratePicturebookInput): Promise<GeneratePicturebookResult> {
  const opts = normalizeOptions({ n: input.n, size: input.size });
  const sceneTexts = await generateStoryScenes(input.title, input.thoughts ?? '', opts.pages);
  // 逐张串行生成，避免并发请求触发阿里百炼速率限制（Throttling.RateQuota）——不要改成并发。
  const images: string[] = [];
  for (const scene of sceneTexts) {
    images.push(await generateOneImage(buildScenePrompt(input.title, scene, input.style), opts.size));
  }
  const cover = await generateOneImage(buildCoverPrompt(input.title, sceneTexts[0], input.style), opts.size);
  return { scenes: sceneTexts.map((text, i) => ({ text, image: images[i] })), cover };
}
