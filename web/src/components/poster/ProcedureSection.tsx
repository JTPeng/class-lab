import type { Sto } from '../../types/lesson'
import SectionHeading from './SectionHeading'

// 程序（DTT 回合）：SD / 正确(绿) / 错误(玫红) 三张色块卡，静态展示
// 交互版「回合流程演示」是后续切片，这里先做好素材呈现
function ProcedureSection({ procedure, dataCollection, masteryCriteria }: {
  procedure: Sto['procedure']
  dataCollection: string
  masteryCriteria: string
}) {
  return (
    <section>
      <SectionHeading sub="DTT · Discrete Trial Teaching">教学流程（程序）</SectionHeading>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border-t-4 border-brand-400 bg-white p-6 shadow-card ring-1 ring-brand-100">
          <p className="inline-block rounded-full bg-brand-500 px-3 py-1 text-xs font-black uppercase tracking-wide text-white">
            SD · 指令
          </p>
          <p className="mt-3 leading-relaxed text-stone-800">{procedure.sd}</p>
        </div>
        <div className="rounded-2xl border-t-4 border-emerald-500 bg-emerald-50 p-6 shadow-card ring-1 ring-emerald-200">
          <p className="inline-block rounded-full bg-emerald-500 px-3 py-1 text-xs font-black uppercase tracking-wide text-white">
            ✓ 正确反应
          </p>
          <p className="mt-3 leading-relaxed text-emerald-900">{procedure.correct.response}</p>
          <p className="mt-3 text-sm text-emerald-800">
            <span className="font-bold">后果：</span>
            {procedure.correct.consequence}
          </p>
        </div>
        <div className="rounded-2xl border-t-4 border-rose-500 bg-rose-50 p-6 shadow-card ring-1 ring-rose-200">
          <p className="inline-block rounded-full bg-rose-500 px-3 py-1 text-xs font-black uppercase tracking-wide text-white">
            ✕ 错误反应
          </p>
          <p className="mt-3 leading-relaxed text-rose-900">{procedure.incorrect.response}</p>
          <p className="mt-3 text-sm text-rose-800">
            <span className="font-bold">纠正：</span>
            {procedure.incorrect.correction}
          </p>
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

export default ProcedureSection
