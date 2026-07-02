// 通用徽章 / chip：用于「通过标准」「教学场景」等一句话强调信息
type BadgeProps = {
  label: string
  value: string
  tone?: 'solid' | 'outline'
}

function Badge({ label, value, tone = 'solid' }: BadgeProps) {
  const toneClass =
    tone === 'solid'
      ? 'bg-white text-brand-700 shadow-md'
      : 'bg-brand-400/30 text-white ring-2 ring-inset ring-white/70'

  return (
    <span className={`inline-flex items-center gap-2 rounded-full px-5 py-2 text-sm font-semibold ${toneClass}`}>
      <span className={tone === 'solid' ? 'text-brand-500' : 'text-brand-50'}>{label}</span>
      <span className="font-bold">{value}</span>
    </span>
  )
}

export default Badge
