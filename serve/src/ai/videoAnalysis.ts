// 视频分析的 AI 层：Map（一窗帧序列 → 结构化观察）+ Reduce（全部观察 → 五维报告）。
// 走 VIDEO_MODEL（qwen3.7-plus）的 OpenAI 兼容 chat/completions。
// 实测该模型只能收图/video 帧序列、收不了音频（见 memory: video-model-capabilities），
// 故一律基于视觉；涉及口头表扬/口头指令的判断，模型须诚实标注“可能需要音频、本版未捕捉”。
import { readFile } from 'node:fs/promises';
import {
  DEFAULT_REPORT_STYLE,
  type Rating,
  type ReportStyle,
  type VideoReport,
  type VideoReportStats,
} from '../schema/videoAnalysis.js';

export interface WindowObservation {
  windowIndex: number;
  startSec: number;
  endSec: number;
  child: string; // 孩子在做什么
  teacher: string; // 老师做了/看起来说了什么（视觉推断）
  reward: { present: boolean; type: string; note: string }; // 奖励：口头/击掌/实物…（视觉可见的）
  instruction: { present: boolean; childResponded: boolean; note: string }; // 指令与孩子响应
  timeline: { atSec: number; text: string }[]; // 该窗关键时刻
}

export interface VideoAnalysisAiOptions {
  fetchImpl?: typeof fetch;
}

const RATINGS: Rating[] = ['好', '一般', '待加强'];

// 宽松解析：模型可能用 ```json 包裹或夹带文字，抽出第一个 JSON 对象。
function parseJsonLoose(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const raw = fenced ? fenced[1] : text;
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start === -1 || end === -1 || end < start) {
    throw new Error(`模型返回内容不含 JSON：${text.slice(0, 300)}`);
  }
  return JSON.parse(raw.slice(start, end + 1));
}

