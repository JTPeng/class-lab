import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api, apiErrorMessage } from '../api/client'
import type { TrainingTopic } from '../types/training'

export default function TrainingTopicDetail() {
  const { id } = useParams<{ id: string }>()
  const [topic, setTopic] = useState<TrainingTopic | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!id) return
    api
      .getTrainingTopic(id)
      .then(setTopic)
      .catch((err) => setError(apiErrorMessage(err, '加载失败')))
  }, [id])

  if (error) return <div className="max-w-2xl mx-auto px-4 py-8 text-red-500">{error}</div>
  if (!topic) return <div className="max-w-2xl mx-auto px-4 py-8 text-stone-500">加载中…</div>

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <Link to="/training" className="text-sm text-stone-500 hover:underline">
        ← 返回列表
      </Link>
      <h1 className="text-xl font-extrabold text-stone-900 mt-2 mb-3">{topic.title}</h1>
      {topic.structuredContent && (
        <>
          <p className="bg-brand-50 rounded-xl p-3 text-sm text-stone-700 mb-4">{topic.structuredContent.summary}</p>
          <div className="space-y-4">
            {topic.structuredContent.sections.map((s, i) => (
              <div key={i}>
                <h3 className="font-bold text-stone-800 mb-1">{s.heading}</h3>
                <p className="text-sm text-stone-600 whitespace-pre-wrap">{s.body}</p>
              </div>
            ))}
          </div>
        </>
      )}
      <Link
        to={`/training/${topic.id}/quiz`}
        className="inline-block mt-6 px-5 py-2 rounded-full bg-brand-500 text-white font-bold shadow-soft active:scale-[0.98] transition-transform"
      >
        开始测评
      </Link>
    </div>
  )
}
