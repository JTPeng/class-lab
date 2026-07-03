// 影子配对游戏的数据源。角色复用「听声音猜动物」的 AI 动物图（/api/animal-image）。
// 数据源抽象成 ShadowSource 接口，当前用本地实现（固定动物名单），
// 后期可换成「AI 动态挑选/生成新角色」的实现，页面无需改动。

import { ANIMALS, animalImageUrl, shuffle, type Animal } from './animals'

// 影子玩法靠外形轮廓辨识，从 12 种里挑外形鲜明、主体非白的动物
// （白色主体如绵羊/鸭子/公鸡/奶牛，抠白底后剪影会残缺，故排除）。
const SHADOW_NAMES = ['小猫', '小狗', '大象', '老虎', '青蛙', '小猪', '猴子', '小马']

export const SHADOW_ANIMALS: Animal[] = ANIMALS.filter((a) => SHADOW_NAMES.includes(a.name))

// 关卡对应的配对数量：第 1 关 3 只，每关 +1，最多 6 只。
export function pairCount(level: number): number {
  return Math.min(3 + (level - 1), 6)
}

export interface Round {
  animals: Animal[]
}

// 数据源接口：页面统一通过它取每关角色，切换实现即可换数据来源。
export interface ShadowSource {
  getRound(level: number): Promise<Round> | Round
}

function getRound(level: number): Round {
  const n = pairCount(level)
  return { animals: shuffle(SHADOW_ANIMALS).slice(0, n) }
}

// 当前使用的本地数据源。
export const localShadowSource: ShadowSource = { getRound }

export { animalImageUrl, shuffle }
export type { Animal }

// TODO: 后期接入 AI —— 保持同一 ShadowSource 签名，例如让 AI 每关生成一批新角色名
// 并复用 /api/animal-image 生成图片，页面无需改动即可切换。
