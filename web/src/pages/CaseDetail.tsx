import { useEffect, useState, type FormEvent, type MouseEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api, apiErrorMessage, type PictureBookRecordDto } from '../api/client'
import { useAuth } from '../auth/AuthContext'
import { QrImage } from '../components/PictureCard'
import type { CaseRecord, CaseSessionRecord, GameSessionRecord } from '../types/case'
import type { LessonListItem } from '../types/lesson'

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

// 执行记录正确率趋势：Tailwind 纯色柱状图，风格与 GameHistoryChart 一致。
function SessionChart({ sessions }: { sessions: CaseSessionRecord[] }) {
  if (sessions.length === 0) return null
  const ordered = [...sessions].reverse()
  const rates = ordered.map((s) => (s.trialsTotal > 0 ? s.trialsCorrect / s.trialsTotal : 0))

  return (
    <div className="bg-white rounded-2xl shadow-card ring-1 ring-brand-100 p-5">
      <h3 className="text-sm font-bold text-stone-700 mb-3">正确率趋势（最近 {ordered.length} 次）</h3>
      <div className="flex items-end gap-1.5 h-28 border-b border-stone-200">
        {ordered.map((s, i) => (
          <div
            key={s.id}
            className="flex-1 flex flex-col items-center justify-end h-full min-w-0"
            title={`${formatDate(s.createdAt)} · ${s.trialsCorrect}/${s.trialsTotal}`}
          >
            <span className="text-[10px] font-bold text-stone-500 tabular-nums mb-1">
              {Math.round(rates[i] * 100)}%
            </span>
            <div
              className="w-full rounded-t-[4px] bg-brand-400"
              style={{ height: `${Math.max(rates[i] * 100, 6)}%` }}
            />
          </div>
        ))}
      </div>
    </div>
  )
}

// 「家长分享」二维码弹层：用后端返回的局域网 IP + 当前页面端口拼分享链接，与绘本模块一致。
function ShareModal({ shareToken, onClose }: { shareToken: string; onClose: () => void }) {
  const [shareUrl, setShareUrl] = useState<string | null | undefined>(undefined)

  useEffect(() => {
    api
      .getLanIp()
      .then(({ ip }) => {
        if (!ip) {
          setShareUrl(null)
          return
        }
        const port = window.location.port ? `:${window.location.port}` : ''
        setShareUrl(`${window.location.protocol}//${ip}${port}/share/${shareToken}`)
      })
      .catch(() => setShareUrl(null))
  }, [shareToken])

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-stone-900/40 backdrop-blur-sm px-4"
      onClick={onClose}
    >
      <div
        className="flex flex-col items-center gap-4 bg-white rounded-2xl border-t-4 border-brand-400 shadow-soft p-6 text-center"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-black text-stone-900">家长/督导分享</h3>
        {shareUrl ? (
          <>
            <QrImage text={shareUrl} size={200} />
            <p className="text-sm text-stone-500 break-all">{shareUrl}</p>
          </>
        ) : (
          <p className="text-sm text-stone-500">{shareUrl === undefined ? '获取地址中…' : '未检测到局域网地址'}</p>
        )}
        <button onClick={onClose} className="text-sm font-bold text-brand-600 hover:underline">
          关闭
        </button>
      </div>
    </div>
  )
}

// 教师打分展示：配合度/进步印象缺失时（未打分）不显示。
function TeacherScoreLine({
  cooperation,
  progress,
}: {
  cooperation: number | null | undefined
  progress: number | null | undefined
}) {
  if (cooperation == null || progress == null) return null
  return (
    <p className="text-xs text-brand-700 mt-2">
      配合度 {cooperation} 分 · 进步印象 {progress} 分
    </p>
  )
}

