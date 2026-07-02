import type { ReactNode } from 'react'
import type { Sto } from '../../types/lesson'
import SectionHeading from './SectionHeading'

function InfoCard({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="rounded-2xl bg-white p-5 shadow-card ring-1 ring-stone-100">
      <p className="text-xs font-bold uppercase tracking-wide text-brand-600">{label}</p>
      <div className="mt-2 text-stone-800">{children}</div>
    </div>
  )
}

// 短期教学目标 STO 分区色块：教具 / 教学目标 / 策略 / 强化计划
function StoSection({ sto }: { sto: Sto }) {
  return (
    <section>
      <SectionHeading sub="STO · Short-Term Objective">短期教学目标</SectionHeading>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <InfoCard label="教具">
          <p>{sto.teachingMaterials}</p>
        </InfoCard>
        <InfoCard label="教学策略">
          <p>{sto.strategy}</p>
        </InfoCard>
        <InfoCard label="教学目标">
          <ul className="list-inside list-disc space-y-1">
            {sto.objectives.map((obj, idx) => (
              <li key={idx}>{obj}</li>
            ))}
          </ul>
        </InfoCard>
        <InfoCard label="强化计划">
          <p>{sto.reinforcementPlan}</p>
        </InfoCard>
      </div>
    </section>
  )
}

export default StoSection
