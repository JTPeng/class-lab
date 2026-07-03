import { useEffect, useState } from 'react'
import { api, apiErrorMessage } from '../api/client'
import { counts, ratios, styles, type RatioOption } from '../pictureBook/config'
import { addRecord, getNextCount, today } from '../pictureBook/storage'
import PictureCard, { QrImage, type PictureBookData } from '../components/PictureCard'
import '../pictureBook/pictureBook.css'

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
    <div className="options">
      {items.map((item) => {
        const key = getKey(item)
        return (
          <button
            key={key}
            type="button"
            className={key === selectedKey ? 'on' : ''}
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
    <div className="qr-modal" onClick={onClose}>
      <div className="qr-box" onClick={(e) => e.stopPropagation()}>
        {lanUrl ? (
          <>
            <div className="qr-canvas">
              <QrImage text={lanUrl} size={200} />
            </div>
            <p className="qr-url">{lanUrl}</p>
          </>
        ) : (
          <p className="qr-url">{lanUrl === undefined ? '获取地址中…' : '未检测到局域网地址'}</p>
        )}
        <button className="btn" type="button" onClick={onClose}>
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
    <div className="pb-root">
      <div className="scanlines" aria-hidden="true" />
      <main className="page">
        <div className="topbar">
          <h1 className="page__title" data-text="READING·PUNK">
            READING·PUNK
          </h1>
          <button className="btn btn--ghost" type="button" onClick={() => setQrOpen(true)}>
            扫码上手机
          </button>
        </div>
        <p className="page__subtitle">// 绘本阅读打卡终端</p>

        {qrOpen && <LanQrModal onClose={() => setQrOpen(false)} />}

        <section className="form">
          <label className="field">
            <span>书名</span>
            <input
              type="text"
              placeholder="例如：好饿的毛毛虫"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </label>

          <label className="field">
            <span>阅读心得（可选）</span>
            <textarea
              rows={3}
              placeholder="今天读完的一句话感想"
              value={thoughts}
              onChange={(e) => setThoughts(e.target.value)}
            />
          </label>

          <div className="field">
            <span>评分</span>
            <div className="stars">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  className={n <= stars ? 'on' : ''}
                  onClick={() => setStars(n)}
                >
                  ★
                </button>
              ))}
            </div>
          </div>

          <div className="field">
            <span>AI 画风</span>
            <Options
              items={styles}
              getLabel={(s) => s.name}
              getKey={(s) => s.id}
              selectedKey={style}
              onSelect={(s) => setStyle(s.id)}
            />
          </div>

          <div className="field">
            <span>绘本页数</span>
            <Options
              items={counts}
              getLabel={(n) => `${n} 张`}
              getKey={(n) => n}
              selectedKey={count}
              onSelect={setCount}
            />
          </div>

          <div className="field">
            <span>像素比</span>
            <Options
              items={ratios}
              getLabel={(r) => r.name}
              getKey={(r) => r.id}
              selectedKey={ratio.id}
              onSelect={setRatio}
            />
          </div>

          <button className="btn btn--primary" type="button" onClick={handleGenerate} disabled={generating}>
            生成配图
          </button>
          <p className="status">{status}</p>
        </section>

        {book && (
          <section>
            <PictureCard data={book} />
          </section>
        )}
      </main>
    </div>
  )
}

export default PictureBook
