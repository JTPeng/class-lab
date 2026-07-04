import { useEffect, useRef, useState } from 'react'

type ThemeOption = {
  key: string
  label: string
  swatch: string
  googleFont?: string
}

const THEMES: ThemeOption[] = [
  { key: 'default', label: '现有暖橙', swatch: '#F97316' },
  { key: 'style-1', label: '低感官负荷', swatch: '#4C8C86', googleFont: 'Inter:wght@400;500;600' },
  { key: 'style-2', label: '温和绘本插画', swatch: '#E8905C', googleFont: 'Baloo+2:wght@500;700' },
  { key: 'style-3', label: '纸艺拼贴', swatch: '#C1553B', googleFont: 'Kalam:wght@400;700' },
  { key: 'style-4', label: '游戏化学习', swatch: '#7C5CFC', googleFont: 'Fredoka:wght@500;700' },
  { key: 'style-5', label: '专业可信', swatch: '#2F6FED' },
]

const STORAGE_KEY = 'cl-theme'
const FONT_LINK_ID = 'cl-theme-preview-fonts'

function ensureFontsLoaded() {
  if (document.getElementById(FONT_LINK_ID)) return
  const families = THEMES.filter((t) => t.googleFont).map((t) => `family=${t.googleFont}`)
  const link = document.createElement('link')
  link.id = FONT_LINK_ID
  link.rel = 'stylesheet'
  link.href = `https://fonts.googleapis.com/css2?${families.join('&')}&display=swap`
  document.head.appendChild(link)
}

function applyTheme(key: string) {
  if (key === 'default') {
    delete document.documentElement.dataset.theme
  } else {
    document.documentElement.dataset.theme = key
  }
  localStorage.setItem(STORAGE_KEY, key)
}

function ThemeSwitcher() {
  const [active, setActive] = useState('default')
  const [open, setOpen] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    ensureFontsLoaded()
    const saved = localStorage.getItem(STORAGE_KEY) ?? 'default'
    applyTheme(saved)
    setActive(saved)
  }, [])

  useEffect(() => {
    if (!open) return
    function handleOutsideClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleOutsideClick)
    document.addEventListener('touchstart', handleOutsideClick)
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick)
      document.removeEventListener('touchstart', handleOutsideClick)
    }
  }, [open])

  if (!open) {
    const activeSwatch = THEMES.find((t) => t.key === active)?.swatch ?? THEMES[0].swatch
    return (
      <button
        type="button"
        title="主题预览切换"
        onClick={() => setOpen(true)}
        className="fixed bottom-24 right-4 md:bottom-4 z-[100] h-9 w-9 rounded-full bg-white/95 shadow-lg ring-1 ring-black/10 flex items-center justify-center"
      >
        <span className="h-4 w-4 rounded-full" style={{ backgroundColor: activeSwatch }} />
      </button>
    )
  }

  return (
    <div
      ref={panelRef}
      className="fixed bottom-24 right-4 md:bottom-4 z-[100] flex flex-col gap-1 rounded-2xl bg-white/95 p-2 shadow-lg ring-1 ring-black/10"
    >
      <button
        type="button"
        onClick={() => setOpen(false)}
        className="flex items-center justify-end px-2 text-xs font-bold text-stone-400 hover:text-stone-600 transition-colors"
      >
        收起 ✕
      </button>
      {THEMES.map((theme) => (
        <button
          key={theme.key}
          type="button"
          title={theme.label}
          onClick={() => {
            applyTheme(theme.key)
            setActive(theme.key)
            setOpen(false)
          }}
          className={
            active === theme.key
              ? 'flex items-center gap-2 rounded-full px-2 py-1 text-xs font-bold bg-stone-900 text-white'
              : 'flex items-center gap-2 rounded-full px-2 py-1 text-xs font-bold text-stone-600 hover:bg-stone-100 transition-colors'
          }
        >
          <span className="h-3 w-3 rounded-full" style={{ backgroundColor: theme.swatch }} />
          {theme.label}
        </button>
      ))}
    </div>
  )
}

export default ThemeSwitcher
