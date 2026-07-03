import { DIMENSION_META, type Rating, type VideoReport } from '../types/video'

// 好/一般/待加强 → 轨道上的位置与颜色（状态色，非分类色，与详情卡片评级徽章一致）。
const RATING_PCT: Record<Rating, number> = { 好: 100, 一般: 66, 待加强: 33 }
const RATING_FILL: Record<Rating, string> = { 好: 'bg-emerald-500', 一般: 'bg-amber-500', 待加强: 'bg-rose-500' }
const RATING_TEXT: Record<Rating, string> = { 好: 'text-emerald-700', 一般: 'text-amber-700', 待加强: 'text-rose-700' }

// 五维总览量表：每个维度一行，好/一般/待加强 映射到轨道 100%/66%/33% 位置，一眼看出哪几项是短板。
function DimensionOverview({ dimensions }: { dimensions: VideoReport['dimensions'] }) {
  return (
    <div className="space-y-3">
      {DIMENSION_META.map(({ key, label }) => {
        const { rating } = dimensions[key]
        return (
          <div key={key} className="flex items-center gap-3">
            <span className="w-20 shrink-0 text-sm font-bold text-stone-700">{label}</span>
            <div className="relative flex-1 h-2.5 rounded-full bg-stone-100 overflow-hidden">
              <div
                className={`h-full rounded-full ${RATING_FILL[rating]}`}
                style={{ width: `${RATING_PCT[rating]}%` }}
              />
            </div>
            <span className={`w-12 shrink-0 text-right text-xs font-bold ${RATING_TEXT[rating]}`}>{rating}</span>
          </div>
        )
      })}
    </div>
  )
}

export default DimensionOverview
