import { useEffect, useRef, useState } from 'react'
import html2canvas from 'html2canvas'
import QRCode from 'qrcode'
import { api, apiErrorMessage } from '../api/client'
import type { BookRecord } from '../pictureBook/storage'
import PictureFlipBook from './PictureFlipBook'

export type PictureBookData = BookRecord

function starString(n: number): string {
  return '★★★★★'.slice(0, n) + '☆☆☆☆☆'.slice(0, 5 - n)
}

// 用 qrcode 生成二维码并渲染为 <img>
export function QrImage({ text, size }: { text: string; size: number }) {
  const [src, setSrc] = useState('')
  useEffect(() => {
    QRCode.toDataURL(text, { width: size, margin: 1 })
      .then(setSrc)
      .catch(() => setSrc(''))
  }, [text, size])
  return src ? (
    <img className="bg-white p-2 rounded-lg" src={src} alt="二维码" width={size} height={size} />
  ) : null
}

// 把一本绘本图集渲染成一张纵向长图卡片，支持 html2canvas 导出与二维码分享。
function PictureCard({ data }: { data: PictureBookData }) {
  const cardRef = useRef<HTMLDivElement>(null)
  const [exporting, setExporting] = useState(false)
  const [exportedUrl, setExportedUrl] = useState('')
  const [sharing, setSharing] = useState(false)
  const [shareUrl, setShareUrl] = useState('')

  async function handleExport() {
    if (!cardRef.current) return
    setExporting(true)
    try {
      const canvas = await html2canvas(cardRef.current, {
        useCORS: true,
        scale: 2,
        backgroundColor: '#ffffff',
      })
      setExportedUrl(canvas.toDataURL('image/png'))
    } catch {
      alert('生成图片失败，请重试')
    } finally {
      setExporting(false)
    }
  }

  async function handleShare() {
    setSharing(true)
    try {
      const { url } = await api.sharePicture(exportedUrl)
      setShareUrl(url)
    } catch (err) {
      alert(apiErrorMessage(err, '分享失败，请重试'))
    } finally {
      setSharing(false)
    }
  }

  return (
    <div className="mt-6">
      <PictureFlipBook data={data} />

      {/* 隐藏的纵向长图布局，仅供 html2canvas 截图导出用，不在可视区域展示 */}
      <div
        className="fixed left-0 top-0 -z-10 opacity-0 pointer-events-none flex flex-col gap-4 bg-white rounded-2xl border border-brand-200 shadow-card p-5 w-[480px]"
        ref={cardRef}
      >
        <div className="flex flex-col items-center gap-2 pb-3 border-b border-brand-100">
          <h2 className="text-xl font-black text-stone-900 text-center">{data.title}</h2>
          <div className="text-xl text-amber-400">{starString(data.stars)}</div>
          {data.thoughts && (
            <p className="text-sm leading-relaxed text-stone-600 text-center pl-3 border-l-4 border-brand-300">
              {data.thoughts}
            </p>
          )}
        </div>
        {data.scenes.map((s, i) => (
          <div className="flex flex-col gap-2" key={i}>
            <img
              className="w-full h-auto rounded-xl"
              src={s.image}
              alt={`第 ${i + 1} 页`}
              crossOrigin="anonymous"
            />
            <p className="flex items-start gap-2 text-sm leading-relaxed text-stone-700">
              <span className="flex-none w-6 h-6 flex items-center justify-center rounded-full bg-brand-100 text-brand-700 text-xs font-bold">
                {i + 1}
              </span>
              {s.text}
            </p>
          </div>
        ))}
        <div className="flex items-center justify-between pt-3 border-t border-brand-100 text-sm">
          <span className="text-stone-400">{data.date}</span>
          <span className="inline-block rounded-full bg-brand-100 px-2.5 py-0.5 text-xs font-bold text-brand-700">
            第 {data.count} 次打卡
          </span>
        </div>
      </div>

      <button
        className="mt-4 w-full bg-brand-500 text-white font-medium py-2 rounded-xl hover:bg-brand-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        type="button"
        onClick={handleExport}
        disabled={exporting}
      >
        {exporting ? '生成中…' : exportedUrl ? '已生成' : '生成绘本长图'}
      </button>

      {exportedUrl && (
        <div className="mt-4 flex flex-col items-center gap-3">
          <img className="w-full rounded-xl border border-brand-200" src={exportedUrl} alt="绘本长图" />
          <p className="text-sm text-stone-500">长按图片保存到相册</p>
          <button
            className="px-5 py-2 rounded-full font-bold bg-stone-200 text-stone-800 hover:bg-stone-300 disabled:opacity-50 transition-colors"
            type="button"
            onClick={handleShare}
            disabled={sharing || !!shareUrl}
          >
            {sharing ? '生成链接中…' : shareUrl ? '已生成二维码' : '二维码分享'}
          </button>
          {shareUrl && (
            <div className="flex flex-col items-center gap-1">
              <QrImage text={shareUrl} size={180} />
              <p className="text-sm text-stone-500 break-all">{shareUrl}</p>
              <p className="text-sm text-stone-500">同一局域网内扫码查看 / 保存</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default PictureCard
