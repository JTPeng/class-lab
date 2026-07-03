import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { api, type AuthUser } from '../api/client'
import { hydrateProgress } from '../games/storage'

// 轻量登录态：当前用户存 localStorage('clab_user')，刷新后仍在。
// 登录成功后从后端 hydrate 游戏进度到本地缓存。
const USER_KEY = 'clab_user'

interface AuthState {
  user: AuthUser | null
  login: (username: string) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthState | null>(null)

function readStored(): AuthUser | null {
  try {
    const raw = localStorage.getItem(USER_KEY)
    return raw ? (JSON.parse(raw) as AuthUser) : null
  } catch {
    return null
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(() => readStored())

  // 已有登录态时，进入应用即从后端刷新一次进度。
  useEffect(() => {
    if (user) void hydrateProgress(user.id)
    // 仅在首次挂载按已存用户 hydrate 一次
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function login(username: string): Promise<void> {
    const u = await api.login(username)
    localStorage.setItem(USER_KEY, JSON.stringify(u))
    setUser(u)
    await hydrateProgress(u.id)
  }

  function logout(): void {
    localStorage.removeItem(USER_KEY)
    setUser(null)
  }

  return <AuthContext.Provider value={{ user, login, logout }}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth 必须在 AuthProvider 内使用')
  return ctx
}
