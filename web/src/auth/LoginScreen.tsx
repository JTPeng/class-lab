import { useState } from 'react'
import { useAuth } from './AuthContext'

// 全局登录门禁：未登录时占满整屏，登录后（login 内部会整页刷新）进入应用。
function LoginScreen() {
  const { login } = useAuth()
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed || busy) return
    setBusy(true)
    setError('')
    try {
      await login(trimmed)
    } catch {
      setError('登录失败，请稍后重试')
      setBusy(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-brand-50 via-brand-100/60 to-brand-50 px-4">
      <div className="w-full max-w-sm bg-white rounded-3xl shadow-card ring-1 ring-brand-100 p-8 text-center">
        <div className="text-5xl mb-3">🎓</div>
        <h1 className="text-2xl font-black text-stone-900 mb-1">
          Class-<span className="text-brand-500">Lab</span>
        </h1>
        <p className="text-sm text-stone-600 mb-6">请先登录后使用</p>
        <form onSubmit={submit} className="space-y-3">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="输入用户名"
            autoFocus
            className="w-full px-4 py-2.5 rounded-full border border-brand-200 text-center focus:outline-none focus:ring-2 focus:ring-brand-300"
          />
          <button
            type="submit"
            disabled={busy || !name.trim()}
            className="w-full py-2.5 rounded-full font-bold bg-brand-500 text-white disabled:opacity-40 hover:bg-brand-600 transition-colors"
          >
            {busy ? '登录中…' : '登录'}
          </button>
          {error && <p className="text-sm text-red-500">{error}</p>}
        </form>
      </div>
    </div>
  )
}

export default LoginScreen
