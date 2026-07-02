import { useState } from 'react'
import type { Target, Image } from '../types/lesson'
import SectionHeading from './poster/SectionHeading'
import Lightbox from './Lightbox'

// 图片尚未生成（Slice 4 才接入 qwen-image），refKey 约定未最终确定，
// 因此按 index 优先匹配 `target:${idx}`，再退化为 refKey/目标文本互相包含的宽松匹配。
function findImageForTarget(target: Target, idx: number, images: Image[]): Image | undefined {
  const byIndex = images.find((img) => img.refKey === `target:${idx}`)
  if (byIndex) return byIndex
  return images.find(
    (img) => target.target && (img.refKey.includes(target.target) || target.target.includes(img.refKey)),
  )
}

// 交互 2·图卡轮播：左右切换目标，命中真实图片可点击放大，否则显示占位/加载态
function TargetCarousel({ targets, images }: { targets: Target[]; images: Image[] }) {
  const [active, setActive] = useState(0)
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null)

  if (targets.length === 0) return null

  const total = targets.length
  const goPrev = () => setActive((i) => (i - 1 + total) % total)
  const goNext = () => setActive((i) => (i + 1) % total)

  const target = targets[active]
  const image = findImageForTarget(target, active, images)
  const hasImage = image?.status === 'done' && !!image.url
  const isPending = image?.status === 'pending'

  return (
    <section>
      <SectionHeading sub="Target List · 图卡轮播">目标清单</SectionHeading>

      <div className="rounded-2xl bg-white p-6 shadow-card ring-1 ring-brand-100 sm:p-8">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={goPrev}
            aria-label="上一个目标"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-100 text-lg font-black text-brand-600 transition hover:bg-brand-200"
          >
            ‹
          </button>

          <div className="flex-1">
            <div
              className={`relative mx-auto flex aspect-[4/3] w-full max-w-sm items-center justify-center overflow-hidden rounded-xl ${
                hasImage ? 'cursor-pointer bg-stone-100' : 'border-2 border-dashed border-brand-200 bg-brand-50'
              }`}
              onClick={() => hasImage && image?.url && setLightboxUrl(image.url)}
            >
              {hasImage && image?.url ? (
                <img src={image.url} alt={target.target} className="h-full w-full object-cover" />
              ) : isPending ? (
                <div className="flex h-full w-full animate-pulse flex-col items-center justify-center gap-2 bg-stone-200">
                  <span className="text-sm font-bold text-stone-400">配图生成中...</span>
                </div>
              ) : (
                <div className="flex h-full w-full flex-col items-center justify-center gap-2 p-4 text-center">
                  <span className="text-3xl">🖼️</span>
                  <p className="text-sm font-bold text-brand-400">配图待生成</p>
                </div>
              )}
            </div>

            <p className="mt-4 text-center text-lg font-black text-stone-900">{target.target}</p>
            <p className="mt-1 text-center text-xs font-bold uppercase tracking-wide text-brand-500">
              第 {active + 1} / {total} 个目标
            </p>
          </div>

          <button
            type="button"
            onClick={goNext}
            aria-label="下一个目标"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-100 text-lg font-black text-brand-600 transition hover:bg-brand-200"
          >
            ›
          </button>
        </div>

        <div className="mt-6 flex flex-wrap justify-center gap-2">
          {targets.map((_, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => setActive(idx)}
              aria-label={`跳转到第 ${idx + 1} 个目标`}
              className={`h-2.5 rounded-full transition ${
                idx === active ? 'w-6 bg-brand-500' : 'w-2.5 bg-brand-200 hover:bg-brand-300'
              }`}
            />
          ))}
        </div>
      </div>

      {lightboxUrl && (
        <Lightbox url={lightboxUrl} alt={target.target} onClose={() => setLightboxUrl(null)} />
      )}
    </section>
  )
}

export default TargetCarousel
