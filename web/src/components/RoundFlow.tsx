import { useState, type FormEvent } from 'react'
import { api, apiErrorMessage } from '../api/client'
import type { Sto } from '../types/lesson'
import SectionHeading from './poster/SectionHeading'

type RoundState = 'sd' | 'correct' | 'incorrect'

// 交互 1·回合流程演示：呈现 SD → 选择孩子的反应 → 展示对应后果/纠正 → 重置回合
// 数据收集/通过标准与静态版 ProcedureSection 一致，仅 SD/正确/错误分支是交互的
function RoundFlow({
  procedure,
  dataCollection,
  masteryCriteria,
  caseId,
  lessonId,
}: {
  procedure: Sto['procedure']
  dataCollection: string
  masteryCriteria: string
  caseId?: string
  lessonId?: string
}) {
  const [state, setState] = useState<RoundState>('sd')
  const [correctCount, setCorrectCount] = useState(0)
  const [incorrectCount, setIncorrectCount] = useState(0)
  const [showScoreForm, setShowScoreForm] = useState(false)
  const [cooperation, setCooperation] = useState(3)
  const [progress, setProgress] = useState(3)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState(false)

  function handleCorrect() {
    setCorrectCount((n) => n + 1)
    setState('correct')
  }

  function handleIncorrect() {
    setIncorrectCount((n) => n + 1)
    setState('incorrect')
  }

  async function handleSubmitScore(e: FormEvent) {
    e.preventDefault()
    if (!caseId) return
    setSubmitting(true)
    setSubmitError(null)
    try {
      await api.createCaseSession(caseId, {
        lessonId: lessonId ?? null,
        trialsTotal: correctCount + incorrectCount,
        trialsCorrect: correctCount,
        teacherCooperation: cooperation,
        teacherProgress: progress,
      })
      setSubmitted(true)
      setShowScoreForm(false)
    } catch (err) {
      setSubmitError(apiErrorMessage(err, '提交失败，请重试'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section>
      <SectionHeading sub="DTT · 回合流程演示">教学流程（回合演示）</SectionHeading>

      {/* 屏幕上按 state 只展示当前分支；打印时三块通过 print:block 强制全部展开，
          还原 SD → 正确分支 → 错误分支 的完整教学流程，交互按钮统一 print:hidden 隐藏。 */}
      <div className="rounded-2xl bg-white p-6 shadow-card ring-1 ring-brand-100 sm:p-8">
        <div className={`${state === 'sd' ? '' : 'hidden'} print:block print:mb-6`}>
          <p className="inline-block rounded-full bg-brand-500 px-3 py-1 text-xs font-extrabold uppercase tracking-wide text-white">
            SD · 指令
          </p>
          <p className="mt-4 text-lg leading-relaxed text-stone-800">{procedure.sd}</p>
          <div className="mt-6 flex flex-wrap gap-3 print:hidden">
            <button
              type="button"
              onClick={handleCorrect}
              className="rounded-full bg-emerald-500 px-6 py-2.5 text-sm font-bold text-white shadow-md transition hover:bg-emerald-600 active:scale-[0.98]"
            >
              孩子正确
            </button>
            <button
              type="button"
              onClick={handleIncorrect}
              className="rounded-full bg-rose-500 px-6 py-2.5 text-sm font-bold text-white shadow-md transition hover:bg-rose-600 active:scale-[0.98]"
            >
              孩子错误
            </button>
          </div>
        </div>

        <div className={`${state === 'correct' ? '' : 'hidden'} print:block print:mb-6`}>
          <p className="inline-block rounded-full bg-emerald-500 px-3 py-1 text-xs font-extrabold uppercase tracking-wide text-white">
            ✓ 正确反应
          </p>
          <p className="mt-4 text-lg leading-relaxed text-emerald-900">{procedure.correct.response}</p>
          <div className="mt-4 rounded-xl bg-emerald-50 p-4 ring-1 ring-emerald-200">
            <p className="text-xs font-extrabold uppercase tracking-wide text-emerald-600">C+ 后果</p>
            <p className="mt-1 text-emerald-900">{procedure.correct.consequence}</p>
          </div>
          <button
            type="button"
            onClick={() => setState('sd')}
            className="mt-6 rounded-full bg-brand-500 px-6 py-2.5 text-sm font-bold text-white shadow-md transition hover:bg-brand-600 active:scale-[0.98] print:hidden"
          >
            再来一回合
          </button>
        </div>

        <div className={`${state === 'incorrect' ? '' : 'hidden'} print:block`}>
          <p className="inline-block rounded-full bg-rose-500 px-3 py-1 text-xs font-extrabold uppercase tracking-wide text-white">
            ✕ 错误反应
          </p>
          <p className="mt-4 text-lg leading-relaxed text-rose-900">{procedure.incorrect.response}</p>
          <div className="mt-4 rounded-xl bg-rose-50 p-4 ring-1 ring-rose-200">
            <p className="text-xs font-extrabold uppercase tracking-wide text-rose-600">C− 纠正</p>
            <p className="mt-1 text-rose-900">{procedure.incorrect.correction}</p>
          </div>
          <button
            type="button"
            onClick={() => setState('sd')}
            className="mt-6 rounded-full bg-brand-500 px-6 py-2.5 text-sm font-bold text-white shadow-md transition hover:bg-brand-600 active:scale-[0.98] print:hidden"
          >
            再来一回合
          </button>
        </div>
      </div>

      {caseId && (
        <div className="mt-4 print:hidden">
          {!submitted ? (
            <div className="rounded-2xl bg-white p-6 shadow-card ring-1 ring-brand-100">
              <p className="text-sm text-stone-600">
                本次已记录 <span className="font-bold text-emerald-600">{correctCount}</span> 次正确 /{' '}
                <span className="font-bold text-rose-600">{incorrectCount}</span> 次错误
              </p>
              {!showScoreForm ? (
                <button
                  type="button"
                  onClick={() => setShowScoreForm(true)}
                  disabled={correctCount + incorrectCount === 0}
                  className="mt-4 rounded-full bg-brand-500 px-6 py-2.5 text-sm font-bold text-white shadow-md transition hover:bg-brand-600 active:scale-[0.98] disabled:opacity-50"
                >
                  结束训练
                </button>
              ) : (
                <form onSubmit={handleSubmitScore} className="mt-4 space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-stone-700 mb-1">
                      配合度：{cooperation} 分
                    </label>
                    <input
                      type="range"
                      min={1}
                      max={5}
                      value={cooperation}
                      onChange={(e) => setCooperation(Number(e.target.value))}
                      disabled={submitting}
                      className="w-full"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-stone-700 mb-1">
                      阶段性进步印象：{progress} 分
                    </label>
                    <input
                      type="range"
                      min={1}
                      max={5}
                      value={progress}
                      onChange={(e) => setProgress(Number(e.target.value))}
                      disabled={submitting}
                      className="w-full"
                    />
                  </div>
                  {submitError && <p className="text-sm text-red-600">{submitError}</p>}
                  <div className="flex gap-2">
                    <button
                      type="submit"
                      disabled={submitting}
                      className="rounded-full bg-brand-500 px-6 py-2.5 text-sm font-bold text-white shadow-md transition hover:bg-brand-600 active:scale-[0.98] disabled:opacity-50"
                    >
                      {submitting ? '提交中...' : '提交打分'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowScoreForm(false)}
                      disabled={submitting}
                      className="rounded-full bg-stone-200 px-6 py-2.5 text-sm font-bold text-stone-800 hover:bg-stone-300 active:scale-[0.98]"
                    >
                      取消
                    </button>
                  </div>
                </form>
              )}
            </div>
          ) : (
            <div className="rounded-2xl border-l-4 border-emerald-400 bg-emerald-50 p-5 text-emerald-900">
              本次训练记录已提交。
            </div>
          )}
        </div>
      )}

      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border-l-4 border-brand-400 bg-white p-5 shadow-card ring-1 ring-brand-100">
          <p className="text-xs font-extrabold uppercase tracking-wide text-brand-600">数据收集</p>
          <p className="mt-1 text-stone-700">{dataCollection}</p>
        </div>
        <div className="rounded-2xl border-l-4 border-brand-400 bg-white p-5 shadow-card ring-1 ring-brand-100">
          <p className="text-xs font-extrabold uppercase tracking-wide text-brand-600">通过标准</p>
          <p className="mt-1 text-stone-700">{masteryCriteria}</p>
        </div>
      </div>
    </section>
  )
}

export default RoundFlow
