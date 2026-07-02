// 通用徽章 / chip：用于「通过标准」「教学场景」等一句话强调信息
type BadgeProps = {
  label: string
  value: string
  tone?: 'light' | 'brand'
}

function Badge({ label, value, tone = 'light' }: BadgeProps) {
  const toneClass =
    tone === 'light'
      ? 'bg-white/15 text-white ring-1 ring-inset ring-white/30'
      : 'bg-brand-100 text-brand-700 ring-1 ring-inset ring-brand-200'

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-medium ${toneClass}`}>
      <span className="font-semibold opacity-90">{label}</span>
      <span>{value}</span>
    </span>
  )
}

export default Badge
