import { useEffect, useRef, useState } from 'react'
import html2canvas from 'html2canvas'
import QRCode from 'qrcode'
import { api, apiErrorMessage, type PictureScene } from '../api/client'

export interface PictureBookData {
  scenes: PictureScene[]
  title: string
  thoughts: string
  stars: number
  date: string
  count: number
}

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
  return src ? <img className="share-qr" src={src} alt="二维码" width={size} height={size} /> : null
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
        backgroundColor: null,
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
    <div className="book-block">
      <div className="book-card" ref={cardRef}>
        <div className="book-header">
          <h2 className="book-title">{data.title}</h2>
          <div className="book-stars">{starString(data.stars)}</div>
          {data.thoughts && <p className="book-thoughts">{data.thoughts}</p>}
        </div>
        {data.scenes.map((s, i) => (
          <div className="book-page" key={i}>
            <img className="book-img" src={s.image} alt={`第 ${i + 1} 页`} crossOrigin="anonymous" />
            <p className="book-scene">
              <span className="book-pageno">{i + 1}</span>
              {s.text}
            </p>
          </div>
        ))}
        <div className="book-footer">
          <span className="book-date">{data.date}</span>
          <span className="book-badge">第 {data.count} 次打卡</span>
        </div>
      </div>

      <div className="card-actions">
        <button className="btn btn--primary" type="button" onClick={handleExport} disabled={exporting}>
          {exporting ? '生成中…' : exportedUrl ? '已生成' : '生成绘本长图'}
        </button>
      </div>

      {exportedUrl && (
        <div className="card-result">
          <img className="export__img" src={exportedUrl} alt="绘本长图" />
          <p className="export__tip">长按图片保存到相册</p>
          <button className="btn btn--ghost" type="button" onClick={handleShare} disabled={sharing || !!shareUrl}>
            {sharing ? '生成链接中…' : shareUrl ? '已生成二维码' : '二维码分享'}
          </button>
          {shareUrl && (
            <div className="share-box">
              <QrImage text={shareUrl} size={180} />
              <p className="qr-url">{shareUrl}</p>
              <p className="export__tip">同一局域网内扫码查看 / 保存</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default PictureCard
