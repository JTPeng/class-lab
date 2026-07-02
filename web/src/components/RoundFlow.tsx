import { useState } from 'react'
import type { Sto } from '../types/lesson'
import SectionHeading from './poster/SectionHeading'

type RoundState = 'sd' | 'correct' | 'incorrect'

// 交互 1·回合流程演示：呈现 SD → 选择孩子的反应 → 展示对应后果/纠正 → 重置回合
// 数据收集/通过标准与静态版 ProcedureSection 一致，仅 SD/正确/错误分支是交互的
function RoundFlow({
  procedure,
  dataCollection,
  masteryCriteria,
}: {
  procedure: Sto['procedure']
  dataCollection: string
  masteryCriteria: string
}) {
  const [state, setState] = useState<RoundState>('sd')

  return (
    <section>
      <SectionHeading sub="DTT · 回合流程演示">教学流程（回合演示）</SectionHeading>

      {/* 屏幕上按 state 只展示当前分支；打印时三块通过 print:block 强制全部展开，
          还原 SD → 正确分支 → 错误分支 的完整教学流程，交互按钮统一 print:hidden 隐藏。 */}
      <div className="rounded-2xl bg-white p-6 shadow-card ring-1 ring-brand-100 sm:p-8">
        <div className={`${state === 'sd' ? '' : 'hidden'} print:block print:mb-6`}>
          <p className="inline-block rounded-full bg-brand-500 px-3 py-1 text-xs font-black uppercase tracking-wide text-white">
            SD · 指令
          </p>
          <p className="mt-4 text-lg leading-relaxed text-stone-800">{procedure.sd}</p>
          <div className="mt-6 flex flex-wrap gap-3 print:hidden">
            <button
              type="button"
              onClick={() => setState('correct')}
              className="rounded-full bg-emerald-500 px-6 py-2.5 text-sm font-bold text-white shadow-md transition hover:bg-emerald-600"
            >
              孩子正确
            </button>
            <button
              type="button"
              onClick={() => setState('incorrect')}
              className="rounded-full bg-rose-500 px-6 py-2.5 text-sm font-bold text-white shadow-md transition hover:bg-rose-600"
            >
              孩子错误
            </button>
          </div>
        </div>

        <div className={`${state === 'correct' ? '' : 'hidden'} print:block print:mb-6`}>
          <p className="inline-block rounded-full bg-emerald-500 px-3 py-1 text-xs font-black uppercase tracking-wide text-white">
            ✓ 正确反应
          </p>
          <p className="mt-4 text-lg leading-relaxed text-emerald-900">{procedure.correct.response}</p>
          <div className="mt-4 rounded-xl bg-emerald-50 p-4 ring-1 ring-emerald-200">
            <p className="text-xs font-black uppercase tracking-wide text-emerald-600">C+ 后果</p>
            <p className="mt-1 text-emerald-900">{procedure.correct.consequence}</p>
          </div>
          <button
            type="button"
            onClick={() => setState('sd')}
            className="mt-6 rounded-full bg-brand-500 px-6 py-2.5 text-sm font-bold text-white shadow-md transition hover:bg-brand-600 print:hidden"
          >
            再来一回合
          </button>
        </div>

        <div className={`${state === 'incorrect' ? '' : 'hidden'} print:block`}>
          <p className="inline-block rounded-full bg-rose-500 px-3 py-1 text-xs font-black uppercase tracking-wide text-white">
            ✕ 错误反应
          </p>
          <p className="mt-4 text-lg leading-relaxed text-rose-900">{procedure.incorrect.response}</p>
          <div className="mt-4 rounded-xl bg-rose-50 p-4 ring-1 ring-rose-200">
            <p className="text-xs font-black uppercase tracking-wide text-rose-600">C− 纠正</p>
            <p className="mt-1 text-rose-900">{procedure.incorrect.correction}</p>
          </div>
          <button
            type="button"
            onClick={() => setState('sd')}
            className="mt-6 rounded-full bg-brand-500 px-6 py-2.5 text-sm font-bold text-white shadow-md transition hover:bg-brand-600 print:hidden"
          >
            再来一回合
          </button>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border-l-4 border-brand-400 bg-white p-5 shadow-card ring-1 ring-brand-100">
          <p className="text-xs font-black uppercase tracking-wide text-brand-600">数据收集</p>
          <p className="mt-1 text-stone-700">{dataCollection}</p>
        </div>
        <div className="rounded-2xl border-l-4 border-brand-400 bg-white p-5 shadow-card ring-1 ring-brand-100">
          <p className="text-xs font-black uppercase tracking-wide text-brand-600">通过标准</p>
          <p className="mt-1 text-stone-700">{masteryCriteria}</p>
        </div>
      </div>
    </section>
  )
}

export default RoundFlow
