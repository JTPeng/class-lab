import { Link, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import LoginScreen from '../auth/LoginScreen'

// 顶部常驻切换菜单（DTT 暖色风格）。两个 Tab 在「DTT 教案」与「绘本打卡」两个模块间切换，
// 结构可扩展第三个项目。下方 <Outlet/> 渲染当前模块页面。
const tabs = [
  {
    label: 'DTT 教案',
    to: '/',
    match: (p: string) =>
      !p.startsWith('/picture-book') && !p.startsWith('/games') && !p.startsWith('/video'),
  },
  { label: '绘本打卡', to: '/picture-book', match: (p: string) => p.startsWith('/picture-book') },
  { label: '游戏乐园', to: '/games', match: (p: string) => p.startsWith('/games') },
  { label: '视频分析', to: '/video', match: (p: string) => p.startsWith('/video') },
]

// 头部登录态：全局门禁下未登录不会渲染到这里，故只展示「用户名 + 退出」。
function AuthArea() {
  const { user, logout } = useAuth()
  if (!user) return null
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

function AppShell() {
  const { pathname } = useLocation()
  const { user } = useAuth()

  // 全局门禁：未登录只显示登录页，不渲染菜单与任何模块。
  if (!user) return <LoginScreen />

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
