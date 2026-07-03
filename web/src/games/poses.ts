// 「跟我做动作」的动作定义与姿态判定。
// 判定基于关节角度（与身体位置/远近/体型无关）：从 MediaPipe 的 33 个骨骼点算出每侧
// 手臂的「肘角」和「大臂抬起角」，再按各动作模板打分，得出 0–100 相似度。

const RAW_BASE = import.meta.env.VITE_API_BASE ?? 'http://localhost:8787'
const API_BASE = RAW_BASE.replace(/\/$/, '')

// MediaPipe NormalizedLandmark：x/y 归一化到 [0,1]，y 向下为正。
export interface Landmark {
  x: number
  y: number
  z?: number
  visibility?: number
}

export interface Pose {
  id: string
  name: string
  emoji: string
  hint: string // 给小朋友的动作提示
}

// id 必须与后端 POSE_DEFS 一致。
export const POSES: Pose[] = [
  { id: 'hands-up', name: '双手举高', emoji: '🙌', hint: '双手用力举过头顶！' },
  { id: 't-pose', name: '双臂平举', emoji: '✋', hint: '两只手臂向两边伸平，像个大字！' },
  { id: 'hands-hip', name: '叉腰', emoji: '🤟', hint: '两只手叉在腰上，神气一点！' },
  { id: 'one-hand-up', name: '单手举起', emoji: '🙋', hint: '举起一只手，像回答问题！' },
  { id: 'hands-head', name: '抱抱头', emoji: '🤲', hint: '两只手抱住头顶！' },
  { id: 'arms-cross', name: '双臂交叉', emoji: '🙅', hint: '两只手臂在胸前交叉成 X！' },
]

// 第 level 关（从 1 开始）要模仿的动作，超出后循环。
export function poseForLevel(level: number): Pose {
  return POSES[(level - 1) % POSES.length]
}

export function poseImageUrl(pose: Pose): string {
  return `${API_BASE}/api/pose-image?id=${encodeURIComponent(pose.id)}`
}

// BlazePose 33 点里用到的下标。
const L = { shoulder: 11, elbow: 13, wrist: 15 }
const R = { shoulder: 12, elbow: 14, wrist: 16 }

// 三点 A-B-C 在 B 处的夹角（度）。手臂伸直≈180，弯曲≈90。
function angleAt(a: Landmark, b: Landmark, c: Landmark): number {
  const v1x = a.x - b.x, v1y = a.y - b.y
  const v2x = c.x - b.x, v2y = c.y - b.y
  const dot = v1x * v2x + v1y * v2y
  const m1 = Math.hypot(v1x, v1y), m2 = Math.hypot(v2x, v2y)
  if (m1 === 0 || m2 === 0) return 0
  const cos = Math.min(1, Math.max(-1, dot / (m1 * m2)))
  return (Math.acos(cos) * 180) / Math.PI
}

// 大臂相对「竖直向下」的抬起角：0=垂手，90=水平，180=举过头。
function elevation(shoulder: Landmark, elbow: Landmark): number {
  const vx = elbow.x - shoulder.x, vy = elbow.y - shoulder.y
  const m = Math.hypot(vx, vy)
  if (m === 0) return 0
  const cos = Math.min(1, Math.max(-1, vy / m)) // 与向下向量 (0,1) 的夹角
  return (Math.acos(cos) * 180) / Math.PI
}

interface Features {
  valid: boolean
  leftElbow: number
  rightElbow: number
  leftRaise: number
  rightRaise: number
  leftWristAbove: boolean
  rightWristAbove: boolean
  crossed: boolean
}

function extract(lm: Landmark[]): Features {
  const need = [L.shoulder, L.elbow, L.wrist, R.shoulder, R.elbow, R.wrist]
  const valid = lm.length >= 33 && need.every((i) => (lm[i]?.visibility ?? 1) > 0.5)
  const ls = lm[L.shoulder], le = lm[L.elbow], lw = lm[L.wrist]
  const rs = lm[R.shoulder], re = lm[R.elbow], rw = lm[R.wrist]
  return {
    valid,
    leftElbow: valid ? angleAt(ls, le, lw) : 0,
    rightElbow: valid ? angleAt(rs, re, rw) : 0,
    leftRaise: valid ? elevation(ls, le) : 0,
    rightRaise: valid ? elevation(rs, re) : 0,
    leftWristAbove: valid ? lw.y < ls.y : false,
    rightWristAbove: valid ? rw.y < rs.y : false,
    // 手腕左右次序相对肩膀左右次序反号 → 双臂交叉。
    crossed: valid ? Math.sign(lw.x - rw.x) !== Math.sign(ls.x - rs.x) : false,
  }
}

// target±tol 内线性得分 0..1。
function near(v: number, target: number, tol: number): number {
  return Math.max(0, 1 - Math.abs(v - target) / tol)
}

function avg(...xs: number[]): number {
  return xs.reduce((a, b) => a + b, 0) / xs.length
}

// 返回 0–100 相似度。未检测到有效人体时为 0。
export function scorePose(landmarks: Landmark[] | undefined, pose: Pose): number {
  if (!landmarks) return 0
  const f = extract(landmarks)
  if (!f.valid) return 0
  let s = 0
  switch (pose.id) {
    case 'hands-up':
      s = avg(near(f.leftRaise, 175, 40), near(f.rightRaise, 175, 40), near(f.leftElbow, 170, 50), near(f.rightElbow, 170, 50))
      break
    case 't-pose':
      s = avg(near(f.leftRaise, 90, 30), near(f.rightRaise, 90, 30), near(f.leftElbow, 170, 45), near(f.rightElbow, 170, 45))
      break
    case 'hands-hip':
      s = avg(near(f.leftElbow, 95, 45), near(f.rightElbow, 95, 45), near(f.leftRaise, 45, 40), near(f.rightRaise, 45, 40))
      break
    case 'one-hand-up': {
      // 一只手举高伸直、另一只手垂下；左右任一侧满足都算对。
      const oneUp = (upRaise: number, upElbow: number, downRaise: number) =>
        avg(near(upRaise, 175, 40), near(upElbow, 170, 50), near(downRaise, 10, 40))
      s = Math.max(oneUp(f.leftRaise, f.leftElbow, f.rightRaise), oneUp(f.rightRaise, f.rightElbow, f.leftRaise))
      break
    }
    case 'hands-head': {
      // 双手举到头顶：手腕高于肩、大臂高抬、肘部弯曲。
      const base = avg(near(f.leftElbow, 55, 45), near(f.rightElbow, 55, 45), near(f.leftRaise, 150, 45), near(f.rightRaise, 150, 45))
      s = base * (f.leftWristAbove && f.rightWristAbove ? 1 : 0.3)
      break
    }
    case 'arms-cross': {
      // 胸前交叉：手腕左右次序交换、肘部弯曲、大臂偏水平。
      const base = avg(near(f.leftElbow, 80, 50), near(f.rightElbow, 80, 50), near(f.leftRaise, 70, 45), near(f.rightRaise, 70, 45))
      s = base * (f.crossed ? 1 : 0.3)
      break
    }
    default:
      s = 0
  }
  return Math.round(s * 100)
}
