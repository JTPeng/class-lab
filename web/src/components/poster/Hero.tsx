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
    <div className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-brand-400 via-brand-500 to-brand-600 px-7 py-12 shadow-soft sm:px-12 sm:py-16">
      <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-white/15" />
      <div className="pointer-events-none absolute -bottom-16 left-1/4 h-52 w-52 rounded-full bg-white/10" />
      <div className="pointer-events-none absolute right-1/4 top-1/2 h-24 w-24 rounded-full bg-brand-300/40" />

      <div className="relative">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-white/80">教案详情 · 长期目标</p>
        <h1 className="mt-3 text-4xl font-extrabold leading-tight text-white drop-shadow-sm sm:text-6xl">
          {title}
        </h1>
        <p className="mt-5 max-w-3xl text-xl font-bold leading-snug text-white/95 sm:text-2xl">
          {goalDescription}
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Badge label="通过标准" value={passCriteria} tone="solid" />
          <Badge label="教学场景" value={context} tone="outline" />
        </div>
      </div>
    </div>
  )
}

export default Hero
