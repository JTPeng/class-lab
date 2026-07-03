// 视频分析报告数据结构（见 docs .../2026-07-03-video-analysis-design.md §4）。
// 该结构与「音频用 omni 还是 ASR」无关——五维报告的形状不变，故可先行落地。
// 报告对象由后端产出（非用户输入），用普通 TS 类型即可；URL 入口的校验在 route 层用 zod。

export type Rating = '好' | '一般' | '待加强';

// 报告生成风格：影响 Reduce 阶段摘要/草稿的语气与详略（评级本身仍客观）。
export type ReportStyle = '专业督导版' | '温和家长版' | '简洁要点版';
export const REPORT_STYLES: ReportStyle[] = ['专业督导版', '温和家长版', '简洁要点版'];
export const DEFAULT_REPORT_STYLE: ReportStyle = '专业督导版';

export interface DimensionEval {
  rating: Rating;
  notes: string; // 文字依据
}

export interface VideoAnalysisSource {
  type: 'upload' | 'url';
  filename?: string;
  url?: string;
}

export interface VideoAnalysisProgress {
  phase: string; // created / downloading / extracting / analyzing / reducing / done / failed
  windowDone: number;
  windowTotal: number;
}

// 行为聚合统计：由各窗观察确定性汇总而来（非模型生成），供报告图表使用。
// 可选——旧报告没有此字段，前端优雅降级。
export interface VideoReportStats {
  rewardBreakdown: { type: string; count: number }[]; // 各奖励类型出现的时间窗数
  instructionTotal: number; // 出现指令的时间窗数
  instructionResponded: number; // 其中孩子有响应的时间窗数
}

export interface VideoReport {
  summary: string; // AI 摘要（整体一段话）
  tags: string[]; // 行为标签，如 ["主动对视","需口头提示","独立完成穿珠"]
  dimensions: {
    childPerformance: DimensionEval; // 孩子表现
    teacherPerformance: DimensionEval; // 老师表现
    timelyReward: DimensionEval; // 老师是否及时给奖励
    cooperation: DimensionEval; // 孩子配合意愿
    followInstruction: DimensionEval; // 听指令能力
  };
  timeline: { atSec: number; text: string; clipUrl?: string }[]; // 时间轴证据（含截取的短视频片段，可选）
  draft: string; // 报告草稿（可整段复制存档/发家长）
  stats?: VideoReportStats; // 行为聚合统计（新分析才有）
  needsReview?: string[]; // 需人工确认的事项（如音频相关的口头表扬/指令内容），旧报告可能没有
  encouragement?: string; // 给老师/督导的鼓励语（结合本节课具体表现），旧报告可能没有
}

export interface VideoAnalysis {
  id: string;
  source: VideoAnalysisSource;
  style?: ReportStyle; // 报告生成风格（缺省视为专业督导版；旧记录可能无此字段）
  durationSec: number;
  createdAt: string;
  status: 'processing' | 'done' | 'failed';
  progress: VideoAnalysisProgress;
  report?: VideoReport;
  error?: string;
}
