import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { loadProgress, saveProgress, loadHistory, addRecord } from '../games/storage'
import { localShapeSource, shuffle, type Round, type ShapeSpec } from '../games/shapes'
import ShapeIcon from '../components/ShapeIcon'
import GameHistoryChart from '../components/GameHistoryChart'
import CaseScorePanel from '../components/CaseScorePanel'
import { api } from '../api/client'
import { useAuth } from '../auth/AuthContext'

// 「形状配对」游戏。
// 规则：每关有 N 个彩色图块和 N 个空心槽位，把图块拖到「同形状同颜色」的槽位即匹配成功 +10 分。
// 全部匹配进入下一关，关卡越高图形越多（3→6）。分数与关卡自动存 localStorage。
// 数据统一走 ShapeSource 接口，后期可切换为 AI 生成图形。

const GAME_ID = 'shape-match'
const SCORE_PER_MATCH = 10
const source = localShapeSource

interface Drag {
  spec: ShapeSpec
  x: number
  y: number
}

function ShapeMatch() {
  const { user } = useAuth()
  const saved = useMemo(() => loadProgress(GAME_ID), [])
  const [level, setLevel] = useState(saved.level)
  const [score, setScore] = useState(saved.score)
  const [best, setBest] = useState(saved.best)
  const [round, setRound] = useState<Round>({ pairs: [] })
  const [slots, setSlots] = useState<ShapeSpec[]>([]) // 目标槽位（打乱顺序）
  const [tray, setTray] = useState<ShapeSpec[]>([]) // 待拖拽图块（打乱顺序）
  const [matched, setMatched] = useState<Set<string>>(new Set())
  const [drag, setDrag] = useState<Drag | null>(null)
  const [wrongId, setWrongId] = useState<string | null>(null) // 拖错时抖动提示
  const [history, setHistory] = useState(() => loadHistory(GAME_ID))

  const levelDone = round.pairs.length > 0 && matched.size >= round.pairs.length

  // 载入某一关的图形（ShapeSource 允许异步，兼容后期 AI 数据源）。
  async function applyRound(lv: number) {
    const r = await source.getRound(lv)
    setRound(r)
    setSlots(shuffle(r.pairs))
    setTray(shuffle(r.pairs))
    setMatched(new Set())
    setDrag(null)
  }

  // 首次进入按已保存关卡载入。
  useEffect(() => {
    applyRound(saved.level)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 分数/关卡变化即持久化。
  useEffect(() => {
    saveProgress(GAME_ID, { level, score, best })
  }, [level, score, best])

  function handlePointerDown(e: React.PointerEvent, spec: ShapeSpec) {
    if (matched.has(spec.id)) return
    e.preventDefault()
    ;(e.currentTarget as Element).setPointerCapture?.(e.pointerId)
    setDrag({ spec, x: e.clientX, y: e.clientY })
  }

  function handlePointerMove(e: React.PointerEvent) {
    if (!drag) return
    setDrag((d) => (d ? { ...d, x: e.clientX, y: e.clientY } : d))
  }

  function handlePointerUp(e: React.PointerEvent) {
    if (!drag) return
    const current = drag.spec
    setDrag(null)

    // 用坐标命中槽位（浮层设了 pointer-events:none，不会挡住命中）。
    const el = document.elementFromPoint(e.clientX, e.clientY)
    const slotEl = el?.closest('[data-slot-id]') as HTMLElement | null
    const slotId = slotEl?.getAttribute('data-slot-id')
    const slot = slotId ? slots.find((s) => s.id === slotId) : undefined

    if (slot && !matched.has(slot.id) && slot.kind === current.kind && slot.color === current.color) {
      const nextScore = score + SCORE_PER_MATCH
      setScore(nextScore)
      setBest((b) => Math.max(b, nextScore))
      setMatched((m) => new Set(m).add(current.id))
      return
    }

    // 未命中：图块抖动提示，不扣分。
    setWrongId(current.id)
    setTimeout(() => setWrongId(null), 400)
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
            className="text-xs font-bold text-rose-500 bg-rose-50 hover:bg-rose-100 active:scale-[0.97] rounded-full px-3 py-1 transition-colors"
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
          // 本关结算
          <div className="bg-white rounded-2xl shadow-card ring-1 ring-brand-100 p-8 text-center">
            <div className="text-6xl mb-4">🎉</div>
            <h2 className="text-2xl font-extrabold text-stone-900 mb-2">第 {level} 关完成！</h2>
            <p className="text-stone-600 mb-6">当前累计得分 {score} 分</p>
            <button
              type="button"
              onClick={nextLevel}
              className="bg-brand-500 text-white font-bold px-6 py-3 rounded-full shadow-soft hover:bg-brand-600 active:scale-[0.98] transition-colors"
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
              把下面的图形拖到上面「一样的形状、一样的颜色」里 👆
            </p>

            {/* 目标槽位 */}
            <div className="flex flex-wrap justify-center gap-3 mb-8">
              {slots.map((s) => {
                const filled = matched.has(s.id)
                return (
                  <div
                    key={s.id}
                    data-slot-id={s.id}
                    title={s.label}
                    className={
                      'flex items-center justify-center rounded-2xl border-2 border-dashed p-1 transition-colors ' +
                      (filled
                        ? 'border-green-300 bg-green-50'
                        : 'border-stone-200 bg-stone-50')
                    }
                    style={{ width: 88, height: 88 }}
                  >
                    <ShapeIcon
                      kind={s.kind}
                      color={s.color}
                      variant={filled ? 'solid' : 'outline'}
                    />
                  </div>
                )
              })}
            </div>

            {/* 待拖拽的图块托盘 */}
            <div className="flex flex-wrap justify-center gap-3 pt-4 border-t border-stone-100">
              {tray.map((t) => {
                const done = matched.has(t.id)
                const dragging = drag?.spec.id === t.id
                const wrong = wrongId === t.id
                return (
                  <div
                    key={t.id}
                    title={t.label}
                    onPointerDown={(e) => handlePointerDown(e, t)}
                    onPointerMove={handlePointerMove}
                    onPointerUp={handlePointerUp}
                    className={
                      'flex items-center justify-center rounded-2xl p-1 select-none transition-all duration-300 ease-bounce-soft ' +
                      (done
                        ? 'opacity-30'
                        : 'cursor-grab active:cursor-grabbing active:scale-[0.97] hover:-translate-y-0.5 hover:shadow-float') +
                      (wrong ? ' animate-bounce' : '') +
                      (dragging ? ' opacity-30' : '')
                    }
                    style={{ width: 88, height: 88, touchAction: 'none' }}
                  >
                    {done ? (
                      <span className="text-3xl">✅</span>
                    ) : (
                      <ShapeIcon kind={t.kind} color={t.color} variant="solid" />
                    )}
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
          <ShapeIcon kind={drag.spec.kind} color={drag.spec.color} variant="solid" size={80} />
        </div>
      )}
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white rounded-2xl shadow-card ring-1 ring-brand-100 py-3 text-center">
      <div className="text-xs text-stone-400 font-bold">{label}</div>
      <div className="text-lg font-bold text-stone-900">{value}</div>
    </div>
  )
}

export default ShapeMatch
