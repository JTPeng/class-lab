import { useEffect, useRef, useState, type MouseEvent } from 'react'
import { Link } from 'react-router-dom'
import { api, apiErrorMessage } from '../api/client'
import { useAuth } from '../auth/AuthContext'
import {
  DEFAULT_REPORT_STYLE,
  REPORT_STYLES,
  type ReportStyle,
  type VideoAnalysis as VideoAnalysisType,
  type VideoAnalysisListItem,
} from '../types/video'
import { formatClock, phaseLabel, progressPercent } from '../lib/video'

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

// 历史卡片上的状态徽章配色。
const STATUS_BADGE: Record<VideoAnalysisType['status'], { text: string; className: string }> = {
  processing: { text: '分析中', className: 'bg-amber-100 text-amber-700' },
  done: { text: '已完成', className: 'bg-emerald-100 text-emerald-700' },
  failed: { text: '失败', className: 'bg-rose-100 text-rose-700' },
}

// 报告卡片以创建时间的「日期 时:分:秒」命名。
function formatDateTimeName(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

// 报告风格的简短说明，帮助老师选择。
const STYLE_HINT: Record<ReportStyle, string> = {
  专业督导版: '术语规范、循证客观，适合教研督导存档',
  温和家长版: '语气温暖通俗，适合发给家长',
  简洁要点版: '要点罗列，适合快速浏览',
}

function VideoAnalysis() {
  const { user } = useAuth()
  const [tab, setTab] = useState<'file' | 'url'>('file')
  const [file, setFile] = useState<File | null>(null)
  const [url, setUrl] = useState('')
  const [style, setStyle] = useState<ReportStyle>(DEFAULT_REPORT_STYLE)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [job, setJob] = useState<VideoAnalysisType | null>(null) // 进行中/刚完成的任务

  const [list, setList] = useState<VideoAnalysisListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const pollRef = useRef<number | null>(null)

  function refreshList() {
    return api
      .listVideoAnalyses(user!.id)
      .then(setList)
      .catch((err) => setError(apiErrorMessage(err, '加载历史失败')))
  }

  useEffect(() => {
    refreshList().finally(() => setLoading(false))
    return () => stopPolling()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function stopPolling() {
    if (pollRef.current !== null) {
      window.clearInterval(pollRef.current)
      pollRef.current = null
    }
  }

  function startPolling(id: string) {
    stopPolling()
    const tick = async () => {
      try {
        const j = await api.getVideoJob(user!.id, id)
        setJob(j)
        if (j.status === 'done' || j.status === 'failed') {
          stopPolling()
          refreshList()
        }
      } catch (err) {
        stopPolling()
        setError(apiErrorMessage(err, '轮询任务失败'))
      }
    }
    tick()
    pollRef.current = window.setInterval(tick, 2000)
  }

  async function handleSubmit() {
    setError(null)
    if (tab === 'file' && !file) {
      setError('请选择视频文件')
      return
    }
    if (tab === 'url' && !url.trim()) {
      setError('请粘贴视频链接')
      return
    }
    setSubmitting(true)
    try {
      const { id } =
        tab === 'file'
          ? await api.createVideoAnalysisFromFile(user!.id, file!, style)
          : await api.createVideoAnalysisFromUrl(user!.id, url.trim(), style)
      setFile(null)
      setUrl('')
      startPolling(id)
    } catch (err) {
      setError(apiErrorMessage(err, '提交失败，请重试'))
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete(event: MouseEvent, id: string) {
    event.preventDefault()
    event.stopPropagation()
    if (!window.confirm('确定删除这条分析记录？')) return
    setDeletingId(id)
    try {
      await api.deleteVideoAnalysis(user!.id, id)
      setList((prev) => prev.filter((item) => item.id !== id))
    } catch (err) {
      setError(apiErrorMessage(err, '删除失败'))
    } finally {
      setDeletingId(null)
    }
  }

  const tabClass = (active: boolean) =>
    active
      ? 'px-4 py-1.5 rounded-full text-sm font-bold bg-brand-500 text-white shadow-soft transition-colors'
      : 'px-4 py-1.5 rounded-full text-sm font-bold text-stone-600 hover:bg-brand-100 transition-colors'

  return (
    <div className="min-h-screen bg-gradient-to-b from-brand-50 via-brand-100/60 to-brand-50 py-10 px-4">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-black text-stone-900 mb-2">
          🎬 视频<span className="text-brand-500">分析</span>
        </h1>
        <p className="text-stone-600 mb-8">
          上传或粘贴一段几秒到 50 分钟的课堂视频，AI 从孩子表现、老师表现、及时奖励、配合意愿、听指令五个维度生成报告草稿。
        </p>

        {/* 上传卡 */}
        <div className="bg-white p-6 rounded-2xl border-t-4 border-brand-400 shadow-card ring-1 ring-brand-100">
          <div className="flex gap-1 mb-5">
            <button type="button" onClick={() => setTab('file')} className={tabClass(tab === 'file')}>
              上传文件
            </button>
            <button type="button" onClick={() => setTab('url')} className={tabClass(tab === 'url')}>
              视频链接
            </button>
          </div>

          {tab === 'file' ? (
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">选择本地视频文件</label>
              <input
                type="file"
                accept="video/*"
                disabled={submitting}
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                className="block w-full text-sm text-stone-600 file:mr-3 file:rounded-full file:border-0 file:bg-brand-100 file:px-4 file:py-2 file:text-sm file:font-bold file:text-brand-700 hover:file:bg-brand-200 disabled:opacity-50"
              />
              {file && <p className="mt-2 text-sm text-stone-500">已选择：{file.name}</p>}
            </div>
          ) : (
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">视频链接</label>
              <input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                disabled={submitting}
                placeholder="https://…/class.mp4"
                className="w-full border border-stone-300 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500 disabled:bg-stone-100"
              />
            </div>
          )}

          <div className="mt-5">
            <label className="block text-sm font-medium text-stone-700 mb-1.5">报告风格</label>
            <div className="flex flex-wrap gap-2">
              {REPORT_STYLES.map((s) => (
                <button
                  key={s}
                  type="button"
                  disabled={submitting}
                  onClick={() => setStyle(s)}
                  className={
                    style === s
                      ? 'px-3.5 py-1.5 rounded-full text-sm font-bold bg-brand-500 text-white shadow-soft transition-colors disabled:opacity-50'
                      : 'px-3.5 py-1.5 rounded-full text-sm font-bold text-stone-600 bg-stone-100 hover:bg-brand-100 transition-colors disabled:opacity-50'
                  }
                >
                  {s}
                </button>
              ))}
            </div>
            <p className="mt-1.5 text-xs text-stone-400">{STYLE_HINT[style]}</p>
          </div>

          {error && <p className="mt-3 text-sm text-rose-600">{error}</p>}

          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting}
            className="mt-5 bg-brand-500 text-white font-bold px-5 py-2.5 rounded-full shadow-soft hover:bg-brand-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? '提交中…' : tab === 'file' ? '开始分析' : '解析链接'}
          </button>

          {/* 进度区 */}
          {job && (
            <div className="mt-6 border-t border-brand-100 pt-5">
              {job.status === 'processing' && (
                <div>
                  <div className="flex items-center justify-between text-sm mb-2">
                    <span className="font-bold text-stone-700">{phaseLabel(job.progress)}</span>
                    <span className="text-stone-400">{progressPercent(job.progress)}%</span>
                  </div>
                  <div className="h-2.5 w-full rounded-full bg-brand-100 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-brand-500 transition-all duration-500"
                      style={{ width: `${progressPercent(job.progress)}%` }}
                    />
                  </div>
                </div>
              )}
              {job.status === 'done' && (
                <p className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2">
                  分析完成！
                  <Link to={`/video/${job.id}`} className="ml-1 font-bold text-brand-600 hover:underline">
                    查看报告 →
                  </Link>
                </p>
              )}
              {job.status === 'failed' && (
                <p className="text-sm text-rose-600 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2">
                  分析失败：{job.error ?? '未知错误'}
                </p>
              )}
            </div>
          )}
        </div>

        {/* 历史列表 */}
        <h2 className="text-xl font-black text-stone-900 mt-10 mb-4">历史分析</h2>
        {loading && <p className="text-stone-500">加载中…</p>}
        {!loading && list.length === 0 && <p className="text-stone-500">还没有分析记录，上传一段课堂视频试试吧。</p>}

        {!loading && list.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {list.map((item) => {
              const badge = STATUS_BADGE[item.status]
              return (
                <Link
                  key={item.id}
                  to={`/video/${item.id}`}
                  className="relative block bg-white rounded-2xl border-t-4 border-brand-400 shadow-card ring-1 ring-brand-100 p-5 hover:shadow-soft hover:-translate-y-1 transition-all"
                >
                  <button
                    type="button"
                    onClick={(event) => handleDelete(event, item.id)}
                    disabled={deletingId === item.id}
                    className="absolute top-3 right-3 text-xs font-bold text-rose-500 bg-rose-50 hover:bg-rose-100 rounded-full px-2.5 py-1 transition-colors disabled:opacity-50"
                  >
                    {deletingId === item.id ? '删除中…' : '删除'}
                  </button>
                  <div className="text-3xl mb-3">{item.source.type === 'upload' ? '📁' : '🔗'}</div>
                  <h3 className="text-base font-black text-stone-900 truncate pr-12">{formatDateTimeName(item.createdAt)}</h3>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-bold ${badge.className}`}>
                      {badge.text}
                    </span>
                    <span className="inline-block rounded-full bg-brand-100 px-2.5 py-0.5 text-xs font-bold text-brand-700">
                      时长 {formatClock(item.durationSec)}
                    </span>
                  </div>
                  <p className="text-xs text-stone-400 mt-3">{formatDate(item.createdAt)}</p>
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

export default VideoAnalysis
