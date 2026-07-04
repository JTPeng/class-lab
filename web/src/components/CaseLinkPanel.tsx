import { useEffect, useState } from 'react'
import { api, apiErrorMessage } from '../api/client'
import type { CaseRecord } from '../types/case'

// 视频分析关联个案面板：五维评级本身即打分，这里只需选择个案，无需额外手动打分。
function CaseLinkPanel({
  userId,
  onSubmit,
}: {
  userId: string
  onSubmit: (caseId: string) => Promise<void>
}) {
  const [cases, setCases] = useState<CaseRecord[]>([])
  const [caseId, setCaseId] = useState('')
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
      await onSubmit(caseId)
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
        已关联到个案：{cases.find((c) => c.id === caseId)?.name ?? caseId}
      </div>
    )
  }

  return (
    <div className="rounded-2xl bg-white p-4 shadow-card ring-1 ring-brand-100 space-y-3">
      <p className="text-sm font-bold text-stone-700">关联个案（可选）</p>
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
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting || !caseId}
            className="w-full rounded-full bg-brand-500 px-4 py-2 text-sm font-bold text-white shadow-md transition hover:bg-brand-600 disabled:opacity-50"
          >
            {submitting ? '提交中...' : '关联到个案'}
          </button>
        </>
      )}
    </div>
  )
}

export default CaseLinkPanel
