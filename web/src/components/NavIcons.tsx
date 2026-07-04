type IconProps = { className?: string }

// 底部导航图标集：统一 24x24、2px 圆头线条风格，颜色随外部 currentColor 继承。
export function LessonIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <rect x="5" y="3.5" width="14" height="17" rx="2" stroke="currentColor" strokeWidth="2" />
      <path d="M9 2.5h6a1 1 0 0 1 1 1v1a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1v-1a1 1 0 0 1 1-1Z" fill="currentColor" />
      <path d="M8.5 11h7M8.5 14.5h7M8.5 18h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

export function PictureBookIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <path
        d="M12 6.5c-1.6-1.3-3.6-2-5.5-2A4.6 4.6 0 0 0 4 5.2v12.6c1-.6 2.2-1 3.5-1 1.8 0 3.5.6 4.5 1.5m0-11.8c1.6-1.3 3.6-2 5.5-2A4.6 4.6 0 0 1 20 5.2v12.6c-1-.6-2.2-1-3.5-1-1.8 0-3.5.6-4.5 1.5m0-11.8v11.8"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function GameIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <path
        d="M7.5 8.5h9a4 4 0 0 1 3.9 4.9l-.6 2.6a2.6 2.6 0 0 1-4.6 1.1L14 15.5h-4l-1.2 1.6a2.6 2.6 0 0 1-4.6-1.1l-.6-2.6a4 4 0 0 1 3.9-4.9Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path d="M8 11v2M7 12h2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="16" cy="11.3" r="0.9" fill="currentColor" />
      <circle cx="14.3" cy="13" r="0.9" fill="currentColor" />
    </svg>
  )
}

export function VideoIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <rect x="3.5" y="6.5" width="12" height="11" rx="2" stroke="currentColor" strokeWidth="2" />
      <path
        d="m15.5 10.3 4.1-2.4a.8.8 0 0 1 1.2.7v6.8a.8.8 0 0 1-1.2.7l-4.1-2.4"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
    </svg>
  )
}
