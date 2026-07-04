import { useState } from 'react'
import { useAuth } from './AuthContext'
import { apiErrorMessage } from '../api/client'
import { GameIcon, LessonIcon, PictureBookIcon, TrainingIcon, VideoIcon } from '../components/NavIcons'

const modules = [
  {
    id: 'dtt',
    label: 'DTT 教案',
    icon: LessonIcon,
    summary: 'AI 生成海报化 DTT 训练教案',
    desc: '面向特需儿童（ABA/DTT 训练）的教案生成工具，输入训练目标与现有教具，AI 自动生成一份海报化教案。',
    features: [
      '表单输入训练目标与教具 → AI 生成结构化教案 → 保存/查看/删除',
      '海报化教案详情页，排版清晰易读',
      '回合流程演示：SD 呈现 → 正确/错误 → 强化/纠正 → 再来一回合',
      '目标清单图卡轮播，同组多重范例切换、放大查看',
      '可对每个目标单独触发 AI 配图',
    ],
  },
  {
    id: 'picture-book',
    label: '绘本打卡',
    icon: PictureBookIcon,
    summary: 'AI 编排分镜生成绘本打卡长图',
    desc: '填写书名、心得与评分，选择 AI 画风与页数，自动编排连贯故事分镜并生成插画。',
    features: [
      '表单输入 → AI 编排分镜 → 逐场景生成插画 → 拼成长图卡片',
      '打卡累计次数自动记录（第 N 次打卡）',
      '长图支持长按保存，或扫码在手机上查看',
      '同一局域网内可直接分享给他人',
    ],
  },
  {
    id: 'games',
    label: '游戏乐园',
    icon: GameIcon,
    summary: '5 款认知与感统训练小游戏',
    desc: '5 款认知与感统训练小游戏，寓教于乐，关卡与分数自动保存。',
    features: [
      '听声音猜动物、形状配对、影子配对、记忆翻牌',
      '跟我做动作：AI 生成示范动作，摄像头识别模仿并计分',
      '每个游戏独立记录关卡与最高分',
    ],
  },
  {
    id: 'video',
    label: '视频分析',
    icon: VideoIcon,
    summary: 'AI 分析训练视频，辅助观察复盘',
    desc: '上传训练视频或提供链接，AI 自动生成分析报告，辅助观察与复盘。',
    features: [
      '支持上传视频文件或粘贴视频链接',
      '三种报告风格可选：专业督导版 / 温和家长版 / 简洁要点版',
      '历史报告列表，随时查看分析进度与结果',
    ],
  },
  {
    id: 'training',
    label: '培训测评',
    icon: TrainingIcon,
    summary: '学练测三环节，掌握训练要点',
    desc: '学、练、测三环节，帮助掌握训练要点，与个案数据关联。',
    features: [
      '培训主题图文学习内容',
      '逐题作答、按题即时判分',
      '答错展示解析后再进入下一题，支持回看不重置',
    ],
  },
]

// 全局登录门禁：未登录时占满整屏，展示产品介绍 + 登录入口；登录后（login 内部会整页刷新）进入应用。
function LoginScreen() {
  const { login } = useAuth()
  const [showLogin, setShowLogin] = useState(false)
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed || !password || busy) return
    setBusy(true)
    setError('')
    try {
      await login(trimmed, password)
    } catch (err) {
      setError(apiErrorMessage(err, '登录失败，请稍后重试'))
      setBusy(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-brand-50 via-brand-100/60 to-brand-50">
      {/* Hero */}
      <section className="px-4 pt-16 pb-12 text-center">
        <img src="/favicon.svg" alt="" className="w-20 h-20 mx-auto mb-4" />
        <h1 className="text-3xl font-black text-stone-900 mb-2">士多啤梨</h1>
        <p className="text-base text-stone-600 max-w-md mx-auto mb-6">
          面向特需儿童训练的一站式 AI 工具集：教案、绘本、游戏、视频分析与培训测评
        </p>
        <button
          onClick={() => setShowLogin(true)}
          className="inline-block px-6 py-2.5 rounded-full font-bold bg-brand-500 text-white shadow-soft hover:bg-brand-600 transition-colors"
        >
          立即登录
        </button>
      </section>

      {/* 模块概览：小卡片 */}
      <section className="px-4 pb-10">
        <div className="max-w-4xl mx-auto grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          {modules.map((m) => (
            <a
              key={m.label}
              href={`#module-${m.id}`}
              className="bg-white rounded-2xl shadow-card ring-1 ring-brand-100 p-5 flex flex-col items-center text-center gap-2 hover:ring-brand-300 hover:-translate-y-0.5 transition"
            >
              <m.icon className="w-9 h-9 text-brand-500" />
              <h3 className="font-bold text-stone-900">{m.label}</h3>
              <p className="text-sm text-stone-600">{m.summary}</p>
            </a>
          ))}
        </div>
      </section>

      {/* 模块详情：大卡片 */}
      <section className="px-4 pb-12 space-y-6">
        <h2 className="max-w-4xl mx-auto text-xl font-black text-stone-900">功能详情</h2>
        <div className="max-w-4xl mx-auto flex flex-col gap-6">
          {modules.map((m, i) => (
            <div
              key={m.label}
              id={`module-${m.id}`}
              className={
                'scroll-mt-6 bg-white rounded-3xl shadow-card ring-1 ring-brand-100 p-6 md:p-8 flex flex-col md:flex-row gap-6 items-start' +
                (i % 2 === 1 ? ' md:flex-row-reverse' : '')
              }
            >
              <div className="flex items-center gap-3 md:flex-col md:items-start md:w-48 shrink-0">
                <div className="w-12 h-12 rounded-2xl bg-brand-100 flex items-center justify-center">
                  <m.icon className="w-7 h-7 text-brand-500" />
                </div>
                <div>
                  <h3 className="font-black text-lg text-stone-900">{m.label}</h3>
                </div>
              </div>
              <div className="flex-1">
                <p className="text-stone-700 mb-3">{m.desc}</p>
                <ul className="space-y-1.5">
                  {m.features.map((f) => (
                    <li key={f} className="text-sm text-stone-600 flex gap-2">
                      <span className="text-brand-500 shrink-0">•</span>
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 登录弹窗 */}
      {showLogin && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/40 px-4"
          onClick={() => setShowLogin(false)}
        >
          <div
            className="w-full max-w-sm bg-white rounded-3xl shadow-card ring-1 ring-brand-100 p-8 text-center"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-xl font-black text-stone-900 mb-1">登录</h2>
            <p className="text-sm text-stone-600 mb-6">请先登录后使用</p>
            <form onSubmit={submit} className="space-y-3">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="输入用户名"
                autoFocus
                className="w-full px-4 py-2.5 rounded-full border border-brand-200 text-center focus:outline-none focus:ring-2 focus:ring-brand-300"
              />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="输入密码"
                className="w-full px-4 py-2.5 rounded-full border border-brand-200 text-center focus:outline-none focus:ring-2 focus:ring-brand-300"
              />
              <button
                type="submit"
                disabled={busy || !name.trim() || !password}
                className="w-full py-2.5 rounded-full font-bold bg-brand-500 text-white disabled:opacity-40 hover:bg-brand-600 transition-colors"
              >
                {busy ? '登录中…' : '登录'}
              </button>
              {error && <p className="text-sm text-red-500">{error}</p>}
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default LoginScreen
