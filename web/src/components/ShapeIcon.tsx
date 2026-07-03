import { colorHex, type ShapeKind } from '../games/shapes'

// 统一的 SVG 图形渲染。图块与槽位共用同一套形状路径：
// - variant='solid'：彩色实心图块（可拖拽的）
// - variant='outline'：灰色空心轮廓（目标槽位）

// 每种形状在 100×100 viewBox 内的画法。
function renderShape(kind: ShapeKind, fill: string, stroke: string, strokeWidth: number) {
  const common = { fill, stroke, strokeWidth, strokeLinejoin: 'round' as const }
  switch (kind) {
    case 'circle':
      return <circle cx="50" cy="50" r="42" {...common} />
    case 'square':
      return <rect x="10" y="10" width="80" height="80" rx="10" {...common} />
    case 'triangle':
      return <polygon points="50,10 92,88 8,88" {...common} />
    case 'diamond':
      return <polygon points="50,8 92,50 50,92 8,50" {...common} />
    case 'star':
      return (
        <polygon
          points="50,6 61,38 95,38 67,58 78,92 50,71 22,92 33,58 5,38 39,38"
          {...common}
        />
      )
    case 'heart':
      return (
        <path
          d="M50 88 L16 52 C4 40 8 18 26 16 C38 14 47 24 50 30 C53 24 62 14 74 16 C92 18 96 40 84 52 Z"
          {...common}
        />
      )
    case 'hexagon':
      return <polygon points="50,8 88,29 88,71 50,92 12,71 12,29" {...common} />
    default:
      return null
  }
}

interface ShapeIconProps {
  kind: ShapeKind
  color: string
  variant: 'solid' | 'outline'
  size?: number
}

function ShapeIcon({ kind, color, variant, size = 72 }: ShapeIconProps) {
  if (variant === 'outline') {
    // 槽位：淡色轮廓，隐约暗示目标颜色，实心留白。
    return (
      <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden>
        {renderShape(kind, '#f8fafc', colorHex(color), 3)}
      </svg>
    )
  }
  // 图块：彩色实心，白描边更立体。
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden>
      {renderShape(kind, colorHex(color), '#ffffff', 3)}
    </svg>
  )
}

export default ShapeIcon
