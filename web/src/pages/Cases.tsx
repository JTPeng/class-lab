import { useEffect, useState, type FormEvent, type MouseEvent } from 'react'
import { Link } from 'react-router-dom'
import { api, apiErrorMessage } from '../api/client'
import { useAuth } from '../auth/AuthContext'
import type { CaseRecord } from '../types/case'

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

function Cases() {
  const { user } = useAuth()
  const [cases, setCases] = useState<CaseRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState('')
  const [baseline, setBaseline] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  useEffect(() => {
    api
      .listCases(user!.id)
      .then(setCases)
      .catch((err) => setError(apiErrorMessage(err, '加载失败')))
      .finally(() => setLoading(false))
  }, [user])

  async function handleCreate(e: FormEvent) {
    e.preventDefault()
    if (!name.trim()) {
      setFormError('请填写个案姓名/别称')
      return
    }
    setSubmitting(true)
    setFormError(null)
    try {
      const record = await api.createCase(user!.id, { name: name.trim(), baseline: baseline.trim(), targets: [] })
      setCases((prev) => [record, ...prev])
      setShowForm(false)
      setName('')
      setBaseline('')
    } catch (err) {
      setFormError(apiErrorMessage(err, '新建失败'))
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete(event: MouseEvent, id: string) {
    event.preventDefault()
    event.stopPropagation()
    if (!window.confirm('确定删除这个个案？该个案下的教案与执行记录也会一并删除。')) return
    setDeletingId(id)
    try {
      await api.deleteCaseRemote(user!.id, id)
      setCases((prev) => prev.filter((c) => c.id !== id))
    } catch (err) {
      alert(apiErrorMessage(err, '删除失败'))
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-brand-50 via-brand-100/60 to-brand-50 py-10 px-4">
      <div className="max-w-4xl lg:max-w-6xl xl:max-w-7xl mx-auto">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-8">
          <h1 className="flex items-center gap-2 text-2xl sm:text-3xl font-extrabold text-stone-900">
            <img src="/favicon.svg" alt="" className="w-8 h-8" />
            士多啤梨 <span className="text-brand-500">DTT</span> 个案
          </h1>
          <button
            type="button"
            onClick={() => setShowForm((v) => !v)}
            className="self-start bg-brand-500 text-white font-bold px-5 py-2.5 rounded-full shadow-soft hover:bg-brand-600 transition-colors active:scale-[0.98]"
          >
            ＋ 新建个案
          </button>
        </div>

        {showForm && (
          <form
            onSubmit={handleCreate}
            className="mb-8 space-y-4 bg-white p-6 rounded-2xl border-t-4 border-brand-400 shadow-card ring-1 ring-brand-100"
          >
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">
                姓名/别称 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={submitting}
                placeholder="例如：小明"
                className="w-full border border-stone-300 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500 disabled:bg-stone-100"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">能力评估基线（可选）</label>
              <textarea
                value={baseline}
                onChange={(e) => setBaseline(e.target.value)}
                disabled={submitting}
                rows={3}
                placeholder="例如：能理解简单指令，配对能力弱"
                className="w-full border border-stone-300 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500 disabled:bg-stone-100"
              />
            </div>
            {formError && <p className="text-sm text-red-600">{formError}</p>}
            <button
              type="submit"
              disabled={submitting}
              className="bg-brand-500 text-white font-medium px-5 py-2 rounded-xl hover:bg-brand-600 disabled:opacity-50 active:scale-[0.98]"
            >
              {submitting ? '创建中...' : '创建'}
            </button>
          </form>
        )}

        {loading && <p className="text-stone-500">加载中...</p>}
        {error && <p className="text-rose-600">{error}</p>}

        {!loading && !error && cases.length === 0 && <p className="text-stone-500">还没有个案，点击新建</p>}

        {!loading && !error && cases.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {cases.map((c) => (
              <Link
                key={c.id}
                to={`/cases/${c.id}`}
                className="relative block bg-white rounded-2xl border-t-4 border-brand-400 shadow-card ring-1 ring-brand-100 p-5 hover:-translate-y-0.5 hover:shadow-float transition-all duration-300 ease-bounce-soft"
              >
                <button
                  type="button"
                  onClick={(event) => handleDelete(event, c.id)}
                  disabled={deletingId === c.id}
                  className="absolute top-3 right-3 text-xs font-bold text-rose-500 bg-rose-50 hover:bg-rose-100 rounded-full px-2.5 py-1 transition-colors disabled:opacity-50 active:scale-[0.97]"
                >
                  {deletingId === c.id ? '删除中...' : '删除'}
                </button>
                <h2 className="text-lg font-bold text-stone-900 truncate pr-14">{c.name}</h2>
                {c.baseline && <p className="text-sm text-stone-600 mt-2 line-clamp-2">{c.baseline}</p>}
                <p className="text-xs text-stone-400 mt-3">{formatDate(c.createdAt)}</p>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default Cases
