import type { Phase } from '../../types/lesson'
import SectionHeading from './SectionHeading'

// 阶段目标：阶段一 → 阶段二 → ... 的横向时间轴（窄屏自动堆叠）
function PhaseTimeline({ phases }: { phases: Phase[] }) {
  return (
    <section>
      <SectionHeading sub="Phases">阶段性目标</SectionHeading>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-stretch sm:gap-3">
        {phases.map((phase, idx) => (
          <div key={idx} className="flex flex-1 items-stretch gap-3">
            <div className="flex-1 rounded-2xl border-t-4 border-brand-400 bg-brand-50 p-5 shadow-card ring-1 ring-brand-200">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-brand-500 text-base font-black text-white shadow-md">
                {idx + 1}
              </span>
              <p className="mt-3 text-lg font-black text-stone-900">{phase.name}</p>
              <p className="mt-1 text-sm text-stone-600">{phase.description}</p>
            </div>
            {idx < phases.length - 1 && (
              <span className="hidden self-center text-3xl font-black text-brand-400 sm:inline">→</span>
            )}
          </div>
        ))}
      </div>
    </section>
  )
}

export default PhaseTimeline
