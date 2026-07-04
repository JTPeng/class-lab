import type { ReactNode } from 'react'

// 分区大字重标题，左侧橙色竖条 + 大字号，统一各区块的海报感
function SectionHeading({ children, sub }: { children: ReactNode; sub?: string }) {
  return (
    <div className="mb-6 flex items-start gap-3">
      <span className="mt-1.5 h-8 w-1.5 shrink-0 rounded-full bg-brand-500" />
      <div>
        <h2 className="text-3xl font-extrabold tracking-tight text-stone-900 sm:text-4xl">{children}</h2>
        {sub && (
          <p className="mt-1 text-xs font-bold uppercase tracking-[0.15em] text-brand-500">{sub}</p>
        )}
      </div>
    </div>
  )
}

export default SectionHeading
