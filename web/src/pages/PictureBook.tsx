import { useEffect, useState } from 'react'
import { api, apiErrorMessage } from '../api/client'
import { counts, ratios, styles, type RatioOption } from '../pictureBook/config'
import { addRecord, getNextCount, today } from '../pictureBook/storage'
import PictureCard, { QrImage, type PictureBookData } from '../components/PictureCard'

// 单选 chip 组
function Options<T>({
  items,
  getLabel,
  getKey,
  selectedKey,
  onSelect,
}: {
  items: T[]
  getLabel: (item: T) => string
  getKey: (item: T) => string | number
  selectedKey: string | number
  onSelect: (item: T) => void
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((item) => {
        const key = getKey(item)
        const active = key === selectedKey
        return (
          <button
            key={key}
            type="button"
            className={
              active
                ? 'px-4 py-1.5 rounded-full text-sm font-bold bg-brand-500 text-white shadow-soft transition-colors'
                : 'px-4 py-1.5 rounded-full text-sm font-bold bg-brand-100 text-brand-700 hover:bg-brand-200 transition-colors'
            }
            onClick={() => onSelect(item)}
          >
            {getLabel(item)}
          </button>
        )
      })}
    </div>
  )
}

// 「扫码上手机」二维码弹层：用后端返回的局域网 IP + 当前页面端口拼开发前端地址。
function LanQrModal({ onClose }: { onClose: () => void }) {
  const [lanUrl, setLanUrl] = useState<string | null | undefined>(undefined)

  useEffect(() => {
    api
      .getLanIp()
      .then(({ ip }) => {
        if (!ip) {
          setLanUrl(null)
          return
        }
        const port = window.location.port ? `:${window.location.port}` : ''
        setLanUrl(`${window.location.protocol}//${ip}${port}/picture-book`)
      })
      .catch(() => setLanUrl(null))
  }, [])

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-stone-900/40 backdrop-blur-sm px-4"
      onClick={onClose}
    >
      <div
        className="flex flex-col items-center gap-4 bg-white rounded-2xl border-t-4 border-brand-400 shadow-soft p-6 text-center"
        onClick={(e) => e.stopPropagation()}
      >
        {lanUrl ? (
          <>
            <QrImage text={lanUrl} size={200} />
            <p className="text-sm text-stone-500 break-all">{lanUrl}</p>
          </>
        ) : (
          <p className="text-sm text-stone-500">
            {lanUrl === undefined ? '获取地址中…' : '未检测到局域网地址'}
          </p>
        )}
        <button
          className="px-5 py-2 rounded-full font-bold bg-stone-200 text-stone-800 hover:bg-stone-300 transition-colors"
          type="button"
          onClick={onClose}
        >
          关闭
        </button>
      </div>
    </div>
  )
}

function PictureBook() {
  const [title, setTitle] = useState('')
  const [thoughts, setThoughts] = useState('')
  const [stars, setStars] = useState(5)
  const [style, setStyle] = useState(styles[0].id)
  const [count, setCount] = useState(counts[0])
  const [ratio, setRatio] = useState<RatioOption>(ratios[0])
  const [status, setStatus] = useState('')
  const [generating, setGenerating] = useState(false)
  const [book, setBook] = useState<PictureBookData | null>(null)
  const [qrOpen, setQrOpen] = useState(false)

  async function handleGenerate() {
    const t = title.trim()
    if (!t) {
      setStatus('请填写书名')
      return
    }
    const th = thoughts.trim()
    setGenerating(true)
    setStatus(`正在编排 ${count} 页绘本并生成插画，请稍候…`)
    try {
      const { scenes } = await api.generatePicturebook({
        title: t,
        thoughts: th,
        style,
        n: count,
        size: ratio.size,
      })
      setStatus('')
      const date = today()
      const nextCount = getNextCount()
      setBook({ scenes, title: t, thoughts: th, stars, date, count: nextCount })
      // 一次阅读记一次打卡（多张配图共用同一次）
      addRecord({ date, title: t, stars, thoughts: th })
    } catch (err) {
      setStatus(apiErrorMessage(err, '配图生成失败，请重试'))
    } finally {
      setGenerating(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-brand-50 via-brand-100/60 to-brand-50 py-10 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-3xl font-black text-stone-900">
            📖 绘本<span className="text-brand-500">打卡</span>
          </h1>
          <button
            className="px-4 py-2 rounded-full text-sm font-bold bg-stone-200 text-stone-800 hover:bg-stone-300 transition-colors"
            type="button"
            onClick={() => setQrOpen(true)}
          >
            扫码上手机
          </button>
        </div>
        <p className="text-stone-600 mb-8">记录每一次亲子阅读，生成专属绘本长图。</p>

        {qrOpen && <LanQrModal onClose={() => setQrOpen(false)} />}

        <section className="space-y-6 bg-white p-6 rounded-2xl border-t-4 border-brand-400 shadow-card ring-1 ring-brand-100">
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">书名</label>
            <input
              type="text"
              placeholder="例如：好饿的毛毛虫"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full border border-stone-300 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">阅读心得（可选）</label>
            <textarea
              rows={3}
              placeholder="今天读完的一句话感想"
              value={thoughts}
              onChange={(e) => setThoughts(e.target.value)}
              className="w-full border border-stone-300 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>

          <div>
            <span className="block text-sm font-medium text-stone-700 mb-1">评分</span>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  className={`text-2xl transition-colors ${n <= stars ? 'text-amber-400' : 'text-stone-300'}`}
                  onClick={() => setStars(n)}
                >
                  ★
                </button>
              ))}
            </div>
          </div>

          <div>
            <span className="block text-sm font-medium text-stone-700 mb-1">AI 画风</span>
            <Options
              items={styles}
              getLabel={(s) => s.name}
              getKey={(s) => s.id}
              selectedKey={style}
              onSelect={(s) => setStyle(s.id)}
            />
          </div>

          <div>
            <span className="block text-sm font-medium text-stone-700 mb-1">绘本页数</span>
            <Options
              items={counts}
              getLabel={(n) => `${n} 张`}
              getKey={(n) => n}
              selectedKey={count}
              onSelect={setCount}
            />
          </div>

          <div>
            <span className="block text-sm font-medium text-stone-700 mb-1">像素比</span>
            <Options
              items={ratios}
              getLabel={(r) => r.name}
              getKey={(r) => r.id}
              selectedKey={ratio.id}
              onSelect={setRatio}
            />
          </div>

          <button
            className="w-full bg-brand-500 text-white font-medium py-2 rounded-xl hover:bg-brand-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            type="button"
            onClick={handleGenerate}
            disabled={generating}
          >
            {generating ? '生成中...' : '生成配图'}
          </button>
          {status && <p className="text-sm text-center text-brand-700">{status}</p>}
        </section>

        {book && <PictureCard data={book} />}
      </div>
    </div>
  )
}

export default PictureBook
