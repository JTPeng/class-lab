// 动物数据：emoji + 名称 + 谜语句。
// 谜语句交给后端 qwen-tts（阿里百炼）真人音色朗读，玩家听谜语猜动物。
// 谜语里带上拟声词但不直接说名字。

const RAW_BASE = import.meta.env.VITE_API_BASE ?? 'http://localhost:8787'
const API_BASE = RAW_BASE.replace(/\/$/, '')

export interface Animal {
  name: string // 动物名
  emoji: string // 展示图标
  riddle: string // 谜语句，交给 AI 语音朗读（不含动物名）
}

export const ANIMALS: Animal[] = [
  { name: '小猫', emoji: '🐱', riddle: '喵喵喵，我爱抓老鼠，胡子长长最爱睡觉，猜猜我是谁？' },
  { name: '小狗', emoji: '🐶', riddle: '汪汪汪，我最忠诚会看家，爱啃骨头爱摇尾巴，我是谁呀？' },
  { name: '奶牛', emoji: '🐮', riddle: '哞——，我身上有黑白花纹，能挤出香香的牛奶，猜猜我是谁？' },
  { name: '绵羊', emoji: '🐑', riddle: '咩咩咩，我全身白白软软的毛，最爱在草地上吃青草，我是谁？' },
  { name: '公鸡', emoji: '🐔', riddle: '喔喔喔，每天早上我第一个打鸣，叫醒大家起床，猜猜我是谁？' },
  { name: '鸭子', emoji: '🦆', riddle: '嘎嘎嘎，我有扁扁的嘴巴，最喜欢在水里游泳，我是谁？' },
  { name: '青蛙', emoji: '🐸', riddle: '呱呱呱，我爱蹲在荷叶上，专门抓小虫子吃，猜猜我是谁？' },
  { name: '小猪', emoji: '🐷', riddle: '哼哼哼，我有圆圆的鼻子胖胖的身体，最爱吃饭和睡觉，我是谁？' },
  { name: '老虎', emoji: '🐯', riddle: '嗷呜——，我是森林里的大王，身上有花纹吼声很响，猜猜我是谁？' },
  { name: '大象', emoji: '🐘', riddle: '我有长长的鼻子和大大的耳朵，是陆地上最大的动物，我是谁？' },
  { name: '猴子', emoji: '🐵', riddle: '吱吱吱，我最爱爬树吃香蕉，又调皮又灵活，猜猜我是谁？' },
  { name: '小马', emoji: '🐴', riddle: '咴咴咴，我跑得飞快，人们可以骑在我背上，我是谁？' },
]

// 后端 TTS 音频地址（GET，服务端按文本缓存 wav）。
export function riddleAudioUrl(animal: Animal): string {
  return `${API_BASE}/api/tts?text=${encodeURIComponent(animal.riddle)}`
}

// 后端 AI 动物图地址（GET，服务端懒生成+缓存 png）。图未就绪时前端用 emoji 兜底。
export function animalImageUrl(animal: Animal): string {
  return `${API_BASE}/api/animal-image?name=${encodeURIComponent(animal.name)}`
}

// 全局单例，保证同一时刻只播一个音频。
let currentAudio: HTMLAudioElement | null = null

// 播放某动物的谜语语音。Promise 在播放结束（或失败）时 resolve。
export function playRiddle(animal: Animal): Promise<void> {
  if (currentAudio) {
    currentAudio.pause()
    currentAudio = null
  }
  const audio = new Audio(riddleAudioUrl(animal))
  currentAudio = audio
  return new Promise<void>((resolve) => {
    audio.onended = () => resolve()
    audio.onerror = () => resolve()
    audio.play().catch(() => resolve())
  })
}

// Fisher-Yates 洗牌，返回新数组。
export function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}
