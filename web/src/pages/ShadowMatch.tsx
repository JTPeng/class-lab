import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { loadProgress, saveProgress, loadHistory, addRecord } from '../games/storage'
import { animalImageUrl, localShadowSource, shuffle, type Animal, type Round } from '../games/shadow'
import { makeSilhouette } from '../lib/silhouette'
import GameHistoryChart from '../components/GameHistoryChart'
import CaseScorePanel from '../components/CaseScorePanel'
import { api } from '../api/client'
import { useAuth } from '../auth/AuthContext'

// 「影子配对」游戏。
// 规则：每关 N 只动物，上方是打乱的黑色影子槽位，下方是打乱的彩色 AI 动物图，
// 把彩色图拖到对应影子里即匹配成功 +10 分。全部匹配进入下一关（3→6 只）。
// 动物图走 /api/animal-image（AI 生成+缓存），影子由前端 canvas 抠白底涂黑得到。
// 分数与关卡自动存 localStorage，数据统一走 ShadowSource 接口，后期可换 AI 数据源。

const GAME_ID = 'shadow-match'
const SCORE_PER_MATCH = 10
const source = localShadowSource

interface Drag {
  animal: Animal
  x: number
  y: number
}

function ShadowMatch() {
  const { user } = useAuth()
  const saved = useMemo(() => loadProgress(GAME_ID), [])
  const [level, setLevel] = useState(saved.level)
  const [score, setScore] = useState(saved.score)
  const [best, setBest] = useState(saved.best)
  const [round, setRound] = useState<Round>({ animals: [] })
  const [slots, setSlots] = useState<Animal[]>([]) // 影子槽位（打乱顺序）
  const [tray, setTray] = useState<Animal[]>([]) // 彩色图块（打乱顺序）
  const [matched, setMatched] = useState<Set<string>>(new Set())
  const [drag, setDrag] = useState<Drag | null>(null)
  const [wrongName, setWrongName] = useState<string | null>(null) // 拖错时抖动提示
  const [shadows, setShadows] = useState<Record<string, string | null>>({}) // 动物名 → 剪影 dataURL（null=回退 emoji）
  const [imgError, setImgError] = useState<Set<string>>(new Set()) // 彩色图加载失败 → 回退 emoji
  const [history, setHistory] = useState(() => loadHistory(GAME_ID))

  const levelDone = round.animals.length > 0 && matched.size >= round.animals.length

  // 载入某一关的动物，并为每只动物异步生成剪影。
  async function applyRound(lv: number) {
    const r = await source.getRound(lv)
    setRound(r)
    setSlots(shuffle(r.animals))
    setTray(shuffle(r.animals))
    setMatched(new Set())
    setDrag(null)
    for (const a of r.animals) {
      makeSilhouette(animalImageUrl(a)).then((dataUrl) =>
        setShadows((prev) => ({ ...prev, [a.name]: dataUrl })),
      )
    }
  }

  useEffect(() => {
    applyRound(saved.level)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    saveProgress(GAME_ID, { level, score, best })
  }, [level, score, best])

  function handlePointerDown(e: React.PointerEvent, animal: Animal) {
    if (matched.has(animal.name)) return
    e.preventDefault()
    ;(e.currentTarget as Element).setPointerCapture?.(e.pointerId)
    setDrag({ animal, x: e.clientX, y: e.clientY })
  }

  function handlePointerMove(e: React.PointerEvent) {
    if (!drag) return
    setDrag((d) => (d ? { ...d, x: e.clientX, y: e.clientY } : d))
  }

  function handlePointerUp(e: React.PointerEvent) {
    if (!drag) return
    const current = drag.animal
    setDrag(null)

    const el = document.elementFromPoint(e.clientX, e.clientY)
    const slotEl = el?.closest('[data-slot-id]') as HTMLElement | null
    const slotName = slotEl?.getAttribute('data-slot-id')

    if (slotName && !matched.has(slotName) && slotName === current.name) {
      const nextScore = score + SCORE_PER_MATCH
      setScore(nextScore)
      setBest((b) => Math.max(b, nextScore))
      setMatched((m) => new Set(m).add(current.name))
      return
    }

    // 未命中：抖动提示，不扣分。
    setWrongName(current.name)
    setTimeout(() => setWrongName(null), 400)
  }

  function nextLevel() {
    addRecord(GAME_ID, { level, score, timestamp: Date.now() })
    setHistory(loadHistory(GAME_ID))
    const nl = level + 1
    setLevel(nl)
    applyRound(nl)
  }

  function restart() {
    if (!window.confirm('确定要从第 1 关重新开始？当前分数会清零（最高分保留）。')) return
    setLevel(1)
    setScore(0)
    applyRound(1)
  }

  function markImgError(name: string) {
    setImgError((s) => new Set(s).add(name))
  }

  // 彩色动物图（加载失败回退 emoji）。
  function ColorAnimal({ animal, size }: { animal: Animal; size: number }) {
    if (imgError.has(animal.name)) {
      return <span style={{ fontSize: size * 0.8 }}>{animal.emoji}</span>
    }
    return (
      <img
        src={animalImageUrl(animal)}
        alt={animal.name}
        width={size}
        height={size}
        crossOrigin="anonymous"
        draggable={false}
        onError={() => markImgError(animal.name)}
        style={{ objectFit: 'contain', pointerEvents: 'none' }}
      />
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-brand-50 via-brand-100/60 to-brand-50 py-8 px-4">
      <div className="max-w-xl mx-auto">
        {/* 顶部状态条 */}
        <div className="flex items-center justify-between mb-6">
          <Link to="/games" className="text-sm font-bold text-brand-600 hover:underline">
            ← 返回游戏乐园
          </Link>
          <button
            type="button"
            onClick={restart}
            className="text-xs font-bold text-rose-500 bg-rose-50 hover:bg-rose-100 rounded-full px-3 py-1 transition-colors"
          >
            重新开始
          </button>
        </div>

        <div className="grid grid-cols-3 gap-3 mb-6">
          <Stat label="关卡" value={`第 ${level} 关`} />
          <Stat label="得分" value={`${score}`} />
          <Stat label="最高分" value={`${best}`} />
        </div>

        {levelDone ? (
          <div className="bg-white rounded-2xl shadow-card ring-1 ring-brand-100 p-8 text-center">
            <div className="text-6xl mb-4">🎉</div>
            <h2 className="text-2xl font-black text-stone-900 mb-2">第 {level} 关完成！</h2>
            <p className="text-stone-600 mb-6">当前累计得分 {score} 分</p>
            <button
              type="button"
              onClick={nextLevel}
              className="bg-brand-500 text-white font-bold px-6 py-3 rounded-full shadow-soft hover:bg-brand-600 transition-colors"
            >
              进入第 {level + 1} 关 →
            </button>
            {user && (
              <div className="mt-6 text-left">
                <CaseScorePanel
                  key={level}
                  userId={user.id}
                  onSubmit={async (input) => {
                    await api.createGameSession(user.id, GAME_ID, { level, score, ...input })
                  }}
                />
              </div>
            )}
          </div>
        ) : (
          <div className="bg-white rounded-2xl shadow-card ring-1 ring-brand-100 p-6">
            <p className="text-center text-sm text-stone-500 mb-5">
              把下面的小动物拖到上面「一样的影子」里 👆
            </p>

            {/* 影子槽位 */}
            <div className="flex flex-wrap justify-center gap-3 mb-8">
              {slots.map((s) => {
                const filled = matched.has(s.name)
                const shadow = shadows[s.name]
                return (
                  <div
                    key={s.name}
                    data-slot-id={s.name}
                    title={s.name}
                    className={
                      'flex items-center justify-center rounded-2xl border-2 border-dashed p-1 transition-colors ' +
                      (filled ? 'border-green-300 bg-green-50' : 'border-stone-200 bg-stone-50')
                    }
                    style={{ width: 96, height: 96 }}
                  >
                    {filled ? (
                      // 匹配成功：显示彩色动物
                      <ColorAnimal animal={s} size={80} />
                    ) : shadow ? (
                      // 剪影 dataURL
                      <img src={shadow} alt="影子" width={80} height={80} style={{ objectFit: 'contain' }} />
                    ) : shadow === null ? (
                      // 剪影生成失败：emoji 涂黑当影子
                      <span style={{ fontSize: 64, filter: 'brightness(0)' }}>{s.emoji}</span>
                    ) : (
                      // 剪影生成中
                      <span className="text-xs text-stone-400">…</span>
                    )}
                  </div>
                )
              })}
            </div>

            {/* 彩色动物图块托盘 */}
            <div className="flex flex-wrap justify-center gap-3 pt-4 border-t border-stone-100">
              {tray.map((t) => {
                const done = matched.has(t.name)
                const dragging = drag?.animal.name === t.name
                const wrong = wrongName === t.name
                return (
                  <div
                    key={t.name}
                    title={t.name}
                    onPointerDown={(e) => handlePointerDown(e, t)}
                    onPointerMove={handlePointerMove}
                    onPointerUp={handlePointerUp}
                    className={
                      'flex items-center justify-center rounded-2xl p-1 select-none transition-transform ' +
                      (done
                        ? 'opacity-30'
                        : 'cursor-grab active:cursor-grabbing hover:-translate-y-0.5') +
                      (wrong ? ' animate-bounce' : '') +
                      (dragging ? ' opacity-30' : '')
                    }
                    style={{ width: 96, height: 96, touchAction: 'none' }}
                  >
                    {done ? <span className="text-4xl">✅</span> : <ColorAnimal animal={t} size={84} />}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        <GameHistoryChart records={history} />
      </div>

      {/* 拖拽跟随浮层：跟随手指/鼠标，不参与命中检测 */}
      {drag && (
        <div
          className="fixed z-50 pointer-events-none drop-shadow-lg"
          style={{ left: drag.x, top: drag.y, transform: 'translate(-50%, -50%)' }}
        >
          <ColorAnimal animal={drag.animal} size={88} />
        </div>
      )}
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white rounded-2xl shadow-card ring-1 ring-brand-100 py-3 text-center">
      <div className="text-xs text-stone-400 font-bold">{label}</div>
      <div className="text-lg font-black text-stone-900">{value}</div>
    </div>
  )
}

export default ShadowMatch
