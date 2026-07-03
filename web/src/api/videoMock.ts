// 视频分析前端 Mock：后端 /api/video/* 未就绪时，在浏览器完整预览
// 「上传 → 进度 → 报告」全流程。后端上线后把 client.ts 的 USE_VIDEO_MOCK 改为 false 即弃用本文件。
// 数据存内存，刷新后进行中的任务与新建记录会丢失，seed 报告每次都在。

import type { ReportStyle, VideoAnalysis, VideoAnalysisListItem, VideoReport } from '../types/video'

interface Record {
  id: string
  source: VideoAnalysis['source']
  style?: ReportStyle
  durationSec: number
  createdAt: string
  startedAt: number | null // null = 已完成的 seed；number = 进行中，按经过时间推进
}

const N_WINDOWS = 3 // mock 时间窗数量

// 一份贴合特教课堂的示例报告，seed 与新任务完成后共用。
function buildReport(): VideoReport {
  return {
    summary:
      '本节课围绕「认识颜色」进行一对一 DTT 训练。孩子整体状态较投入，能在老师提示下完成多数回合；老师指令清晰、节奏稳定，强化以口头表扬为主，偶有击掌，实物强化略显滞后。建议缩短指令与强化之间的间隔，并适当增加孩子主动发起的机会。',
    tags: ['主动对视', '需口头提示', '独立指认红色', '中途分心 1 次', '击掌强化'],
    dimensions: {
      childPerformance: {
        rating: '一般',
        notes: '能完成约 7/10 回合的颜色指认，独立完成红色、蓝色；黄色需二次提示。第 6 分钟出现约 20 秒分心，经提示后回到任务。',
      },
      teacherPerformance: {
        rating: '好',
        notes: '指令简洁一致（「把红色给我」），提示层级清楚，回合间过渡自然，全程语气温和。',
      },
      timelyReward: {
        rating: '待加强',
        notes: '口头表扬及时，但实物/代币强化多次延迟到回合结束后才给出，削弱了即时关联。建议正确反应后 1–2 秒内强化。',
      },
      cooperation: {
        rating: '一般',
        notes: '多数回合愿意配合，2 次出现推开教具的回避行为，老师用短暂等待化解，未升级。',
      },
      followInstruction: {
        rating: '好',
        notes: '对单步指令响应良好，平均 3 秒内做出反应；对含两个信息的指令（「先看再指」）需拆分后才完成。',
      },
    },
    timeline: [
      { atSec: 45, text: '老师下达第一条指令，孩子主动对视并正确指认红色。', clipUrl: 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4' },
      { atSec: 210, text: '孩子独立完成蓝色指认，老师口头表扬 + 击掌。', clipUrl: 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/friday.mp4' },
      { atSec: 360, text: '孩子分心约 20 秒，老师短暂等待后重新发起回合。', clipUrl: 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/garden.mp4' },
      { atSec: 540, text: '黄色指认二次提示后完成，实物强化延迟到回合结束才给出。', clipUrl: 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/huge_ball.mp4' },
      { atSec: 900, text: '收尾回合孩子配合度回升，主动把教具递给老师。', clipUrl: 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/small.mp4' },
    ],
    stats: {
      rewardBreakdown: [
        { type: '口头表扬', count: 5 },
        { type: '击掌', count: 2 },
        { type: '实物', count: 1 },
      ],
      instructionTotal: 8,
      instructionResponded: 6,
    },
    needsReview: [
      '3:30 老师的口头表扬内容需听音频确认具体措辞',
      '9:00 老师下达两步指令的具体口头内容需音频确认',
    ],
    encouragement: '老师的提示层级用得很稳，孩子在分心后能被短暂等待重新拉回任务，这份耐心很难得，继续保持！',
    draft:
      '【课堂视频分析报告草稿】\n\n本节为「认识颜色」一对一 DTT 训练，时长约 18 分钟。\n\n孩子表现：整体投入，能完成约 7/10 回合的颜色指认，红色、蓝色可独立完成，黄色需二次提示；第 6 分钟前后有一次约 20 秒的分心，经提示后回到任务。\n\n老师表现：指令简洁一致、提示层级清晰、节奏稳定，全程语气温和，回合过渡自然。\n\n强化与配合：口头表扬及时到位，但实物/代币强化存在延迟，建议正确反应后 1–2 秒内给出以增强即时关联；孩子配合意愿总体良好，出现 2 次轻微回避，老师以短暂等待化解，未升级。\n\n听指令能力：单步指令响应良好（平均 3 秒内），两步指令需拆分。\n\n建议：1) 缩短指令—强化间隔，强化即时化；2) 复杂指令先拆解为单步；3) 适当增加孩子主动发起的机会。',
  }
}

// seed：一条上传、一条链接，均已完成，首次进入即有内容可点开详情。
const records = new Map<string, Record>([
  [
    'seed-upload',
    {
      id: 'seed-upload',
      source: { type: 'upload', filename: '认识颜色-一对一.mp4' },
      durationSec: 1080,
      createdAt: '2026-07-02T10:20:00.000Z',
      startedAt: null,
    },
  ],
  [
    'seed-url',
    {
      id: 'seed-url',
      source: { type: 'url', url: 'https://example.com/class/perceive-shape.mp4' },
      durationSec: 1320,
      createdAt: '2026-07-01T15:05:00.000Z',
      startedAt: null,
    },
  ],
])

// 按经过时间推进阶段：约 10.5s 走完。
function phaseFor(elapsedMs: number): { phase: string; windowDone: number } {
  const s = elapsedMs / 1000
  if (s < 1.5) return { phase: 'created', windowDone: 0 }
  if (s < 3) return { phase: 'extracting', windowDone: 0 }
  if (s < 9) return { phase: 'analyzing', windowDone: Math.min(N_WINDOWS, Math.floor((s - 3) / 2) + 1) }
  if (s < 10.5) return { phase: 'reducing', windowDone: N_WINDOWS }
  return { phase: 'done', windowDone: N_WINDOWS }
}

function toAnalysis(rec: Record): VideoAnalysis {
  const base = {
    id: rec.id,
    source: rec.source,
    ...(rec.style ? { style: rec.style } : {}),
    durationSec: rec.durationSec,
    createdAt: rec.createdAt,
  }
  if (rec.startedAt === null) {
    return { ...base, status: 'done', progress: { phase: 'done', windowDone: N_WINDOWS, windowTotal: N_WINDOWS }, report: buildReport() }
  }
  const { phase, windowDone } = phaseFor(Date.now() - rec.startedAt)
  const done = phase === 'done'
  return {
    ...base,
    status: done ? 'done' : 'processing',
    progress: { phase, windowDone, windowTotal: N_WINDOWS },
    ...(done ? { report: buildReport() } : {}),
  }
}

function create(source: VideoAnalysis['source'], style?: ReportStyle): Promise<{ id: string }> {
  const id = crypto.randomUUID()
  records.set(id, { id, source, style, durationSec: 1080, createdAt: new Date().toISOString(), startedAt: Date.now() })
  return Promise.resolve({ id })
}

export const videoMock = {
  createFromUrl(url: string, style?: ReportStyle): Promise<{ id: string }> {
    return create({ type: 'url', url }, style)
  },
  createFromFile(file: File, style?: ReportStyle): Promise<{ id: string }> {
    return create({ type: 'upload', filename: file.name }, style)
  },
  getVideoJob(id: string): Promise<VideoAnalysis> {
    const rec = records.get(id)
    if (!rec) return Promise.reject(new Error(JSON.stringify({ error: '任务已失效，请重试' })))
    return Promise.resolve(toAnalysis(rec))
  },
  getVideoAnalysis(id: string): Promise<VideoAnalysis> {
    const rec = records.get(id)
    if (!rec) return Promise.reject(new Error(JSON.stringify({ error: '未找到该分析记录' })))
    return Promise.resolve(toAnalysis(rec))
  },
  listVideoAnalyses(): Promise<VideoAnalysisListItem[]> {
    const items = [...records.values()]
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((rec) => {
        const a = toAnalysis(rec)
        return { id: a.id, source: a.source, durationSec: a.durationSec, createdAt: a.createdAt, status: a.status }
      })
    return Promise.resolve(items)
  },
  deleteVideoAnalysis(id: string): Promise<void> {
    records.delete(id)
    return Promise.resolve()
  },
}
