// 视频分析页面共用的展示工具：进度阶段中文文案、进度百分比、时钟格式化。

import type { VideoAnalysis } from '../types/video'

const PHASE_LABEL: Record<string, string> = {
  created: '已创建',
  downloading: '下载中',
  extracting: '抽帧中',
  reducing: '汇总中',
  done: '完成',
  failed: '失败',
}

// 阶段中文文案；analyzing 阶段带上「第 k/N 段」。
export function phaseLabel(progress: VideoAnalysis['progress']): string {
  if (progress.phase === 'analyzing') {
    return `分析第 ${progress.windowDone}/${progress.windowTotal} 段`
  }
  return PHASE_LABEL[progress.phase] ?? progress.phase
}

// 粗略进度百分比（仅用于进度条观感，非精确）。
export function progressPercent(progress: VideoAnalysis['progress']): number {
  switch (progress.phase) {
    case 'created':
      return 5
    case 'downloading':
      return 12
    case 'extracting':
      return 20
    case 'analyzing': {
      const ratio = progress.windowTotal > 0 ? progress.windowDone / progress.windowTotal : 0
      return Math.round(20 + ratio * 60) // 20% → 80%
    }
    case 'reducing':
      return 90
    case 'done':
      return 100
    default:
      return 0
  }
}

// 秒 → mm:ss，用于时长与时间轴。
export function formatClock(totalSec: number): string {
  const s = Math.max(0, Math.round(totalSec))
  const m = Math.floor(s / 60)
  const rem = s % 60
  return `${m}:${String(rem).padStart(2, '0')}`
}
