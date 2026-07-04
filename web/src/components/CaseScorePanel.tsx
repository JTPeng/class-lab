import { useEffect, useState } from 'react'
import { api, apiErrorMessage } from '../api/client'
import type { CaseRecord } from '../types/case'

// 绘本打卡 / 游戏乐园通用的「关联个案并打分」面板：教师可选择把这次打卡/这一局
// 关联到某个个案，并打配合度+进步印象两项分（1-5）。不选个案也不影响主流程。
function CaseScorePanel({
  userId,
  onSubmit,
}: {
  userId: string
  onSubmit: (input: { caseId: string; teacherCooperation: number; teacherProgress: number }) => Promise<void>
}) {
  const [cases, setCases] = useState<CaseRecord[]>([])
  const [caseId, setCaseId] = useState('')
  const [cooperation, setCooperation] = useState(3)
  const [progress, setProgress] = useState(3)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api
      .listCases(userId)
      .then(setCases)
      .catch(() => setCases([]))
  }, [userId])

  async function handleSubmit() {
    if (!caseId) return
    setSubmitting(true)
    setError(null)
    try {
      await onSubmit({ caseId, teacherCooperation: cooperation, teacherProgress: progress })
      setSubmitted(true)
    } catch (err) {
      setError(apiErrorMessage(err, '提交失败，请重试'))
    } finally {
      setSubmitting(false)
    }
  }

  if (submitted) {
    return (
      <div className="rounded-2xl border-l-4 border-emerald-400 bg-emerald-50 p-4 text-sm text-emerald-900">
        已关联个案并打分：配合度 {cooperation} 分 · 进步印象 {progress} 分
      </div>
    )
  }

  return (
    <div className="rounded-2xl bg-white p-4 shadow-card ring-1 ring-brand-100 space-y-3">
      <p className="text-sm font-bold text-stone-700">关联个案并打分（可选）</p>
      {cases.length === 0 ? (
        <p className="text-sm text-stone-500">暂无个案，可先在 DTT 模块建档</p>
      ) : (
        <>
          <select
            value={caseId}
            onChange={(e) => setCaseId(e.target.value)}
            className="w-full border border-stone-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          >
            <option value="">选择个案…</option>
            {cases.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <div>
            <label className="block text-xs font-medium text-stone-600 mb-1">配合度：{cooperation} 分</label>
            <input
              type="range"
              min={1}
              max={5}
              value={cooperation}
              onChange={(e) => setCooperation(Number(e.target.value))}
              disabled={submitting}
              className="w-full"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-stone-600 mb-1">阶段性进步印象：{progress} 分</label>
            <input
              type="range"
              min={1}
              max={5}
              value={progress}
              onChange={(e) => setProgress(Number(e.target.value))}
              disabled={submitting}
              className="w-full"
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting || !caseId}
            className="w-full rounded-full bg-brand-500 px-4 py-2 text-sm font-bold text-white shadow-md transition hover:bg-brand-600 disabled:opacity-50"
          >
            {submitting ? '提交中...' : '提交打分'}
          </button>
        </>
      )}
    </div>
  )
}

export default CaseScorePanel