function CaseDetail() {
  const { user } = useAuth()
  const { caseId } = useParams<{ caseId: string }>()

  const [record, setRecord] = useState<CaseRecord | null>(null)
  const [lessons, setLessons] = useState<LessonListItem[]>([])
  const [sessions, setSessions] = useState<CaseSessionRecord[]>([])
  const [insight, setInsight] = useState<string | null>(null)
  const [pictureBooks, setPictureBooks] = useState<PictureBookRecordDto[]>([])
  const [gameSessions, setGameSessions] = useState<GameSessionRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [deletingLessonId, setDeletingLessonId] = useState<string | null>(null)
  const [showShare, setShowShare] = useState(false)

  const [editing, setEditing] = useState(false)
  const [name, setName] = useState('')
  const [baseline, setBaseline] = useState('')
  const [savingEdit, setSavingEdit] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)

  useEffect(() => {
    if (!caseId) return
    setLoading(true)
    setError(null)
    Promise.all([
      api.getCase(user!.id, caseId),
      api.listLessons(caseId),
      api.listCaseSessions(caseId),
      api.listCasePictureBooks(caseId),
      api.listCaseGameSessions(caseId),
    ])
      .then(([caseRecord, lessonList, sessionResult, pictureBookList, gameSessionList]) => {
        setRecord(caseRecord)
        setName(caseRecord.name)
        setBaseline(caseRecord.baseline)
        setLessons(lessonList)
        setSessions(sessionResult.sessions)
        setInsight(sessionResult.insight)
        setPictureBooks(pictureBookList)
        setGameSessions(gameSessionList)
      })
      .catch((err) => setError(apiErrorMessage(err, '加载失败')))
      .finally(() => setLoading(false))
  }, [caseId, user])

  async function handleDeleteLesson(event: MouseEvent, id: string) {
    event.preventDefault()
    event.stopPropagation()
    if (!caseId) return
    if (!window.confirm('确定删除这份教案？')) return
    setDeletingLessonId(id)
    try {
      await api.deleteLesson(caseId, id)
      setLessons((prev) => prev.filter((lesson) => lesson.id !== id))
    } catch (err) {
      alert(apiErrorMessage(err, '删除失败'))
    } finally {
      setDeletingLessonId(null)
    }
  }

  async function handleSaveEdit(e: FormEvent) {
    e.preventDefault()
    if (!caseId || !name.trim()) {
      setEditError('请填写姓名/别称')
      return
    }
    setSavingEdit(true)
    setEditError(null)
    try {
      const updated = await api.updateCase(user!.id, caseId, { name: name.trim(), baseline: baseline.trim() })
      setRecord(updated)
      setEditing(false)
    } catch (err) {
      setEditError(apiErrorMessage(err, '保存失败'))
    } finally {
      setSavingEdit(false)
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-brand-50">
        <p className="text-stone-500">加载中...</p>
      </div>
    )
  }

  if (error || !record || !caseId) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-brand-50">
        <p className="text-rose-600">{error ?? '未找到该个案'}</p>
        <Link to="/" className="text-brand-600 hover:underline">
          返回列表
        </Link>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-brand-50 via-brand-100/60 to-brand-50 py-10 px-4">
      <div className="max-w-4xl lg:max-w-6xl mx-auto space-y-8">
        <Link to="/" className="text-sm font-bold text-brand-600 hover:underline">
          ← 返回个案列表
        </Link>

        <div className="bg-white rounded-2xl border-t-4 border-brand-400 shadow-card ring-1 ring-brand-100 p-6">
          {!editing ? (
            <div className="flex items-start justify-between gap-4">
              <div>
                <h1 className="text-2xl font-black text-stone-900">{record.name}</h1>
                {record.baseline && <p className="text-stone-600 mt-2">{record.baseline}</p>}
              </div>
              <div className="flex gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setShowShare(true)}
                  className="px-4 py-2 rounded-xl bg-stone-200 text-stone-800 hover:bg-stone-300 text-sm font-bold"
                >
                  家长分享
                </button>
                <button
                  type="button"
                  onClick={() => setEditing(true)}
                  className="px-4 py-2 rounded-xl bg-stone-200 text-stone-800 hover:bg-stone-300 text-sm font-bold"
                >
                  编辑
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSaveEdit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1">姓名/别称</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={savingEdit}
                  className="w-full border border-stone-300 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500 disabled:bg-stone-100"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1">能力评估基线</label>
                <textarea
                  value={baseline}
                  onChange={(e) => setBaseline(e.target.value)}
                  disabled={savingEdit}
                  rows={3}
                  className="w-full border border-stone-300 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500 disabled:bg-stone-100"
                />
              </div>
              {editError && <p className="text-sm text-red-600">{editError}</p>}
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={savingEdit}
                  className="bg-brand-500 text-white font-medium px-5 py-2 rounded-xl hover:bg-brand-600 disabled:opacity-50"
                >
                  {savingEdit ? '保存中...' : '保存'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEditing(false)
                    setName(record.name)
                    setBaseline(record.baseline)
                    setEditError(null)
                  }}
                  disabled={savingEdit}
                  className="px-5 py-2 rounded-xl bg-stone-200 text-stone-800 hover:bg-stone-300"
                >
                  取消
                </button>
              </div>
            </form>
          )}
        </div>

        {insight && (
          <div className="rounded-2xl border-l-4 border-amber-400 bg-amber-50 p-5 text-amber-900">{insight}</div>
        )}

        <SessionChart sessions={sessions} />

        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-black text-stone-900">教案</h2>
            <Link
              to={`/cases/${caseId}/new`}
              className="bg-brand-500 text-white font-bold px-5 py-2.5 rounded-full shadow-soft hover:bg-brand-600 transition-colors"
            >
              ＋ 新建教案
            </Link>
          </div>

          {lessons.length === 0 && (
            <p className="text-stone-500">
              还没有教案，
              <Link to={`/cases/${caseId}/new`} className="text-brand-600 hover:underline">
                点击新建
              </Link>
            </p>
          )}

          {lessons.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {lessons.map((lesson) => (
                <Link
                  key={lesson.id}
                  to={`/cases/${caseId}/lessons/${lesson.id}`}
                  className="relative block bg-white rounded-2xl border-t-4 border-brand-400 shadow-card ring-1 ring-brand-100 p-5 hover:shadow-soft hover:-translate-y-1 transition-all"
                >
                  <button
                    type="button"
                    onClick={(event) => handleDeleteLesson(event, lesson.id)}
                    disabled={deletingLessonId === lesson.id}
                    className="absolute top-3 right-3 text-xs font-bold text-rose-500 bg-rose-50 hover:bg-rose-100 rounded-full px-2.5 py-1 transition-colors disabled:opacity-50"
                  >
                    {deletingLessonId === lesson.id ? '删除中...' : '删除'}
                  </button>
                  {lesson.coverUrl ? (
                    <img
                      src={lesson.coverUrl}
                      alt={lesson.title}
                      className="w-full h-36 object-cover rounded-xl mb-4"
                    />
                  ) : (
                    <div className="w-full h-36 rounded-xl mb-4 bg-brand-50" />
                  )}
                  <h3 className="text-lg font-black text-stone-900 truncate pr-14">{lesson.title}</h3>
                  <p className="text-sm text-stone-600 mt-2">
                    <span className="inline-block rounded-full bg-brand-100 px-2.5 py-0.5 text-xs font-bold text-brand-700">
                      {lesson.skill}
                    </span>
                  </p>
                  <p className="text-xs text-stone-400 mt-3">{formatDate(lesson.createdAt)}</p>
                </Link>
              ))}
            </div>
          )}
        </div>

        <div>
          <h2 className="text-xl font-black text-stone-900 mb-4">绘本打卡记录</h2>
          {pictureBooks.length === 0 ? (
            <p className="text-stone-500">还没有关联的绘本打卡记录</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {pictureBooks.map((book) => (
                <div
                  key={book.id}
                  className="bg-white rounded-2xl border-t-4 border-brand-400 shadow-card ring-1 ring-brand-100 p-5"
                >
                  <h3 className="text-lg font-black text-stone-900 truncate">{book.title}</h3>
                  <p className="text-xs text-stone-400 mt-1">{formatDate(book.createdAt)}</p>
                  <TeacherScoreLine cooperation={book.teacherCooperation} progress={book.teacherProgress} />
                </div>
              ))}
            </div>
          )}
        </div>

        <div>
          <h2 className="text-xl font-black text-stone-900 mb-4">游戏记录</h2>
          {gameSessions.length === 0 ? (
            <p className="text-stone-500">还没有关联的游戏记录</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {gameSessions.map((session) => (
                <div
                  key={session.id}
                  className="bg-white rounded-2xl border-t-4 border-brand-400 shadow-card ring-1 ring-brand-100 p-5"
                >
                  <h3 className="text-lg font-black text-stone-900 truncate">
                    {session.gameId} · 第 {session.level} 关
                  </h3>
                  <p className="text-sm text-stone-600 mt-1">得分 {session.score}</p>
                  <p className="text-xs text-stone-400 mt-1">{formatDate(session.createdAt)}</p>
                  <TeacherScoreLine cooperation={session.teacherCooperation} progress={session.teacherProgress} />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {showShare && <ShareModal shareToken={record.shareToken} onClose={() => setShowShare(false)} />}
    </div>
  )
}

export default CaseDetail
