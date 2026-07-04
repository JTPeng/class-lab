import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api, apiErrorMessage } from '../api/client'
import type { TrainingTopic } from '../types/training'

export default function TrainingTopics() {
  const [topics, setTopics] = useState<TrainingTopic[]>([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api
      .listTrainingTopics()
      .then(setTopics)
      .catch((err) => setError(apiErrorMessage(err, '加载失败')))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="max-w-4xl mx-auto px-4 py-8 text-stone-500">加载中…</div>
  if (error) return <div className="max-w-4xl mx-auto px-4 py-8 text-red-500">{error}</div>

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <h1 className="text-xl font-black text-stone-900 mb-4">培训学习</h1>
      <div className="grid gap-3">
        {topics.map((t) => (
          <Link
            key={t.id}
            to={`/training/${t.id}`}
            className="bg-white rounded-2xl shadow-card ring-1 ring-brand-100 p-4 hover:bg-brand-50 transition-colors"
          >
            <h2 className="font-bold text-stone-800">{t.title}</h2>
            {t.structuredContent && (
              <p className="text-sm text-stone-500 mt-1 line-clamp-2">{t.structuredContent.summary}</p>
            )}
          </Link>
        ))}
      </div>
    </div>
  )
}
