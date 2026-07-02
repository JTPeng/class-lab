import { useState } from 'react'
import type { Target, Image } from '../types/lesson'
import { api } from '../api/client'
import SectionHeading from './poster/SectionHeading'
import Lightbox from './Lightbox'

// refKey 约定为 `target:${idx}`，优先按 index 精确匹配，
// 再退化为 refKey/目标文本互相包含的宽松匹配（兼容历史数据）。
function findImageForTarget(target: Target, idx: number, images: Image[]): Image | undefined {
  const byIndex = images.find((img) => img.refKey === `target:${idx}`)
  if (byIndex) return byIndex
  return images.find(
    (img) => target.target && (img.refKey.includes(target.target) || target.target.includes(img.refKey)),
  )
}

function buildPrompt(target: Target, skill: string): string {
  return `${target.target}（${skill}），儿童教具风格插画，简洁卡通，白色背景，色彩明亮`
}

// 交互 2·图卡轮播：左右切换目标，命中真实图片可点击放大，否则显示占位/加载态，
// 支持按需生成配图（点击才触发，不在页面加载时自动全量生成，因每张约需 1 分钟）。
function TargetCarousel({
  targets,
  images,
  lessonId,
  skill,
}: {
  targets: Target[]
  images: Image[]
  lessonId: string
  skill: string
}) {
  const [active, setActive] = useState(0)
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null)
  const [localImages, setLocalImages] = useState<Record<string, Image>>({})

  if (targets.length === 0) return null

  const total = targets.length
  const goPrev = () => setActive((i) => (i - 1 + total) % total)
  const goNext = () => setActive((i) => (i + 1) % total)

  const byRefKey = new Map<string, Image>()
  images.forEach((img) => byRefKey.set(img.refKey, img))
  Object.values(localImages).forEach((img) => byRefKey.set(img.refKey, img))
  const mergedImages = Array.from(byRefKey.values())

  const target = targets[active]
  const image = findImageForTarget(target, active, mergedImages)
  const hasImage = image?.status === 'done' && !!image.url
  const isPending = image?.status === 'pending'
  const isFailed = image?.status === 'failed'

  async function handleGenerate() {
    const refKey = `target:${active}`
    const prompt = buildPrompt(target, skill)
    setLocalImages((prev) => ({ ...prev, [refKey]: { refKey, prompt, status: 'pending' } }))
    try {
      const result = await api.generateImage(lessonId, refKey, prompt)
      setLocalImages((prev) => ({ ...prev, [refKey]: result }))
    } catch {
      setLocalImages((prev) => ({ ...prev, [refKey]: { refKey, prompt, status: 'failed' } }))
    }
  }

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
                  <span className="text-sm font-bold text-stone-400">生成中，约需 1 分钟...</span>
                </div>
              ) : isFailed ? (
                <div className="flex h-full w-full flex-col items-center justify-center gap-2 p-4 text-center">
                  <span className="text-3xl">⚠️</span>
                  <p className="text-sm font-bold text-rose-400">配图生成失败</p>
                  <button
                    type="button"
                    onClick={handleGenerate}
                    className="mt-1 rounded-full bg-brand-500 px-4 py-1.5 text-xs font-bold text-white transition hover:bg-brand-600"
                  >
                    重试
                  </button>
                </div>
              ) : (
                <div className="flex h-full w-full flex-col items-center justify-center gap-2 p-4 text-center">
                  <span className="text-3xl">🖼️</span>
                  <p className="text-sm font-bold text-brand-400">配图待生成</p>
                  <button
                    type="button"
                    onClick={handleGenerate}
                    className="mt-1 rounded-full bg-brand-500 px-4 py-1.5 text-xs font-bold text-white transition hover:bg-brand-600"
                  >
                    ✨ 生成配图
                  </button>
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
