import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api, apiErrorMessage } from '../api/client'
import { useAuth } from '../auth/AuthContext'
import { DIMENSION_META, type Rating, type VideoAnalysis } from '../types/video'
import { formatClock, phaseLabel, progressPercent } from '../lib/video'
import { downloadReportHtml, downloadReportPdf } from '../lib/videoReportExport'
import VideoStatsCharts from '../components/VideoStatsCharts'
import DimensionOverview from '../components/DimensionOverview'
import CaseLinkPanel from '../components/CaseLinkPanel'

const RATING_BADGE: Record<Rating, string> = {
  好: 'bg-emerald-100 text-emerald-700',
  一般: 'bg-amber-100 text-amber-700',
  待加强: 'bg-rose-100 text-rose-700',
}

// 维度详情卡片顶部描边按评级着色，让薄弱项在页面上视觉突出。
const RATING_BORDER: Record<Rating, string> = {
  好: 'border-emerald-400',
  一般: 'border-amber-400',
  待加强: 'border-rose-400',
}

function VideoAnalysisDetail() {
  const { user } = useAuth()
  const { id } = useParams<{ id: string }>()
  const [analysis, setAnalysis] = useState<VideoAnalysis | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [exportingPdf, setExportingPdf] = useState(false)
  const [activeClip, setActiveClip] = useState<{ url: string; time: string; text: string } | null>(null)

  const pollRef = useRef<number | null>(null)
  const reportRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!id) return

    function stopPolling() {
      if (pollRef.current !== null) {
        window.clearInterval(pollRef.current)
        pollRef.current = null
      }
    }

    async function load() {
      try {
        const a = await api.getVideoAnalysis(user!.id, id!)
        setAnalysis(a)
        setError(null)
        if (a.status !== 'processing') stopPolling()
      } catch (err) {
        stopPolling()
        setError(apiErrorMessage(err, '加载失败'))
      } finally {
        setLoading(false)
      }
    }

    load()
    pollRef.current = window.setInterval(load, 2000)
    return () => stopPolling()
  }, [id, user])

  useEffect(() => {
    if (!activeClip) return
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setActiveClip(null)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [activeClip])

  async function handleCopy(text: string) {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      setError('复制失败，请手动选择文本复制')
    }
  }

  function handleDownloadHtml() {
    if (!analysis) return
    downloadReportHtml(analysis, `视频分析报告-${analysis.id.slice(0, 8)}.html`)
  }

  async function handleDownloadPdf() {
    if (!analysis || !reportRef.current) return
    setExportingPdf(true)
    try {
      await downloadReportPdf(reportRef.current, `视频分析报告-${analysis.id.slice(0, 8)}.pdf`)
    } catch {
      setError('生成 PDF 失败，请重试')
    } finally {
      setExportingPdf(false)
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-brand-50">
        <p className="text-stone-500">加载中…</p>
      </div>
    )
  }

  if (error || !analysis) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-brand-50">
        <p className="text-rose-600">{error ?? '未找到该分析记录'}</p>
        <Link to="/video" className="text-brand-600 hover:underline">
          返回视频分析
        </Link>
      </div>
    )
  }

  const { report } = analysis

  return (
    <div className="min-h-screen bg-gradient-to-b from-brand-50 via-brand-100/60 to-brand-50 px-4 py-10">
      <div className="mx-auto max-w-4xl space-y-6">
        <Link to="/video" className="text-sm font-bold text-brand-600 hover:underline">
          ← 返回视频分析
        </Link>

        {/* 进行中 / 失败态 */}
        {analysis.status === 'processing' && (
          <div className="bg-white p-6 rounded-2xl border-t-4 border-brand-400 shadow-card ring-1 ring-brand-100">
            <div className="flex items-center justify-between text-sm mb-2">
              <span className="font-bold text-stone-700">{phaseLabel(analysis.progress)}</span>
              <span className="text-stone-400">{progressPercent(analysis.progress)}%</span>
            </div>
            <div className="h-2.5 w-full rounded-full bg-brand-100 overflow-hidden">
              <div
                className="h-full rounded-full bg-brand-500 transition-all duration-500"
                style={{ width: `${progressPercent(analysis.progress)}%` }}
              />
            </div>
            <p className="mt-3 text-sm text-stone-500">分析中，请稍候…</p>
          </div>
        )}

        {analysis.status === 'failed' && (
          <div className="bg-white p-6 rounded-2xl border-t-4 border-rose-400 shadow-card ring-1 ring-brand-100">
            <p className="text-rose-600">分析失败：{analysis.error ?? '未知错误'}</p>
          </div>
        )}

        {/* 报告 */}
        {analysis.status === 'done' && report && (
          <>
            {/* 下载工具条（不进入 PDF/HTML 截图范围） */}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={handleDownloadHtml}
                className="rounded-full bg-white ring-1 ring-brand-200 px-4 py-1.5 text-sm font-bold text-brand-700 shadow-card transition hover:bg-brand-50 active:scale-[0.97]"
              >
                下载 HTML
              </button>
              <button
                type="button"
                onClick={handleDownloadPdf}
                disabled={exportingPdf}
                className="rounded-full bg-white ring-1 ring-brand-200 px-4 py-1.5 text-sm font-bold text-brand-700 shadow-card transition hover:bg-brand-50 disabled:opacity-50 active:scale-[0.97]"
              >
                {exportingPdf ? '生成中…' : '下载 PDF'}
              </button>
            </div>

            <div ref={reportRef} className="space-y-6">
              {/* 摘要 */}
              <div className="bg-white p-6 rounded-2xl border-t-4 border-brand-400 shadow-card ring-1 ring-brand-100">
                <h1 className="text-2xl font-extrabold text-stone-900 mb-1">分析报告</h1>
                <p className="text-xs text-stone-400 mb-4">
                  时长 {formatClock(analysis.durationSec)}
                  {analysis.style && <> ・ 风格：{analysis.style}</>}
                </p>
                <p className="text-stone-700 leading-relaxed">{report.summary}</p>
                {report.tags.length > 0 && (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {report.tags.map((tag) => (
                      <span
                        key={tag}
                        className="inline-block rounded-full bg-brand-100 px-2.5 py-0.5 text-xs font-bold text-brand-700"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* 给老师/督导的话 */}
              {report.encouragement && (
                <div className="bg-amber-50 p-6 rounded-2xl border-t-4 border-amber-400 shadow-card ring-1 ring-amber-100">
                  <h2 className="text-base font-bold text-amber-800 mb-2">💛 给老师的话</h2>
                  <p className="text-stone-700 leading-relaxed">{report.encouragement}</p>
                </div>
              )}

              {/* 需人工确认 */}
              {report.needsReview && report.needsReview.length > 0 && (
                <div className="bg-white p-6 rounded-2xl border-t-4 border-amber-400 shadow-card ring-1 ring-amber-100">
                  <h2 className="text-base font-bold text-stone-900 mb-1">⚠️ 需人工确认</h2>
                  <p className="text-xs text-stone-400 mb-3">本版基于画面视觉分析，以下事项建议结合原视频音频复核</p>
                  <ul className="space-y-1.5 list-disc list-inside">
                    {report.needsReview.map((item, i) => (
                      <li key={i} className="text-sm text-stone-700 leading-relaxed">
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* 五维评价总览 */}
              <div className="bg-white p-6 rounded-2xl border-t-4 border-brand-400 shadow-card ring-1 ring-brand-100">
                <h2 className="text-lg font-bold text-stone-900 mb-4">五维评价总览</h2>
                <DimensionOverview dimensions={report.dimensions} />
              </div>

              {/* 五维评价详情 */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {DIMENSION_META.map(({ key, label }) => {
                  const dim = report.dimensions[key]
                  return (
                    <div
                      key={key}
                      className={`bg-white p-5 rounded-2xl border-t-4 shadow-card ring-1 ring-brand-100 ${RATING_BORDER[dim.rating]}`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="text-base font-bold text-stone-900">{label}</h3>
                        <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-bold ${RATING_BADGE[dim.rating]}`}>
                          {dim.rating}
                        </span>
                      </div>
                      <p className="text-sm text-stone-600 leading-relaxed">{dim.notes}</p>
                    </div>
                  )
                })}
              </div>

              {/* 行为统计图表 */}
              {report.stats && <VideoStatsCharts stats={report.stats} />}

              {/* 时间轴 */}
              {report.timeline.length > 0 && (
                <div className="bg-white p-6 rounded-2xl border-t-4 border-brand-400 shadow-card ring-1 ring-brand-100">
                  <h2 className="text-lg font-bold text-stone-900 mb-4">时间轴证据</h2>
                  <ul className="space-y-4">
                    {report.timeline.map((ev, i) => (
                      <li key={i} className="flex gap-3">
                        {ev.clipUrl && (
                          <button
                            type="button"
                            onClick={() => setActiveClip({ url: ev.clipUrl!, time: formatClock(ev.atSec), text: ev.text })}
                            className="group relative shrink-0 w-32 h-[72px] rounded-lg ring-1 ring-brand-100 bg-stone-900 overflow-hidden active:scale-[0.97] transition-transform"
                          >
                            <video src={ev.clipUrl} muted playsInline preload="metadata" className="w-full h-full object-cover" />
                            <span className="absolute inset-0 flex items-center justify-center bg-black/20 transition group-hover:bg-black/40">
                              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/90 text-brand-600 shadow-soft">
                                ▶
                              </span>
                            </span>
                          </button>
                        )}
                        <div>
                          <span className="inline-block rounded-full bg-brand-100 px-2.5 py-0.5 text-xs font-bold text-brand-700 mb-1">
                            {formatClock(ev.atSec)}
                          </span>
                          <p className="text-sm text-stone-700 leading-relaxed">{ev.text}</p>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* 报告草稿 */}
              <div className="bg-white p-6 rounded-2xl border-t-4 border-brand-400 shadow-card ring-1 ring-brand-100">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-bold text-stone-900">报告草稿</h2>
                  <button
                    type="button"
                    onClick={() => handleCopy(report.draft)}
                    className="rounded-full bg-brand-500 px-4 py-1.5 text-sm font-bold text-white shadow-soft transition hover:bg-brand-600 active:scale-[0.97]"
                  >
                    {copied ? '已复制 ✓' : '复制'}
                  </button>
                </div>
                <pre className="whitespace-pre-wrap font-sans text-sm text-stone-700 leading-relaxed">{report.draft}</pre>
              </div>
            </div>

            {user && (
              <CaseLinkPanel
                userId={user.id}
                onSubmit={(caseId) => api.linkVideoAnalysisCase(user.id, analysis.id, caseId)}
              />
            )}
          </>
        )}
      </div>

      {activeClip && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4"
          onClick={() => setActiveClip(null)}
        >
          <div className="w-full max-w-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-2 flex items-center justify-between text-white">
              <span className="text-sm font-bold">
                {activeClip.time} · {activeClip.text}
              </span>
              <button type="button" onClick={() => setActiveClip(null)} className="text-sm font-bold hover:text-brand-200 active:scale-[0.97] transition-transform">
                关闭 ✕
              </button>
            </div>
            <video src={activeClip.url} controls autoPlay playsInline className="w-full max-h-[75vh] rounded-lg bg-stone-900" />
          </div>
        </div>
      )}
    </div>
  )
}

export default VideoAnalysisDetail