async function chat(content: unknown[], opts: VideoAnalysisAiOptions): Promise<string> {
  const fetchImpl = opts.fetchImpl ?? fetch;
  const res = await fetchImpl(`${process.env.MAAS_BASE_URL}/chat/completions`, {
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
  if (!res.ok) {
    throw new Error(`视频分析模型调用失败: ${res.status} ${await res.text()}`);
  }
  const data = await res.json();
  const out = data?.choices?.[0]?.message?.content;
  if (typeof out !== 'string') {
    throw new Error('视频分析模型响应缺少 choices[0].message.content');
  }
  return out;
}

async function framesToDataUrls(framePaths: string[]): Promise<string[]> {
  return Promise.all(
    framePaths.map(async (p) => `data:image/jpeg;base64,${(await readFile(p)).toString('base64')}`),
  );
}

const MAP_INSTRUCTION = `你是特殊教育领域的课堂观察员。下面给你的是一段课堂视频「某个时间窗」内均匀抽取的若干帧（按时间先后排列）。
请只依据你**看得见**的画面，客观描述这段时间里发生了什么，聚焦：孩子在做什么、老师在做什么、有没有给孩子奖励（击掌/竖大拇指/给实物/拥抱等可见动作）、老师有没有下达指令以及孩子是否作出响应。
重要：你收不到声音。凡是需要听声音才能确定的（如老师口头表扬、口头指令的具体内容），只能从画面（口型、手势、指向、孩子随后的动作）谨慎推断，并在 note 里注明“可能需音频确认”。不要编造听到的话。
只输出一个 JSON 对象，字段如下（不要多余文字）：
{
  "child": "这段时间孩子在做什么（一句话）",
  "teacher": "这段时间老师在做什么（一句话）",
  "reward": { "present": true/false, "type": "口头表扬/击掌/竖拇指/实物/拥抱/无", "note": "依据，可含‘可能需音频确认’" },
  "instruction": { "present": true/false, "childResponded": true/false, "note": "指令是什么、孩子如何响应的可见依据" },
  "timeline": [ { "atSec": 该窗内相对秒数, "text": "关键时刻发生了什么" } ]
}`;

// Map：分析单个时间窗的帧序列。
export async function analyzeWindow(
  framePaths: string[],
  startSec: number,
  endSec: number,
  windowIndex: number,
  opts: VideoAnalysisAiOptions = {},
): Promise<WindowObservation> {
  const dataUrls = await framesToDataUrls(framePaths);
  const text = await chat(
    [
      { type: 'text', text: `${MAP_INSTRUCTION}\n\n本窗时间范围：第 ${startSec}~${endSec} 秒。` },
      { type: 'video', video: dataUrls },
    ],
    opts,
  );
  const raw = parseJsonLoose(text) as Partial<WindowObservation>;
  // 把该窗内相对秒数换算成整片绝对秒数，便于 Reduce 汇总时间轴。
  const timeline = Array.isArray(raw.timeline)
    ? raw.timeline
        .filter((t) => t && typeof t.text === 'string')
        .map((t) => ({ atSec: startSec + Math.max(0, Math.round(Number(t.atSec) || 0)), text: t.text }))
    : [];
  return {
    windowIndex,
    startSec,
    endSec,
    child: typeof raw.child === 'string' ? raw.child : '（本时段画面未识别到孩子的明确活动）',
    teacher: typeof raw.teacher === 'string' ? raw.teacher : '（本时段画面未识别到老师的明确活动）',
    reward: {
      present: Boolean(raw.reward?.present),
      type: typeof raw.reward?.type === 'string' ? raw.reward.type : '无',
      note: typeof raw.reward?.note === 'string' ? raw.reward.note : '',
    },
    instruction: {
      present: Boolean(raw.instruction?.present),
      childResponded: Boolean(raw.instruction?.childResponded),
      note: typeof raw.instruction?.note === 'string' ? raw.instruction.note : '',
    },
    timeline,
  };
}

function coerceRating(v: unknown): Rating {
  return RATINGS.includes(v as Rating) ? (v as Rating) : '一般';
}

// 从各窗观察确定性聚合行为统计（不问模型，防幻觉）：奖励类型分布 + 指令响应。
export function computeReportStats(observations: WindowObservation[]): VideoReportStats {
  const rewardCounts = new Map<string, number>();
  let instructionTotal = 0;
  let instructionResponded = 0;
  for (const o of observations) {
    if (o.reward.present) {
      const type = o.reward.type?.trim() || '未标注';
      rewardCounts.set(type, (rewardCounts.get(type) ?? 0) + 1);
    }
    if (o.instruction.present) {
      instructionTotal += 1;
      if (o.instruction.childResponded) instructionResponded += 1;
    }
  }
  const rewardBreakdown = [...rewardCounts.entries()]
    .map(([type, count]) => ({ type, count }))
    .sort((a, b) => b.count - a.count);
  return { rewardBreakdown, instructionTotal, instructionResponded };
}

// 不同报告风格的语气指引（只影响摘要/草稿/标签的表达，评级与依据仍客观）。
const STYLE_GUIDANCE: Record<ReportStyle, string> = {
  专业督导版: '语气专业、客观、循证，面向教研督导；摘要与草稿用规范的特教术语，条理清晰。',
  温和家长版: '语气温暖、鼓励、通俗，面向家长；少用术语，多肯定孩子的点滴进步，给出可在家配合的温和建议。',
  简洁要点版: '语气精简，摘要控制在两三句；草稿用要点罗列（每条一句），便于快速浏览。',
};

const REDUCE_INSTRUCTION = `你是特殊教育督导。下面是一段课堂视频按时间窗切分后、每个窗口的客观观察（JSON 数组，均基于画面，无音频）。
请汇总成一份给特教老师看的中文报告，做定性评价（不必量化），并对语音相关维度诚实标注“口头信号可能未被本版捕捉”。
评级只用三档之一：好 / 一般 / 待加强。
只输出一个 JSON 对象（不要多余文字）：
{
  "summary": "整体一段话摘要",
  "tags": ["行为标签", "如：主动对视、需口头提示、独立完成任务"],
  "encouragement": "给老师/督导的一两句鼓励话语，具体点出本节课观察到的亮点（如孩子的某个进步、老师的某个有效做法），不要空泛套话",
  "dimensions": {
    "childPerformance":   { "rating": "好/一般/待加强", "notes": "孩子表现的文字依据" },
    "teacherPerformance": { "rating": "...", "notes": "老师表现的文字依据" },
    "timelyReward":       { "rating": "...", "notes": "老师是否及时给奖励；若依赖口头表扬请标注需音频确认" },
    "cooperation":        { "rating": "...", "notes": "孩子配合意愿的依据" },
    "followInstruction":  { "rating": "...", "notes": "听指令能力：指令→响应的依据；口头指令部分标注需音频确认" }
  },
  "needsReview": ["把上面各维度 notes 里提到的“需音频确认/需人工核实”等顾虑，在这里汇总成一条条具体事项，如：“3:30 老师的口头表扬内容需听音频确认”；没有则给空数组"],
  "timeline": [ { "atSec": 绝对秒数, "text": "第几分钟发生了什么" } ],
  "draft": "可整段复制、发给家长或存档的报告草稿（分段、口吻专业温和）"
}`;

// Reduce：把所有窗口观察汇总成报告。纯文本调用（观察已是文字）。
export async function reduceReport(
  observations: WindowObservation[],
  durationSec: number,
  style: ReportStyle = DEFAULT_REPORT_STYLE,
  opts: VideoAnalysisAiOptions = {},
): Promise<VideoReport> {
  const payload = JSON.stringify(
    observations.map((o) => ({
      时间窗: `${o.startSec}~${o.endSec}s`,
      孩子: o.child,
      老师: o.teacher,
      奖励: o.reward,
      指令与响应: o.instruction,
      关键时刻: o.timeline,
    })),
  );
  const text = await chat(
    [
      {
        type: 'text',
        text: `${REDUCE_INSTRUCTION}\n\n【报告风格：${style}】${STYLE_GUIDANCE[style]}\n\n视频总时长约 ${durationSec} 秒。各窗口观察如下：\n${payload}`,
      },
    ],
    opts,
  );
  const raw = parseJsonLoose(text) as {
    summary?: unknown;
    tags?: unknown;
    encouragement?: unknown;
    dimensions?: Record<string, { rating?: unknown; notes?: unknown }>;
    needsReview?: unknown;
    timeline?: unknown;
    draft?: unknown;
  };
  const dim = (key: string) => ({
    rating: coerceRating(raw.dimensions?.[key]?.rating),
    notes: typeof raw.dimensions?.[key]?.notes === 'string' ? (raw.dimensions[key].notes as string) : '',
  });
  // Reduce 若丢了时间轴，用各窗观察兜底拼一份，保证用户始终能看到证据。
  const timeline = Array.isArray(raw.timeline)
    ? (raw.timeline as unknown[])
        .filter((t): t is { atSec: number; text: string } => Boolean(t) && typeof (t as { text?: unknown }).text === 'string')
        .map((t) => ({ atSec: Math.max(0, Math.round(Number(t.atSec) || 0)), text: t.text }))
    : observations.flatMap((o) => o.timeline);
  return {
    summary: typeof raw.summary === 'string' ? raw.summary : '（未能生成摘要）',
    tags: Array.isArray(raw.tags) ? raw.tags.filter((t): t is string => typeof t === 'string') : [],
    encouragement: typeof raw.encouragement === 'string' ? raw.encouragement : '',
    dimensions: {
      childPerformance: dim('childPerformance'),
      teacherPerformance: dim('teacherPerformance'),
      timelyReward: dim('timelyReward'),
      cooperation: dim('cooperation'),
      followInstruction: dim('followInstruction'),
    },
    needsReview: Array.isArray(raw.needsReview)
      ? raw.needsReview.filter((t): t is string => typeof t === 'string')
      : [],
    timeline,
    draft: typeof raw.draft === 'string' ? raw.draft : '（未能生成报告草稿）',
  };
}
