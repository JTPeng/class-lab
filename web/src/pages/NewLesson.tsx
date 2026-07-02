import { useState, type FormEvent } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { api } from '../api/client'
import type { LessonInput } from '../types/lesson'

const CONTEXT_OPTIONS: LessonInput['context'][] = ['机构', '居家', '机构/居家']

function NewLesson() {
  const navigate = useNavigate()

  const [skill, setSkill] = useState('')
  const [availableTools, setAvailableTools] = useState<string[]>([])
  const [toolInput, setToolInput] = useState('')
  const [context, setContext] = useState<LessonInput['context']>('机构')
  const [reinforcerPref, setReinforcerPref] = useState('')
  const [sessionMinutes, setSessionMinutes] = useState('')

  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function addTool() {
    const value = toolInput.trim()
    if (!value) return
    if (availableTools.includes(value)) {
      setToolInput('')
      return
    }
    setAvailableTools([...availableTools, value])
    setToolInput('')
  }

  function removeTool(value: string) {
    setAvailableTools(availableTools.filter((t) => t !== value))
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!skill.trim()) {
      setError('请填写目标技能')
      return
    }

    const input: LessonInput = {
      skill: skill.trim(),
      availableTools,
      context,
      ...(reinforcerPref.trim() ? { reinforcerPref: reinforcerPref.trim() } : {}),
      ...(sessionMinutes.trim() ? { sessionMinutes: Number(sessionMinutes) } : {}),
    }

    setSubmitting(true)
    setError(null)
    try {
      const lesson = await api.generateLesson(input)
      navigate('/lessons/' + lesson.id)
    } catch (err) {
      setError(err instanceof Error ? err.message : '生成失败，请重试')
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-cream py-10 px-4">
      <div className="max-w-2xl mx-auto">
        <Link to="/" className="text-sm text-brand-600 hover:underline">
          ← 返回首页
        </Link>
        <h1 className="text-2xl font-bold text-stone-900 mt-2 mb-6">新建教案</h1>

        <form onSubmit={handleSubmit} className="space-y-6 bg-white p-6 rounded-2xl shadow-card ring-1 ring-stone-100">
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">
              目标技能 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={skill}
              onChange={(e) => setSkill(e.target.value)}
              disabled={submitting}
              required
              placeholder="例如：认识颜色"
              className="w-full border border-stone-300 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500 disabled:bg-stone-100"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">可用教具</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={toolInput}
                onChange={(e) => setToolInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    addTool()
                  }
                }}
                disabled={submitting}
                placeholder="例如：卡片、积木"
                className="flex-1 border border-stone-300 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500 disabled:bg-stone-100"
              />
              <button
                type="button"
                onClick={addTool}
                disabled={submitting}
                className="px-4 py-2 rounded-xl bg-stone-200 text-stone-800 hover:bg-stone-300 disabled:opacity-50"
              >
                添加
              </button>
            </div>
            {availableTools.length > 0 && (
              <ul className="flex flex-wrap gap-2 mt-3">
                {availableTools.map((tool) => (
                  <li
                    key={tool}
                    className="flex items-center gap-1 bg-brand-100 text-brand-800 text-sm px-3 py-1 rounded-full"
                  >
                    {tool}
                    <button
                      type="button"
                      onClick={() => removeTool(tool)}
                      disabled={submitting}
                      aria-label={`移除 ${tool}`}
                      className="text-brand-600 hover:text-brand-900 disabled:opacity-50"
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">教学场景</label>
            <select
              value={context}
              onChange={(e) => setContext(e.target.value as LessonInput['context'])}
              disabled={submitting}
              className="w-full border border-stone-300 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500 disabled:bg-stone-100"
            >
              {CONTEXT_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">强化物偏好（可选）</label>
            <input
              type="text"
              value={reinforcerPref}
              onChange={(e) => setReinforcerPref(e.target.value)}
              disabled={submitting}
              placeholder="例如：小饼干、贴纸"
              className="w-full border border-stone-300 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500 disabled:bg-stone-100"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">单次时长（分钟，可选）</label>
            <input
              type="number"
              min={1}
              value={sessionMinutes}
              onChange={(e) => setSessionMinutes(e.target.value)}
              disabled={submitting}
              placeholder="例如：20"
              className="w-full border border-stone-300 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500 disabled:bg-stone-100"
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          {submitting && (
            <p className="text-sm text-brand-700 bg-brand-50 border border-brand-200 rounded-xl px-3 py-2">
              AI 生成中，请稍候（约需 30-60 秒）...
            </p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-brand-500 text-white font-medium py-2 rounded-xl hover:bg-brand-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? '生成中...' : '生成教案'}
          </button>
        </form>
      </div>
    </div>
  )
}

export default NewLesson
