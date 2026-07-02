import { useEffect, useState, type ReactNode } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api } from '../api/client'
import type { Lesson } from '../types/lesson'

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="bg-white rounded-lg shadow-sm p-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-3">{title}</h2>
      {children}
    </section>
  )
}

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
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">加载中...</p>
      </div>
    )
  }

  if (error || !lesson) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <p className="text-red-600">{error ?? '未找到该教案'}</p>
        <Link to="/" className="text-purple-600 hover:underline">
          返回首页
        </Link>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 py-10 px-4">
      <div className="max-w-3xl mx-auto space-y-6">
        <Link to="/" className="text-sm text-purple-600 hover:underline">
          ← 返回首页
        </Link>

        <h1 className="text-3xl font-bold text-gray-900">{lesson.title}</h1>

        <Section title="长期目标">
          <p className="text-gray-800">{lesson.longTermGoal.description}</p>
          <p className="text-gray-600 mt-2">
            <span className="font-medium">通过标准：</span>
            {lesson.longTermGoal.passCriteria}
          </p>
        </Section>

        <Section title="阶段性目标">
          <ol className="space-y-3 list-decimal list-inside">
            {lesson.phases.map((phase, idx) => (
              <li key={idx}>
                <span className="font-medium text-gray-900">{phase.name}</span>
                <p className="text-gray-700 ml-1">{phase.description}</p>
              </li>
            ))}
          </ol>
        </Section>

        <Section title="短期教学目标（STO）">
          <div className="space-y-3 text-gray-800">
            <p>
              <span className="font-medium">教具：</span>
              {lesson.sto.teachingMaterials}
            </p>
            <div>
              <span className="font-medium">教学目标：</span>
              <ul className="list-disc list-inside ml-2">
                {lesson.sto.objectives.map((obj, idx) => (
                  <li key={idx}>{obj}</li>
                ))}
              </ul>
            </div>
            <p>
              <span className="font-medium">教学策略：</span>
              {lesson.sto.strategy}
            </p>
            <p>
              <span className="font-medium">强化计划：</span>
              {lesson.sto.reinforcementPlan}
            </p>

            <div className="border border-gray-200 rounded p-4 space-y-2">
              <p className="font-medium text-gray-900">教学流程（DTT）</p>
              <p>
                <span className="font-medium">SD（指令）：</span>
                {lesson.sto.procedure.sd}
              </p>
              <p>
                <span className="font-medium text-green-700">正确反应 → </span>
                {lesson.sto.procedure.correct.response}
                <span className="text-gray-600">
                  {' '}
                  ／ 后果：{lesson.sto.procedure.correct.consequence}
                </span>
              </p>
              <p>
                <span className="font-medium text-red-700">错误反应 → </span>
                {lesson.sto.procedure.incorrect.response}
                <span className="text-gray-600">
                  {' '}
                  ／ 纠正：{lesson.sto.procedure.incorrect.correction}
                </span>
              </p>
            </div>

            <p>
              <span className="font-medium">数据收集：</span>
              {lesson.sto.dataCollection}
            </p>
            <p>
              <span className="font-medium">通过标准：</span>
              {lesson.sto.masteryCriteria}
            </p>
          </div>
        </Section>

        <Section title="目标清单">
          <ul className="list-disc list-inside text-gray-800">
            {lesson.targetList.map((target, idx) => (
              <li key={idx}>{target.target}</li>
            ))}
          </ul>
        </Section>

        {lesson.sessionSuggestion && (
          <Section title="单次训练建议">
            <p className="text-gray-800">{lesson.sessionSuggestion}</p>
          </Section>
        )}
      </div>
    </div>
  )
}

export default LessonDetail
