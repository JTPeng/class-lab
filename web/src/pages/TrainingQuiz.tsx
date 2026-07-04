import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api, apiErrorMessage } from '../api/client'
import { useAuth } from '../auth/AuthContext'
import type { TrainingAttempt, TrainingQuestion } from '../types/training'

export default function TrainingQuiz() {
  const { id } = useParams<{ id: string }>()
  const { user } = useAuth()
  const [questions, setQuestions] = useState<TrainingQuestion[]>([])
  const [answers, setAnswers] = useState<number[][]>([])
  const [index, setIndex] = useState(0)
  const [result, setResult] = useState<TrainingAttempt | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!id) return
    api
      .getTrainingQuestions(id)
      .then((qs) => {
        setQuestions(qs)
        setAnswers(qs.map(() => []))
      })
      .catch((err) => setError(apiErrorMessage(err, '加载题目失败')))
      .finally(() => setLoading(false))
  }, [id])

  function toggleOption(qIndex: number, optionIndex: number, multi: boolean) {
    setAnswers((prev) => {
      const next = [...prev]
      const current = next[qIndex] ?? []
      next[qIndex] = multi
        ? current.includes(optionIndex)
          ? current.filter((v) => v !== optionIndex)
          : [...current, optionIndex]
        : [optionIndex]
      return next
    })
  }

  async function submit() {
    if (!id || !user) return
    setSubmitting(true)
    try {
      setResult(await api.submitTrainingAttempt(id, user.id, answers))
    } catch (err) {
      setError(apiErrorMessage(err, '提交失败'))
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return <div className="max-w-2xl mx-auto px-4 py-8 text-stone-500">加载中…</div>
  if (error) return <div className="max-w-2xl mx-auto px-4 py-8 text-red-500">{error}</div>

  if (result) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-6">
        <h1 className="text-xl font-black text-stone-900 mb-3">测评结果</h1>
        <p className="text-lg font-bold text-brand-600 mb-4">
          得分：{result.score} / {questions.length}
        </p>
        <p className="bg-brand-50 rounded-xl p-4 text-sm text-stone-700 whitespace-pre-wrap mb-4">{result.feedback}</p>
        <Link to={`/training/${id}`} className="text-sm text-stone-500 hover:underline">
          ← 返回主题
        </Link>
      </div>
    )
  }

  const q = questions[index]
  if (!q) return null
  const selected = answers[index] ?? []

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <p className="text-sm text-stone-500 mb-2">
        第 {index + 1} / {questions.length} 题 {q.type === 'multi' ? '（多选）' : '（单选）'}
      </p>
      <h2 className="font-bold text-stone-800 mb-3">{q.question}</h2>
      <div className="space-y-2 mb-6">
        {q.options.map((opt, i) => (
          <button
            key={i}
            onClick={() => toggleOption(index, i, q.type === 'multi')}
            className={
              selected.includes(i)
                ? 'w-full text-left px-4 py-2 rounded-xl bg-brand-500 text-white font-bold'
                : 'w-full text-left px-4 py-2 rounded-xl bg-white ring-1 ring-brand-100 text-stone-700'
            }
          >
            {opt}
          </button>
        ))}
      </div>
      <div className="flex items-center justify-between">
        <button
          disabled={index === 0}
          onClick={() => setIndex((i) => i - 1)}
          className="px-4 py-2 rounded-full font-bold text-stone-500 disabled:opacity-40"
        >
          上一题
        </button>
        {index < questions.length - 1 ? (
          <button
            onClick={() => setIndex((i) => i + 1)}
            className="px-5 py-2 rounded-full bg-brand-500 text-white font-bold shadow-soft"
          >
            下一题
          </button>
        ) : (
          <button
            disabled={submitting}
            onClick={submit}
            className="px-5 py-2 rounded-full bg-brand-500 text-white font-bold shadow-soft disabled:opacity-60"
          >
            {submitting ? '提交中…' : '交卷'}
          </button>
        )}
      </div>
    </div>
  )
}
