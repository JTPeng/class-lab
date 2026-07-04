import { useEffect, useState, type FormEvent } from 'react'
import { useParams } from 'react-router-dom'
import { api, apiErrorMessage } from '../api/client'
import type { CaseRecord, CaseSessionRecord, GuardianDifficulty } from '../types/case'

function formatDate(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

const DIFFICULTY_OPTIONS: { value: GuardianDifficulty; label: string }[] = [
  { value: 'too_easy', label: '偏易' },
  { value: 'just_right', label: '刚好' },
  { value: 'too_hard', label: '偏难' },
]

// 单条执行记录：已有家长反馈只展示结果，否则展示反馈表单。
function SessionCard({
  shareToken,
  session,
  onSubmitted,
}: {
  shareToken: string
  session: CaseSessionRecord
  onSubmitted: (updated: CaseSessionRecord) => void
}) {
  const [difficulty, setDifficulty] = useState<GuardianDifficulty>('just_right')
  const [interest, setInterest] = useState(3)
  const [comment, setComment] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      await api.submitGuardianFeedback(shareToken, session.id, {
        difficulty,
        interest,
        comment: comment.trim() || null,
      })
      onSubmitted({
        ...session,
        guardianDifficulty: difficulty,
        guardianInterest: interest,
        guardianComment: comment.trim() || null,
        guardianFeedbackAt: new Date().toISOString(),
      })
    } catch (err) {
      setError(apiErrorMessage(err, '提交失败，请重试'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="bg-white rounded-2xl border-t-4 border-brand-400 shadow-card ring-1 ring-brand-100 p-5">
      <div className="flex items-center justify-between">
        <p className="text-sm text-stone-500">{formatDate(session.createdAt)}</p>
        <p className="text-sm font-bold text-brand-700">
          {session.trialsCorrect}/{session.trialsTotal} 正确
        </p>
      </div>

      {session.guardianFeedbackAt ? (
        <div className="mt-3 text-sm text-stone-600">
          <p>
            难度反馈：{DIFFICULTY_OPTIONS.find((o) => o.value === session.guardianDifficulty)?.label} · 兴趣投入度：
            {session.guardianInterest} 分
          </p>
          {session.guardianComment && <p className="mt-1">留言：{session.guardianComment}</p>}
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">这次训练难度如何？</label>
            <div className="flex gap-2">
              {DIFFICULTY_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setDifficulty(opt.value)}
                  disabled={submitting}
                  className={
                    difficulty === opt.value
                      ? 'px-4 py-1.5 rounded-full text-sm font-bold bg-brand-500 text-white active:scale-[0.97]'
                      : 'px-4 py-1.5 rounded-full text-sm font-bold bg-brand-100 text-brand-700 hover:bg-brand-200 active:scale-[0.97]'
                  }
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">孩子的兴趣投入度：{interest} 分</label>
            <input
              type="range"
              min={1}
              max={5}
              value={interest}
              onChange={(e) => setInterest(Number(e.target.value))}
              disabled={submitting}
              className="w-full"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">留言（可选）</label>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              disabled={submitting}
              rows={2}
              className="w-full border border-stone-300 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500 disabled:bg-stone-100"
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={submitting}
            className="bg-brand-500 text-white font-medium px-5 py-2 rounded-xl hover:bg-brand-600 disabled:opacity-50 active:scale-[0.98]"
          >
            {submitting ? '提交中...' : '提交反馈'}
          </button>
        </form>
      )}
    </div>
  )
}

function GuardianView() {
  const { shareToken } = useParams<{ shareToken: string }>()
  const [caseInfo, setCaseInfo] = useState<Pick<CaseRecord, 'name' | 'baseline' | 'targets'> | null>(null)
  const [sessions, setSessions] = useState<CaseSessionRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!shareToken) return
    api
      .getShareView(shareToken)
      .then(({ case: c, sessions: s }) => {
        setCaseInfo(c)
        setSessions(s)
      })
      .catch((err) => setError(apiErrorMessage(err, '加载失败')))
      .finally(() => setLoading(false))
  }, [shareToken])

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-brand-50">
        <p className="text-stone-500">加载中...</p>
      </div>
    )
  }

  if (error || !caseInfo || !shareToken) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-brand-50">
        <p className="text-rose-600">{error ?? '未找到该分享链接'}</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-brand-50 via-brand-100/60 to-brand-50 py-10 px-4">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="bg-white rounded-2xl border-t-4 border-brand-400 shadow-card ring-1 ring-brand-100 p-6">
          <h1 className="text-2xl font-extrabold text-stone-900">{caseInfo.name}</h1>
          {caseInfo.baseline && <p className="text-stone-600 mt-2">{caseInfo.baseline}</p>}
        </div>

        <h2 className="text-xl font-bold text-stone-900">训练记录</h2>

        {sessions.length === 0 && <p className="text-stone-500">还没有训练记录</p>}

        <div className="space-y-4">
          {sessions.map((session) => (
            <SessionCard
              key={session.id}
              shareToken={shareToken}
              session={session}
              onSubmitted={(updated) =>
                setSessions((prev) => prev.map((s) => (s.id === updated.id ? updated : s)))
              }
            />
          ))}
        </div>
      </div>
    </div>
  )
}

export default GuardianView
