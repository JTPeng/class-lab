import { Link } from 'react-router-dom'
import { loadProgress } from '../games/storage'

// 游戏乐园菜单：卡片网格，可扩展多个小游戏。
// 每个游戏声明 id / 路由 / 图标，卡片上顺带展示已保存的关卡与最高分。
interface GameMeta {
  id: string
  to: string
  title: string
  desc: string
  emoji: string
  ready: boolean
}

const GAMES: GameMeta[] = [
  {
    id: 'animal-sound',
    to: '/games/animal-sound',
    title: '听声音猜动物',
    desc: '听一听是谁在叫，从图案里选出正确的小动物！',
    emoji: '🔊',
    ready: true,
  },
  {
    id: 'shape-match',
    to: '/games/shape-match',
    title: '形状配对',
    desc: '把彩色图形拖到对应的形状里！',
    emoji: '🧩',
    ready: true,
  },
  {
    id: 'shadow-match',
    to: '/games/shadow-match',
    title: '影子配对',
    desc: '把小动物拖到它的影子里！（AI 生成图片）',
    emoji: '🌓',
    ready: true,
  },
  {
    id: 'memory-flip',
    to: '/games/memory-flip',
    title: '记忆翻牌',
    desc: '翻开两张卡片，找出一样的图形配成一对！',
    emoji: '🃏',
    ready: true,
  },
  {
    id: 'pose-mimic',
    to: '/games/pose-mimic',
    title: '跟我做动作',
    desc: '看 AI 画的小人做动作，用摄像头模仿它，做对就得分！',
    emoji: '🤸',
    ready: true,
  },
  // 更多小游戏敬请期待……（ready:false 显示占位卡片）
  {
    id: 'coming-soon',
    to: '#',
    title: '更多游戏',
    desc: '正在准备中，敬请期待～',
    emoji: '✨',
    ready: false,
  },
]

function Games() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-brand-50 via-brand-100/60 to-brand-50 py-10 px-4">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-black text-stone-900 mb-2">
          🎮 游戏<span className="text-brand-500">乐园</span>
        </h1>
        <p className="text-stone-600 mb-8">选择一个小游戏开始玩吧，分数和关卡都会自动保存。</p>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          {GAMES.map((game) => {
            const progress = game.ready ? loadProgress(game.id) : null

            const inner = (
              <>
                <div className="text-5xl mb-4">{game.emoji}</div>
                <h2 className="text-lg font-black text-stone-900">{game.title}</h2>
                <p className="text-sm text-stone-600 mt-2 min-h-[2.5rem]">{game.desc}</p>
                {progress && (
                  <div className="mt-4 flex gap-2">
                    <span className="inline-block rounded-full bg-brand-100 px-2.5 py-0.5 text-xs font-bold text-brand-700">
                      第 {progress.level} 关
                    </span>
                    <span className="inline-block rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-bold text-amber-700">
                      最高 {progress.best} 分
                    </span>
                  </div>
                )}
                {!game.ready && (
                  <span className="mt-4 inline-block rounded-full bg-stone-100 px-2.5 py-0.5 text-xs font-bold text-stone-400">
                    敬请期待
                  </span>
                )}
              </>
            )

            if (!game.ready) {
              return (
                <div
                  key={game.id}
                  className="block bg-white/60 rounded-2xl border-t-4 border-stone-200 shadow-card ring-1 ring-brand-100 p-5 cursor-default"
                >
                  {inner}
                </div>
              )
            }

            return (
              <Link
                key={game.id}
                to={game.to}
                className="block bg-white rounded-2xl border-t-4 border-brand-400 shadow-card ring-1 ring-brand-100 p-5 hover:shadow-soft hover:-translate-y-1 transition-all"
              >
                {inner}
              </Link>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export default Games
