import type { VideoReportStats } from '../types/video'

// 奖励类型 → 固定颜色（按 AI 提示词里出现的常见类型排序，保证同类型跨报告颜色一致）；
// 未知类型落到最后一档灰蓝色兜底。
const TYPE_COLOR: Record<string, string> = {
  口头表扬: 'bg-blue-500',
  击掌: 'bg-teal-500',
  竖拇指: 'bg-amber-500',
  实物: 'bg-green-600',
  拥抱: 'bg-violet-500',
  无: 'bg-stone-300',
  未标注: 'bg-stone-300',
}
const FALLBACK_COLORS = ['bg-red-500', 'bg-pink-500', 'bg-orange-500']

// 奖励类型占比：横向条形图，按次数降序，直接在条上标注类型名 + 次数 + 占比。
function RewardBreakdownChart({ breakdown }: { breakdown: VideoReportStats['rewardBreakdown'] }) {
  if (breakdown.length === 0) {
    return <p className="text-sm text-stone-500">本节课各时段均未识别到明显的奖励动作。</p>
  }
  const total = breakdown.reduce((sum, b) => sum + b.count, 0)
  let fallbackIndex = 0
  return (
    <div className="space-y-2.5">
      {breakdown.map((b) => {
        const pct = total > 0 ? Math.round((b.count / total) * 100) : 0
        const color = TYPE_COLOR[b.type] ?? FALLBACK_COLORS[fallbackIndex++ % FALLBACK_COLORS.length]
        return (
          <div key={b.type}>
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="font-bold text-stone-700">{b.type}</span>
              <span className="text-stone-400">
                {b.count} 段 · {pct}%
              </span>
            </div>
            <div className="h-2.5 w-full rounded-full bg-stone-100 overflow-hidden">
              <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.max(pct, 3)}%` }} />
            </div>
          </div>
        )
      })}
    </div>
  )
}

// 指令响应率：单一比例，用同色系 track+fill 的「量表」样式呈现。
function InstructionResponseMeter({ total, responded }: { total: number; responded: number }) {
  if (total === 0) {
    return <p className="text-sm text-stone-500">本节课各时段均未识别到明显的指令下达。</p>
  }
  const pct = Math.round((responded / total) * 100)
  return (
    <div>
      <div className="flex items-center justify-between text-xs mb-1">
        <span className="font-bold text-stone-700">孩子响应</span>
        <span className="text-stone-400">
          {responded}/{total} 段 · {pct}%
        </span>
      </div>
      <div className="h-2.5 w-full rounded-full bg-stone-100 overflow-hidden">
        <div className="h-full rounded-full bg-blue-500" style={{ width: `${Math.max(pct, 3)}%` }} />
      </div>
    </div>
  )
}

function VideoStatsCharts({ stats }: { stats: VideoReportStats }) {
  return (
    <div className="bg-white p-6 rounded-2xl border-t-4 border-brand-400 shadow-card ring-1 ring-brand-100">
      <h2 className="text-lg font-extrabold text-stone-900 mb-1">行为统计</h2>
      <p className="text-xs text-stone-400 mb-4">按各时间窗的可见画面确定性统计，非模型主观评价</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        <div>
          <h3 className="text-sm font-bold text-stone-700 mb-3">奖励类型占比</h3>
          <RewardBreakdownChart breakdown={stats.rewardBreakdown} />
        </div>
        <div>
          <h3 className="text-sm font-bold text-stone-700 mb-3">指令响应率</h3>
          <InstructionResponseMeter total={stats.instructionTotal} responded={stats.instructionResponded} />
        </div>
      </div>
    </div>
  )
}

export default VideoStatsCharts
