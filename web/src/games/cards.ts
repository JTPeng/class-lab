// 记忆翻牌游戏的数据与数据源接口。
// 卡面复用「形状配对」的形状+颜色体系（见 shapes.ts），零新增素材、风格统一。
// 数据源抽象成 CardSource 接口，当前用本地实现，后期可无缝换成 AI 生成图形（见文件末尾）。

import { COLORS, KINDS, shuffle, type ShapeKind } from './shapes';

// 一张「卡面」：同一个 key 的两张卡即为可配对的一对。
// imageUrl 预留给后期 AI 生成图形——渲染时若有图则优先用图，否则回退到形状+颜色。
export interface CardFace {
  key: string; // 配对判断依据：两张卡 key 相同即匹配成功
  kind: ShapeKind;
  color: string;
  label: string; // 中文名，如「红色圆形」，用于无障碍/提示
  imageUrl?: string; // 可选：AI 生成图形地址
}

// 关卡对应的配对数量：第 1 关 3 对，每关 +1，最多 6 对（6→12 张牌）。
export function pairCount(level: number): number {
  return Math.min(3 + (level - 1), 6);
}

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

// 数据源接口：页面统一通过它取每关卡面，切换实现即可换数据来源。
export interface CardSource {
  getDeck(level: number): Promise<CardFace[]> | CardFace[];
}

// 当前使用的本地数据源。
export const localCardSource: CardSource = { getDeck };

// TODO: 后期接入 AI —— 保持同一 CardSource 签名，页面无需改动即可切换。
// 返回的卡面可带 imageUrl（AI 生成的图形），页面优先渲染图片、否则用形状+颜色。
// export const aiCardSource: CardSource = {
//   async getDeck(level) {
//     const res = await fetch(`/api/cards?level=${level}`)
//     const data = (await res.json()) as { key: string; kind: ShapeKind; color: string; imageUrl?: string }[]
//     return data.map((p) => ({
//       key: p.key,
//       kind: p.kind,
//       color: p.color,
//       label: faceLabel(p.kind, p.color),
//       imageUrl: p.imageUrl,
//     }))
//   },
// }
