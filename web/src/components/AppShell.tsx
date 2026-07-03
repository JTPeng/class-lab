import { useState } from 'react'
import { Link, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'

// 顶部常驻切换菜单（DTT 暖色风格）。两个 Tab 在「DTT 教案」与「绘本打卡」两个模块间切换，
// 结构可扩展第三个项目。下方 <Outlet/> 渲染当前模块页面。
const tabs = [
  {
    label: 'DTT 教案',
    to: '/',
    match: (p: string) => !p.startsWith('/picture-book') && !p.startsWith('/games'),
  },
  { label: '绘本打卡', to: '/picture-book', match: (p: string) => p.startsWith('/picture-book') },
  { label: '游戏乐园', to: '/games', match: (p: string) => p.startsWith('/games') },
]

// 顶部登录入口：未登录显示用户名输入框，输入后自动创建并登录；已登录显示用户名 + 退出。
function AuthArea() {
  const { user, login, logout } = useAuth()
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)

  if (user) {
    return (
      <div className="flex items-center gap-2 text-sm">
        <span className="font-bold text-stone-700">👤 {user.displayName}</span>
        <button
          onClick={logout}
          className="px-3 py-1 rounded-full font-bold text-stone-500 hover:bg-brand-100 transition-colors"
        >
          退出
        </button>
      </div>
    )
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed || busy) return
    setBusy(true)
    try {
      await login(trimmed)
      setName('')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="flex items-center gap-2">
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="输入用户名登录"
        className="w-32 px-3 py-1 rounded-full border border-brand-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300"
      />
      <button
        type="submit"
        disabled={busy || !name.trim()}
        className="px-3 py-1 rounded-full text-sm font-bold bg-brand-500 text-white disabled:opacity-40 hover:bg-brand-600 transition-colors"
      >
        登录
      </button>
    </form>
  )
}

function AppShell() {
  const { pathname } = useLocation()

  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-50 bg-cream/95 backdrop-blur border-b border-brand-100 shadow-card">
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center gap-6">
          <Link to="/" className="text-lg font-black text-stone-900 shrink-0">
            Class-Lab
          </Link>
          <nav className="flex items-center gap-1">
            {tabs.map((tab) => {
              const active = tab.match(pathname)
              return (
                <Link
                  key={tab.to}
                  to={tab.to}
                  className={
                    active
                      ? 'px-4 py-1.5 rounded-full text-sm font-bold bg-brand-500 text-white shadow-soft transition-colors'
                      : 'px-4 py-1.5 rounded-full text-sm font-bold text-stone-600 hover:bg-brand-100 transition-colors'
                  }
                >
                  {tab.label}
                </Link>
              )
            })}
          </nav>
          <div className="ml-auto">
            <AuthArea />
          </div>
        </div>
      </header>
      <main className="flex-1">
        <Outlet />
      </main>
    </div>
  )
}

export default AppShell
