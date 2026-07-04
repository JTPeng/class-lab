import type { GameRecord } from '../games/storage'

// 单局战绩趋势：单一指标（分数）按时间顺序排列的柱状图，同色系单色即可，无需图例。
// 数值只直接标在「末局」和「最高分」两根柱上，其余靠 hover 提示，避免每根柱子都堆数字。
function GameHistoryChart({ records }: { records: GameRecord[] }) {
  if (records.length === 0) {
    return (
      <div className="bg-white rounded-2xl shadow-card ring-1 ring-brand-100 p-5 mt-6">
        <h3 className="text-sm font-bold text-stone-700 mb-1">历史成绩</h3>
        <p className="text-xs text-stone-400">完成第一关后，这里会显示每局的分数趋势</p>
      </div>
    )
  }

  const scores = records.map((r) => r.score)
  const max = Math.max(...scores, 1)
  const bestIndex = scores.lastIndexOf(Math.max(...scores))
  const lastIndex = records.length - 1
  const avg = Math.round(scores.reduce((sum, s) => sum + s, 0) / scores.length)

  return (
    <div className="bg-white rounded-2xl shadow-card ring-1 ring-brand-100 p-5 mt-6">
      <h3 className="text-sm font-bold text-stone-700 mb-3">历史成绩（最近 {records.length} 局）</h3>
      <div className="flex items-end gap-1.5 h-28 border-b border-stone-200">
        {records.map((r, i) => {
          const showLabel = i === bestIndex || i === lastIndex
          return (
            <div
              key={r.timestamp}
              className="flex-1 flex flex-col items-center justify-end h-full min-w-0"
              title={`第 ${r.level} 关 · ${r.score} 分 · ${formatTime(r.timestamp)}`}
            >
              {showLabel && (
                <span className="text-[10px] font-bold text-stone-500 tabular-nums mb-1">{r.score}</span>
              )}
              <div
                className="w-full rounded-t-[4px] bg-brand-400"
                style={{ height: `${Math.max((r.score / max) * 100, 6)}%` }}
              />
            </div>
          )
        })}
      </div>
      <p className="text-[11px] text-stone-400 mt-2 tabular-nums">
        共 {records.length} 局 · 最高 {Math.max(...scores)} 分 · 平均 {avg} 分
      </p>
    </div>
  )
}

function formatTime(ts: number): string {
  const d = new Date(ts)
  return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`
}

export default GameHistoryChart
