// 视频分析模块类型（对应 docs/specs/2026-07-03-video-analysis-design.md §4）。
// 特教老师上传/粘贴课堂视频，AI 产出五维表现报告草稿。

export type Rating = '好' | '一般' | '待加强'

// 报告生成风格：影响摘要/草稿的语气与详略，评级本身仍客观。
export type ReportStyle = '专业督导版' | '温和家长版' | '简洁要点版'
export const REPORT_STYLES: ReportStyle[] = ['专业督导版', '温和家长版', '简洁要点版']
export const DEFAULT_REPORT_STYLE: ReportStyle = '专业督导版'

export interface DimensionEval {
  rating: Rating
  notes: string // 文字依据
}

// 行为聚合统计：由各时间窗观察确定性汇总而来（非模型生成），用于图表展示。旧报告可能没有此字段。
export interface VideoReportStats {
  rewardBreakdown: { type: string; count: number }[] // 各奖励类型出现的时间窗数
  instructionTotal: number // 出现指令的时间窗数
  instructionResponded: number // 其中孩子有响应的时间窗数
}

export interface VideoReport {
  summary: string // AI 摘要（整体一段话）
  tags: string[] // 行为标签，如 ["主动对视","需口头提示","独立完成穿珠"]
  dimensions: {
    childPerformance: DimensionEval // 孩子表现
    teacherPerformance: DimensionEval // 老师表现
    timelyReward: DimensionEval // 老师是否及时给奖励
    cooperation: DimensionEval // 孩子配合意愿
    followInstruction: DimensionEval // 听指令能力
  }
  timeline: { atSec: number; text: string; clipUrl?: string }[] // 时间轴证据（含截取的短视频片段，可选）
  draft: string // 报告草稿（可整段复制）
  stats?: VideoReportStats // 行为聚合统计（新分析才有）
  needsReview?: string[] // 需人工确认的事项，旧报告可能没有
  encouragement?: string // 给老师/督导的鼓励语，旧报告可能没有
}

export interface VideoAnalysis {
  id: string
  caseId?: string | null // 关联到某个个案（可选，事后由老师手动关联）
  source: { type: 'upload' | 'url'; filename?: string; url?: string }
  style?: ReportStyle // 报告生成风格（缺省视为专业督导版）
  durationSec: number
  createdAt: string
  status: 'processing' | 'done' | 'failed'
  progress: { phase: string; windowDone: number; windowTotal: number }
  report?: VideoReport
  error?: string
}

// 历史列表项：详情的裁剪版。
export interface VideoAnalysisListItem {
  id: string
  source: VideoAnalysis['source']
  durationSec: number
  createdAt: string
  status: VideoAnalysis['status']
}

// 五维维度的展示元信息（key → 中文标签），页面与 mock 共用，保证顺序一致。
export const DIMENSION_META: { key: keyof VideoReport['dimensions']; label: string }[] = [
  { key: 'childPerformance', label: '孩子表现' },
  { key: 'teacherPerformance', label: '老师表现' },
  { key: 'timelyReward', label: '及时奖励' },
  { key: 'cooperation', label: '配合意愿' },
  { key: 'followInstruction', label: '听指令能力' },
]
