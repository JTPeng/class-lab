import type { ReactNode } from 'react'

// 分区大字重标题，统一各区块的海报感字号
function SectionHeading({ children, sub }: { children: ReactNode; sub?: string }) {
  return (
    <div className="mb-5">
      <h2 className="text-2xl sm:text-3xl font-extrabold text-stone-900">{children}</h2>
      {sub && <p className="mt-1 text-sm text-stone-500">{sub}</p>}
    </div>
  )
}

export default SectionHeading
