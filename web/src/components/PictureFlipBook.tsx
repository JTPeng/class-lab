import HTMLFlipBook from 'react-pageflip'
import type { PictureBookData } from './PictureCard'

function starString(n: number): string {
  return '★★★★★'.slice(0, n) + '☆☆☆☆☆'.slice(0, 5 - n)
}

// 用 react-pageflip 把一本绘本渲染成可拖拽书角翻页的书：封面 → 逐场景 → 封底。
function PictureFlipBook({ data }: { data: PictureBookData }) {
  return (
    <div className="flex justify-center">
      <HTMLFlipBook
        className="rounded-2xl shadow-card"
        style={{}}
        width={320}
        height={440}
        size="stretch"
        minWidth={260}
        maxWidth={420}
        minHeight={360}
        maxHeight={580}
        startPage={0}
        drawShadow
        flippingTime={700}
        usePortrait
        startZIndex={0}
        autoSize
        maxShadowOpacity={0.5}
        showCover
        mobileScrollSupport
        clickEventForward
        useMouseEvents
        swipeDistance={30}
        showPageCorners
        disableFlipByClick={false}
      >
        <div className="flex flex-col items-center justify-center gap-3 h-full bg-brand-500 text-white p-6 text-center">
          <h2 className="text-2xl font-black">{data.title}</h2>
          <div className="text-xl text-amber-200">{starString(data.stars)}</div>
          {data.thoughts && <p className="text-sm leading-relaxed">{data.thoughts}</p>}
        </div>
        {data.scenes.map((s, i) => (
          <div className="flex flex-col h-full bg-white p-3 gap-2" key={i}>
            <img
              className="w-full flex-1 object-contain rounded-lg"
              src={s.image}
              alt={`第 ${i + 1} 页`}
              crossOrigin="anonymous"
            />
            <p className="text-xs leading-relaxed text-stone-700 flex-none">{s.text}</p>
          </div>
        ))}
        <div className="flex flex-col items-center justify-center gap-2 h-full bg-brand-500 text-white p-6 text-center">
          <span className="text-sm text-brand-100">{data.date}</span>
          <span className="inline-block rounded-full bg-white/20 px-3 py-1 text-sm font-bold">
            第 {data.count} 次打卡
          </span>
        </div>
      </HTMLFlipBook>
    </div>
  )
}

export default PictureFlipBook
