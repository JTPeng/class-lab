// 形状配对游戏的数据与图形定义。
// 图形用「形状 kind + 颜色 color」两个属性描述，SVG 渲染时按 kind 取路径、按 color 上色。
// 数据源抽象成 ShapeSource 接口，当前用本地实现，后期可无缝换成 AI 生成（见文件末尾）。

export type ShapeKind =
  | 'circle'
  | 'square'
  | 'triangle'
  | 'star'
  | 'heart'
  | 'hexagon'
  | 'diamond';

export interface ShapeSpec {
  id: string; // 唯一标识，用于跟踪匹配状态
  kind: ShapeKind;
  color: string; // 颜色 key，见 COLORS
  label: string; // 中文名，如「红色圆形」，用于无障碍/提示
}

export interface Round {
  pairs: ShapeSpec[]; // 本关要匹配的图形集合
}

// 可用颜色：key 用于匹配判断，hex 用于渲染，name 用于中文 label。
export const COLORS: { key: string; hex: string; name: string }[] = [
  { key: 'red', hex: '#ef4444', name: '红色' },
  { key: 'orange', hex: '#f97316', name: '橙色' },
  { key: 'yellow', hex: '#f59e0b', name: '黄色' },
  { key: 'green', hex: '#22c55e', name: '绿色' },
  { key: 'blue', hex: '#3b82f6', name: '蓝色' },
  { key: 'purple', hex: '#a855f7', name: '紫色' },
];

// 可用形状：key 用于匹配判断，name 用于中文 label。
export const KINDS: { key: ShapeKind; name: string }[] = [
  { key: 'circle', name: '圆形' },
  { key: 'square', name: '方形' },
  { key: 'triangle', name: '三角形' },
  { key: 'star', name: '星形' },
  { key: 'heart', name: '心形' },
  { key: 'hexagon', name: '六边形' },
  { key: 'diamond', name: '菱形' },
];

export function colorHex(key: string): string {
  return COLORS.find((c) => c.key === key)?.hex ?? '#94a3b8';
}

function kindName(key: ShapeKind): string {
  return KINDS.find((k) => k.key === key)?.name ?? key;
}

function colorName(key: string): string {
  return COLORS.find((c) => c.key === key)?.name ?? key;
}

// Fisher-Yates 洗牌，返回新数组。
export function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// 关卡对应的配对数量：第 1 关 3 对，每关 +1，最多 6 对。
export function pairCount(level: number): number {
  return Math.min(3 + (level - 1), 6);
}

// 本地数据源：随机取 N 个「不重复的形状+颜色组合」作为本关图形。
function getRound(level: number): Round {
  const n = pairCount(level);
  // 生成所有 形状×颜色 组合再打乱取前 N 个，保证组合唯一。
  const combos: { kind: ShapeKind; color: string }[] = [];
  for (const k of KINDS) {
    for (const c of COLORS) {
      combos.push({ kind: k.key, color: c.key });
    }
  }
  const picked = shuffle(combos).slice(0, n);
  const pairs: ShapeSpec[] = picked.map((p, i) => ({
    id: `${p.kind}-${p.color}-${i}`,
    kind: p.kind,
    color: p.color,
    label: `${colorName(p.color)}${kindName(p.kind)}`,
  }));
  return { pairs };
}

// 数据源接口：页面统一通过它取每关图形，切换实现即可换数据来源。
export interface ShapeSource {
  getRound(level: number): Promise<Round> | Round;
}

// 当前使用的本地数据源。
export const localShapeSource: ShapeSource = { getRound };

// TODO: 后期接入 AI —— 保持同一 ShapeSource 签名，页面无需改动即可切换。
// export const aiShapeSource: ShapeSource = {
//   async getRound(level) {
//     const res = await fetch(`/api/shapes?level=${level}`)
//     const data = (await res.json()) as { kind: ShapeKind; color: string }[]
//     return {
//       pairs: data.map((p, i) => ({
//         id: `${p.kind}-${p.color}-${i}`,
//         kind: p.kind,
//         color: p.color,
//         label: `${colorName(p.color)}${kindName(p.kind)}`,
//       })),
//     }
//   },
// }
