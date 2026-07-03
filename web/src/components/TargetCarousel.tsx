import { useRef, useState } from 'react'
import type { Target, Image } from '../types/lesson'
import { api } from '../api/client'
import { buildTargetImagePrompt, targetRefKey } from '../lib/lessonImages'
import SectionHeading from './poster/SectionHeading'
import Lightbox from './Lightbox'

// refKey 约定为 `target:${idx}`（见 lib/lessonImages），优先按 index 精确匹配，
// 再退化为 refKey/目标文本互相包含的宽松匹配（兼容历史数据）。
function findImageForTarget(target: Target, idx: number, images: Image[]): Image | undefined {
  const byIndex = images.find((img) => img.refKey === targetRefKey(idx))
  if (byIndex) return byIndex
  return images.find(
    (img) => target.target && (img.refKey.includes(target.target) || target.target.includes(img.refKey)),
  )
}

// 交互 2·图卡轮播：左右切换目标，命中真实图片可点击放大，否则显示占位/加载态。
// 主路径是顶部「一键生成全部配图」：对所有非 done 的目标并发生成（Promise.allSettled）；
// 失败的目标额外保留单独「重试」入口，仅重发该一张。
// 所有目标卡始终在 DOM 中（非 active 用 `hidden` 隐藏），供 @media print 展开成完整清单。
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
  const [generatingAll, setGeneratingAll] = useState(false)
  const [progress, setProgress] = useState({ done: 0, total: 0 })
  // 记录正在生成中的 idx，作为去重锁：避免「一键生成」与「重试」对同一 idx 并发触发多个请求。
  const pendingIdxsRef = useRef<Set<number>>(new Set())

  if (targets.length === 0) return null

  const total = targets.length
  const goPrev = () => setActive((i) => (i - 1 + total) % total)
  const goNext = () => setActive((i) => (i + 1) % total)

  const byRefKey = new Map<string, Image>()
  images.forEach((img) => byRefKey.set(img.refKey, img))
  Object.values(localImages).forEach((img) => byRefKey.set(img.refKey, img))
  const mergedImages = Array.from(byRefKey.values())

  function imageFor(idx: number): Image | undefined {
    return findImageForTarget(targets[idx], idx, mergedImages)
  }

  async function generateOne(idx: number): Promise<void> {
    if (pendingIdxsRef.current.has(idx)) return
    pendingIdxsRef.current.add(idx)
    const refKey = targetRefKey(idx)
    const prompt = buildTargetImagePrompt(targets[idx], skill)
    setLocalImages((prev) => ({ ...prev, [refKey]: { refKey, prompt, status: 'pending' } }))
    try {
      const result = await api.generateImage(lessonId, refKey, prompt)
      setLocalImages((prev) => ({ ...prev, [refKey]: result }))
    } catch {
      setLocalImages((prev) => ({ ...prev, [refKey]: { refKey, prompt, status: 'failed' } }))
    } finally {
      pendingIdxsRef.current.delete(idx)
    }
  }

  async function handleGenerateAll() {
    const todoIdxs = targets
      .map((_, idx) => idx)
      .filter(
        (idx) =>
          imageFor(idx)?.status !== 'done' &&
          imageFor(idx)?.status !== 'pending' &&
          !pendingIdxsRef.current.has(idx),
      )
    if (todoIdxs.length === 0) return
    setGeneratingAll(true)
    setProgress({ done: 0, total: todoIdxs.length })
    let doneCount = 0
    await Promise.allSettled(
      todoIdxs.map(async (idx) => {
        await generateOne(idx)
        doneCount += 1
        setProgress({ done: doneCount, total: todoIdxs.length })
      }),
    )
    setGeneratingAll(false)
  }

  return (
    <section>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <SectionHeading sub="Target List · 图卡轮播">目标清单</SectionHeading>
        <button
          type="button"
          onClick={handleGenerateAll}
          disabled={generatingAll}
          className="shrink-0 rounded-full bg-brand-500 px-5 py-2.5 text-sm font-bold text-white shadow-md transition hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-60 print:hidden"
        >
          {generatingAll ? `生成中 ${progress.done}/${progress.total}...` : '✨ 一键生成全部配图'}
        </button>
      </div>

      <div className="rounded-2xl bg-white p-6 shadow-card ring-1 ring-brand-100 sm:p-8">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={goPrev}
            aria-label="上一个目标"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-100 text-lg font-black text-brand-600 transition hover:bg-brand-200 print:hidden"
          >
            ‹
          </button>

          <div className="flex-1">
            {targets.map((target, idx) => {
              const image = imageFor(idx)
              const hasImage = image?.status === 'done' && !!image.url
              const isPending = image?.status === 'pending'
              const isFailed = image?.status === 'failed'

              return (
                <div
                  key={idx}
                  className={`${idx === active ? '' : 'hidden'} print:mb-8 print:block print:break-inside-avoid`}
                >
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
                        <p className="text-sm font-bold text-rose-400">
                          {image?.reason ?? '配图生成失败'}
                        </p>
                        <button
                          type="button"
                          onClick={() => generateOne(idx)}
                          disabled={generatingAll}
                          className="mt-1 rounded-full bg-brand-500 px-4 py-1.5 text-xs font-bold text-white transition hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-60 print:hidden"
                        >
                          重试
                        </button>
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
                    第 {idx + 1} / {total} 个目标
                  </p>
                </div>
              )
            })}
          </div>

          <button
            type="button"
            onClick={goNext}
            aria-label="下一个目标"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-100 text-lg font-black text-brand-600 transition hover:bg-brand-200 print:hidden"
          >
            ›
          </button>
        </div>

        <div className="mt-6 flex flex-wrap justify-center gap-2 print:hidden">
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
        <Lightbox url={lightboxUrl} alt={targets[active].target} onClose={() => setLightboxUrl(null)} />
      )}
    </section>
  )
}

export default TargetCarousel
