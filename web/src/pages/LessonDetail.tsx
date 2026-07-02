import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api } from '../api/client'
import type { Lesson } from '../types/lesson'
import Hero from '../components/poster/Hero'
import PhaseTimeline from '../components/poster/PhaseTimeline'
import StoSection from '../components/poster/StoSection'
import RoundFlow from '../components/RoundFlow'
import TargetCarousel from '../components/TargetCarousel'
import SessionNote from '../components/poster/SessionNote'

function LessonDetail() {
  const { id } = useParams<{ id: string }>()
  const [lesson, setLesson] = useState<Lesson | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    setLoading(true)
    setError(null)
    api
      .getLesson(id)
      .then(setLesson)
      .catch((err) => setError(err instanceof Error ? err.message : '加载失败'))
      .finally(() => setLoading(false))
  }, [id])

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-brand-50">
        <p className="text-stone-500">加载中...</p>
      </div>
    )
  }

  if (error || !lesson) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-brand-50">
        <p className="text-rose-600">{error ?? '未找到该教案'}</p>
        <Link to="/" className="text-brand-600 hover:underline">
          返回首页
        </Link>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-brand-50 via-brand-100/60 to-brand-50 px-4 py-10">
      <div className="mx-auto max-w-4xl space-y-10">
        <Link to="/" className="text-sm font-bold text-brand-600 hover:underline">
          ← 返回首页
        </Link>

        <Hero
          title={lesson.title}
          goalDescription={lesson.longTermGoal.description}
          passCriteria={lesson.longTermGoal.passCriteria}
          context={lesson.input.context}
        />

        <PhaseTimeline phases={lesson.phases} />

        <StoSection sto={lesson.sto} />

        <RoundFlow
          procedure={lesson.sto.procedure}
          dataCollection={lesson.sto.dataCollection}
          masteryCriteria={lesson.sto.masteryCriteria}
        />

        <TargetCarousel targets={lesson.targetList} images={lesson.images} />

        {lesson.sessionSuggestion && <SessionNote text={lesson.sessionSuggestion} />}
      </div>
    </div>
  )
}

export default LessonDetail
