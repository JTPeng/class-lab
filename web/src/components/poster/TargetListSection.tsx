import type { Target } from '../../types/lesson'
import SectionHeading from './SectionHeading'

// 目标清单：一组编号卡片，低文字密度展示每个训练目标
function TargetListSection({ targets }: { targets: Target[] }) {
  return (
    <section>
      <SectionHeading sub="Target List">目标清单</SectionHeading>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3">
        {targets.map((target, idx) => (
          <div
            key={idx}
            className="flex items-center gap-3 rounded-2xl bg-white p-5 shadow-card ring-1 ring-brand-100 transition-all hover:-translate-y-0.5 hover:shadow-soft"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-500 text-base font-black text-white shadow-md">
              {idx + 1}
            </span>
            <p className="font-medium text-stone-800">{target.target}</p>
          </div>
        ))}
      </div>
    </section>
  )
}

export default TargetListSection
