import Badge from './Badge'

// Hero 长期目标：教案标题 + 长期目标作为海报大标语 + 通过标准/教学场景徽章
type HeroProps = {
  title: string
  goalDescription: string
  passCriteria: string
  context: string
}

function Hero({ title, goalDescription, passCriteria, context }: HeroProps) {
  return (
    <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-brand-500 to-brand-600 px-6 py-10 shadow-soft sm:px-10 sm:py-12">
      <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-white/10" />
      <div className="pointer-events-none absolute -bottom-10 left-1/3 h-40 w-40 rounded-full bg-white/10" />

      <div className="relative">
        <p className="text-xs font-bold uppercase tracking-widest text-brand-100">教案详情 · 长期目标</p>
        <h1 className="mt-2 text-3xl font-extrabold text-white sm:text-4xl">{title}</h1>
        <p className="mt-4 max-w-3xl text-xl font-semibold leading-snug text-brand-50 sm:text-2xl">
          {goalDescription}
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Badge label="通过标准" value={passCriteria} tone="light" />
          <Badge label="教学场景" value={context} tone="light" />
        </div>
      </div>
    </div>
  )
}

export default Hero
