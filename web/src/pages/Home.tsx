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
    <div className="min-h-screen bg-gray-50 py-10 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Class-Lab DTT 教案工具</h1>
          <Link
            to="/new"
            className="bg-purple-600 text-white font-medium px-4 py-2 rounded hover:bg-purple-700"
          >
            ＋ 新建教案
          </Link>
        </div>

        {loading && <p className="text-gray-500">加载中...</p>}
        {error && <p className="text-red-600">{error}</p>}

        {!loading && !error && lessons.length === 0 && (
          <p className="text-gray-500">
            还没有教案，
            <Link to="/new" className="text-purple-600 hover:underline">
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
                className="bg-white rounded-lg shadow-sm p-4 hover:shadow-md transition-shadow"
              >
                <h2 className="font-semibold text-gray-900 truncate">{lesson.title}</h2>
                <p className="text-sm text-gray-600 mt-1">技能：{lesson.skill}</p>
                <p className="text-xs text-gray-400 mt-2">{formatDate(lesson.createdAt)}</p>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default Home
