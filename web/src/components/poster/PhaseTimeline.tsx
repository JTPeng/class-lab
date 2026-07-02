import type { Phase } from '../../types/lesson'
import SectionHeading from './SectionHeading'

// 阶段目标：阶段一 → 阶段二 → ... 的横向时间轴（窄屏自动堆叠）
function PhaseTimeline({ phases }: { phases: Phase[] }) {
  return (
    <section>
      <SectionHeading>阶段性目标</SectionHeading>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-stretch sm:gap-3">
        {phases.map((phase, idx) => (
          <div key={idx} className="flex flex-1 items-stretch gap-3">
            <div className="flex-1 rounded-2xl bg-white p-5 shadow-card ring-1 ring-brand-100">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-brand-500 text-sm font-bold text-white">
                {idx + 1}
              </span>
              <p className="mt-3 font-bold text-stone-900">{phase.name}</p>
              <p className="mt-1 text-sm text-stone-600">{phase.description}</p>
            </div>
            {idx < phases.length - 1 && (
              <span className="hidden self-center text-2xl font-bold text-brand-300 sm:inline">→</span>
            )}
          </div>
        ))}
      </div>
    </section>
  )
}

export default PhaseTimeline
