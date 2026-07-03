// 记忆翻牌游戏的数据与数据源接口。
// 数据源抽象成 CardSource 接口：当前使用 AI 生成的水果图（fruitCardSource），
// 也保留复用「形状配对」形状+颜色的本地实现（localCardSource）作为离线兜底。

import { COLORS, KINDS, shuffle, type ShapeKind } from './shapes';

const RAW_BASE = import.meta.env.VITE_API_BASE ?? 'http://localhost:8787';
const API_BASE = RAW_BASE.replace(/\/$/, '');

// 一张「卡面」：同一个 key 的两张卡即为可配对的一对。
// 渲染优先级：imageUrl（AI 图）→ emoji（图未就绪兜底）→ 形状+颜色（本地源）。
export interface CardFace {
  key: string; // 配对判断依据：两张卡 key 相同即匹配成功
  label: string; // 中文名，用于无障碍/提示
  imageUrl?: string; // AI 生成图形地址
  emoji?: string; // 图未就绪时的兜底图标
  kind?: ShapeKind; // 本地形状源使用
  color?: string; // 本地形状源使用
}

// 关卡对应的配对数量：第 1 关 3 对，每关 +1，最多 6 对（6→12 张牌）。
export function pairCount(level: number): number {
  return Math.min(3 + (level - 1), 6);
}

// 数据源接口：页面统一通过它取每关卡面，切换实现即可换数据来源。
export interface CardSource {
  getDeck(level: number): Promise<CardFace[]> | CardFace[];
}

// ---- 水果数据源（AI 生成图，默认使用） ----

// 游戏用到的 8 种水果（与后端 FRUIT_NAMES 保持一致）。emoji 作为图未就绪时的兜底。
const FRUITS: { name: string; emoji: string }[] = [
  { name: '苹果', emoji: '🍎' },
  { name: '香蕉', emoji: '🍌' },
  { name: '西瓜', emoji: '🍉' },
  { name: '橘子', emoji: '🍊' },
  { name: '葡萄', emoji: '🍇' },
  { name: '草莓', emoji: '🍓' },
  { name: '桃子', emoji: '🍑' },
  { name: '梨', emoji: '🍐' },
];

// 后端 AI 水果图地址（GET，服务端懒生成+缓存 png）。图未就绪时前端用 emoji 兜底。
function fruitImageUrl(name: string): string {
  return `${API_BASE}/api/fruit-image?name=${encodeURIComponent(name)}`;
}

function getFruitDeck(level: number): CardFace[] {
  const n = pairCount(level);
  return shuffle(FRUITS)
    .slice(0, n)
    .map((f) => ({
      key: f.name,
      label: f.name,
      imageUrl: fruitImageUrl(f.name),
      emoji: f.emoji,
    }));
}

// 当前使用的数据源：AI 生成的水果图。
export const fruitCardSource: CardSource = { getDeck: getFruitDeck };

// ---- 本地形状数据源（离线兜底，暂未启用） ----

function faceLabel(kind: ShapeKind, color: string): string {
  const cn = COLORS.find((c) => c.key === color)?.name ?? color;
  const kn = KINDS.find((k) => k.key === kind)?.name ?? kind;
  return `${cn}${kn}`;
}

// 本地数据源：随机取 N 个「不重复的形状+颜色组合」作为本关卡面。
function getDeck(level: number): CardFace[] {
  const n = pairCount(level);
  const combos: { kind: ShapeKind; color: string }[] = [];
  for (const k of KINDS) {
    for (const c of COLORS) {
      combos.push({ kind: k.key, color: c.key });
    }
  }
  return shuffle(combos)
    .slice(0, n)
    .map((p) => ({
      key: `${p.kind}-${p.color}`,
      kind: p.kind,
      color: p.color,
      label: faceLabel(p.kind, p.color),
    }));
}

// 本地形状数据源。
export const localCardSource: CardSource = { getDeck };
