import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { loadProgress, saveProgress, loadHistory, addRecord } from '../games/storage'
import { fruitCardSource, type CardFace } from '../games/cards'
import { shuffle } from '../games/shapes'
import ShapeIcon from '../components/ShapeIcon'
import GameHistoryChart from '../components/GameHistoryChart'
import CaseScorePanel from '../components/CaseScorePanel'
import { api } from '../api/client'
import { useAuth } from '../auth/AuthContext'

// 「记忆翻牌」游戏。
// 规则：牌面朝下铺开，点击翻开两张，形状+颜色相同即配对成功 +10 分（配对后保持翻开）。
// 全部配对进入下一关，关卡越高对数越多（3→6 对）。只加分、不惩罚。分数与关卡自动存 localStorage。
// 卡面数据统一走 CardSource 接口，后期可切换为 AI 生成图形。

const GAME_ID = 'memory-flip'
const SCORE_PER_MATCH = 10
const FLIP_BACK_MS = 800 // 翻错后自动翻回的等待时长
const source = fruitCardSource

// 铺在桌面上的一张卡：cardId 唯一，同 face.key 的两张即为一对。
interface Card {
  cardId: string
  face: CardFace
}

function MemoryFlip() {
  const { user } = useAuth()
  const saved = useMemo(() => loadProgress(GAME_ID), [])
  const [level, setLevel] = useState(saved.level)
  const [score, setScore] = useState(saved.score)
  const [best, setBest] = useState(saved.best)
  const [deck, setDeck] = useState<Card[]>([])
  const [flipped, setFlipped] = useState<string[]>([]) // 当前翻开待判定的 cardId（≤2）
  const [matched, setMatched] = useState<Set<string>>(new Set())
  const [lock, setLock] = useState(false) // 判定间隙锁点击
  const [history, setHistory] = useState(() => loadHistory(GAME_ID))

  const levelDone = deck.length > 0 && matched.size >= deck.length

  // 载入某一关：每个卡面复制成两张，打乱后铺开（CardSource 允许异步，兼容后期 AI 数据源）。
  async function applyRound(lv: number) {
    const faces = await source.getDeck(lv)
    const cards: Card[] = faces.flatMap((face) => [
      { cardId: `${face.key}-a`, face },
      { cardId: `${face.key}-b`, face },
    ])
    setDeck(shuffle(cards))
    setFlipped([])
    setMatched(new Set())
    setLock(false)
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

  function handleFlip(card: Card) {
    if (lock || matched.has(card.cardId) || flipped.includes(card.cardId)) return

    const next = [...flipped, card.cardId]
    setFlipped(next)
    if (next.length < 2) return

    // 翻开第二张，判定这一对。
    setLock(true)
    const [firstId, secondId] = next
    const first = deck.find((c) => c.cardId === firstId)!
    const second = deck.find((c) => c.cardId === secondId)!

    if (first.face.key === second.face.key) {
      // 配对成功：保持翻开，+分。
      const nextScore = score + SCORE_PER_MATCH
      setScore(nextScore)
      setBest((b) => Math.max(b, nextScore))
      setMatched((m) => new Set(m).add(firstId).add(secondId))
      setFlipped([])
      setLock(false)
    } else {
      // 翻错：短暂展示后自动翻回，不扣分。
      setTimeout(() => {
        setFlipped([])
        setLock(false)
      }, FLIP_BACK_MS)
    }
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
          // 本关结算
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
              点开两张卡片，找出「一样的水果」配成一对 👆
            </p>

            <div
              className={
                'grid gap-3 justify-items-center ' +
                (deck.length <= 6 ? 'grid-cols-3' : 'grid-cols-4')
              }
            >
              {deck.map((card) => {
                const isMatched = matched.has(card.cardId)
                const faceUp = isMatched || flipped.includes(card.cardId)
                return (
                  <button
                    key={card.cardId}
                    type="button"
                    onClick={() => handleFlip(card)}
                    disabled={faceUp || lock}
                    title={faceUp ? card.face.label : '点击翻牌'}
                    className={
                      'flex items-center justify-center rounded-2xl transition-all ' +
                      (faceUp
                        ? isMatched
                          ? 'border-2 border-green-300 bg-green-50'
                          : 'border-2 border-brand-300 bg-white'
                        : 'bg-brand-400 hover:bg-brand-500 hover:-translate-y-0.5 cursor-pointer shadow-card')
                    }
                    style={{ width: 80, height: 80 }}
                  >
                    {faceUp ? (
                      <FaceView face={card.face} />
                    ) : (
                      <span className="text-3xl text-white select-none">❓</span>
                    )}
                  </button>
                )
              })}
            </div>
          </div>
        )}

        <GameHistoryChart records={history} />
      </div>
    </div>
  )
}

// 卡面正面渲染，兜底顺序：AI 图 → emoji → 形状+颜色。
// AI 图加载失败（未就绪/出错）时回退到 emoji，保证始终可辨识。
function FaceView({ face }: { face: CardFace }) {
  const [imgError, setImgError] = useState(false)

  if (face.imageUrl && !imgError) {
    return (
      <img
        src={face.imageUrl}
        alt={face.label}
        className="w-[64px] h-[64px] object-contain"
        onError={() => setImgError(true)}
      />
    )
  }
  if (face.emoji) {
    return <span className="text-4xl select-none">{face.emoji}</span>
  }
  if (face.kind && face.color) {
    return <ShapeIcon kind={face.kind} color={face.color} variant="solid" size={64} />
  }
  return <span className="text-3xl select-none">❓</span>
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white rounded-2xl shadow-card ring-1 ring-brand-100 py-3 text-center">
      <div className="text-xs text-stone-400 font-bold">{label}</div>
      <div className="text-lg font-black text-stone-900">{value}</div>
    </div>
  )
}

export default MemoryFlip
