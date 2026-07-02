import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api/client'
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

function Home() {
  const [lessons, setLessons] = useState<LessonListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api
      .listLessons()
      .then(setLessons)
      .catch((err) => setError(err instanceof Error ? err.message : '加载失败'))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="min-h-screen bg-gradient-to-b from-brand-50 via-brand-100/60 to-brand-50 py-10 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-black text-stone-900">
            Class-Lab <span className="text-brand-500">DTT</span> 教案工具
          </h1>
          <Link
            to="/new"
            className="bg-brand-500 text-white font-bold px-5 py-2.5 rounded-full shadow-soft hover:bg-brand-600 transition-colors"
          >
            ＋ 新建教案
          </Link>
        </div>

        {loading && <p className="text-stone-500">加载中...</p>}
        {error && <p className="text-rose-600">{error}</p>}

        {!loading && !error && lessons.length === 0 && (
          <p className="text-stone-500">
            还没有教案，
            <Link to="/new" className="text-brand-600 hover:underline">
              点击新建
            </Link>
          </p>
        )}

        {!loading && !error && lessons.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {lessons.map((lesson) => (
              <Link
                key={lesson.id}
                to={`/lessons/${lesson.id}`}
                className="bg-white rounded-2xl border-t-4 border-brand-400 shadow-card ring-1 ring-brand-100 p-5 hover:shadow-soft hover:-translate-y-1 transition-all"
              >
                <h2 className="text-lg font-black text-stone-900 truncate">{lesson.title}</h2>
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
    </div>
  )
}

export default Home
