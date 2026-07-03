import type { Target } from '../types/lesson'

// refKey 约定：`target:${idx}`，目标清单配图与新建教案时的批量预生成共用同一套约定。
export function targetRefKey(idx: number): string {
  return `target:${idx}`
}

export function buildTargetImagePrompt(target: Target, skill: string): string {
  return `${target.target}（${skill}），儿童教具风格插画，简洁卡通，白色背景，色彩明亮`
}
