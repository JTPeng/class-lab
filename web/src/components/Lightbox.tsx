import { useEffect } from 'react'

type LightboxProps = {
  url: string
  alt?: string
  onClose: () => void
}

// 全屏遮罩查看大图：点击背景/关闭按钮/Esc 关闭
function Lightbox({ url, alt, onClose }: LightboxProps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-6 print:hidden"
      onClick={onClose}
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="关闭"
        className="absolute right-6 top-6 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-2xl font-bold text-white transition hover:bg-white/20"
      >
        ×
      </button>
      <img
        src={url}
        alt={alt ?? ''}
        onClick={(e) => e.stopPropagation()}
        className="max-h-full max-w-full rounded-2xl shadow-2xl"
      />
    </div>
  )
}

export default Lightbox
