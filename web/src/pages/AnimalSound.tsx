import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ANIMALS, animalImageUrl, playRiddle, shuffle, type Animal } from '../games/animals'
import { loadProgress, saveProgress, loadHistory, addRecord } from '../games/storage'
import GameHistoryChart from '../components/GameHistoryChart'
import CaseScorePanel from '../components/CaseScorePanel'
import { api } from '../api/client'
import { useAuth } from '../auth/AuthContext'

// 「听声音猜动物」游戏。
// 规则：每关 5 题，AI 真人音色读一句谜语（不说名字），从若干选项中选出正确动物。答对 +10 分。
// 关卡越高选项越多（3→6 个），越难。分数与关卡自动存 localStorage。

const GAME_ID = 'animal-sound'
const QUESTIONS_PER_LEVEL = 5
const SCORE_PER_CORRECT = 10

// 关卡对应的选项数量：第 1 关 3 个，每关 +1，最多 6 个。
function optionCount(level: number): number {
  return Math.min(3 + (level - 1), 6)
}

interface Question {
  answer: Animal
  options: Animal[]
}

function makeQuestion(level: number): Question {
  const count = optionCount(level)
  const options = shuffle(ANIMALS).slice(0, count)
  const answer = options[Math.floor(Math.random() * options.length)]
  return { answer, options }
}

function AnimalSound() {
  const { user } = useAuth()
  const saved = useMemo(() => loadProgress(GAME_ID), [])
  const [level, setLevel] = useState(saved.level)
  const [score, setScore] = useState(saved.score)
  const [best, setBest] = useState(saved.best)
  const [qIndex, setQIndex] = useState(0) // 本关第几题（0-based）
  const [question, setQuestion] = useState<Question>(() => makeQuestion(saved.level))
  const [picked, setPicked] = useState<Animal | null>(null)
  const [levelDone, setLevelDone] = useState(false)
  const [speaking, setSpeaking] = useState(false) // 正在合成/播放语音
  const [history, setHistory] = useState(() => loadHistory(GAME_ID))

  // 播放当前题目的谜语语音（首次合成有几秒延迟，speaking 期间禁用按钮）。
  async function speak(animal: Animal) {
    setSpeaking(true)
    await playRiddle(animal)
    setSpeaking(false)
  }

  // 每次进入新题目自动播放一次谜语。
  useEffect(() => {
    if (!levelDone) speak(question.answer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [question])

  // 分数/关卡变化即持久化。
  useEffect(() => {
    saveProgress(GAME_ID, { level, score, best })
  }, [level, score, best])

  function handlePick(animal: Animal) {
    if (picked) return // 已作答，锁定
    setPicked(animal)
    const correct = animal.name === question.answer.name
    const nextScore = correct ? score + SCORE_PER_CORRECT : score
    if (correct) {
      setScore(nextScore)
      setBest((b) => Math.max(b, nextScore))
    }

    // 1 秒后进入下一题或结算本关
    setTimeout(() => {
      if (qIndex + 1 >= QUESTIONS_PER_LEVEL) {
        setLevelDone(true)
      } else {
        setQIndex((i) => i + 1)
        setQuestion(makeQuestion(level))
        setPicked(null)
      }
    }, 1000)
  }

  function nextLevel() {
    addRecord(GAME_ID, { level, score, timestamp: Date.now() })
    setHistory(loadHistory(GAME_ID))
    const nl = level + 1
    setLevel(nl)
    setQIndex(0)
    setQuestion(makeQuestion(nl))
    setPicked(null)
    setLevelDone(false)
  }

  function restart() {
    if (!window.confirm('确定要从第 1 关重新开始？当前分数会清零（最高分保留）。')) return
    setLevel(1)
    setScore(0)
    setQIndex(0)
    setQuestion(makeQuestion(1))
    setPicked(null)
    setLevelDone(false)
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
            {/* 进度 */}
            <p className="text-center text-sm text-stone-500 mb-4">
              本关第 {qIndex + 1} / {QUESTIONS_PER_LEVEL} 题
            </p>

            {/* 播放按钮 */}
            <div className="text-center mb-6">
              <button
                type="button"
                onClick={() => speak(question.answer)}
                disabled={speaking}
                className="inline-flex items-center gap-2 bg-brand-100 hover:bg-brand-200 text-brand-700 font-black text-lg px-8 py-4 rounded-full active:scale-[0.98] transition-colors disabled:opacity-60"
              >
                <span className="text-2xl">🔊</span>
                {speaking ? '播放中…' : '再听一次'}
              </button>
              <p className="text-xs text-stone-400 mt-2">听一听谜语，猜猜是哪种小动物？</p>
            </div>

            {/* 选项 */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {question.options.map((animal) => {
                const isPicked = picked?.name === animal.name
                const isAnswer = animal.name === question.answer.name
                let cls =
                  'flex flex-col items-center gap-1 rounded-2xl border-2 p-4 transition-all duration-300 ease-bounce-soft active:scale-[0.97] '
                if (!picked) {
                  cls += 'border-brand-100 bg-cream hover:border-brand-400 hover:-translate-y-0.5 hover:shadow-float'
                } else if (isAnswer) {
                  cls += 'border-green-400 bg-green-50'
                } else if (isPicked) {
                  cls += 'border-rose-400 bg-rose-50'
                } else {
                  cls += 'border-stone-100 bg-stone-50 opacity-60'
                }
                return (
                  <button
                    key={animal.name}
                    type="button"
                    onClick={() => handlePick(animal)}
                    disabled={!!picked}
                    className={cls}
                  >
                    <AnimalIcon animal={animal} />
                    <span className="text-sm font-bold text-stone-700">
                      {picked ? animal.name : '？'}
                    </span>
                  </button>
                )
              })}
            </div>

            {/* 结果提示 */}
            {picked && (
              <p className="text-center mt-5 font-black text-lg">
                {picked.name === question.answer.name ? (
                  <span className="text-green-600">答对啦！+{SCORE_PER_CORRECT} 分 🌟</span>
                ) : (
                  <span className="text-rose-600">
                    答错咯，是「{question.answer.name}」{question.answer.emoji}
                  </span>
                )}
              </p>
            )}
          </div>
        )}

        <GameHistoryChart records={history} />
      </div>
    </div>
  )
}

// 动物图标：优先显示 AI 生成的动物图，未加载好/失败时用 emoji 兜底。
function AnimalIcon({ animal }: { animal: Animal }) {
  const [loaded, setLoaded] = useState(false)
  return (
    <div className="relative w-16 h-16 flex items-center justify-center">
      {!loaded && <span className="text-5xl">{animal.emoji}</span>}
      <img
        src={animalImageUrl(animal)}
        alt={animal.name}
        onLoad={() => setLoaded(true)}
        onError={() => setLoaded(false)}
        className={
          loaded ? 'w-16 h-16 object-contain' : 'absolute w-px h-px opacity-0 pointer-events-none'
        }
      />
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

export default AnimalSound
