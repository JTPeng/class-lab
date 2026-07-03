// 绘本打卡前端选项。契约：以下取值必须与后端 serve/src/ai/picturebook.ts 对齐，
// 否则前端选项会被后端静默回退：
//   - styles[].id  ∈ STYLE_PROMPTS
//   - ratios[].size ∈ ALLOWED_SIZES
//   - counts        ≤ MAX_PAGES(4)

export interface StyleOption {
  id: string;
  name: string;
}

export interface RatioOption {
  id: string;
  name: string;
  size: string;
}

export const styles: StyleOption[] = [
  { id: 'storybook', name: '儿童绘本' },
  { id: 'watercolor', name: '水彩' },
  { id: 'cyberpunk', name: '赛博朋克' },
  { id: 'render3d', name: '3D 渲染' },
  { id: 'pixel', name: '像素' },
];

export const counts: number[] = [2, 3, 4];

export const ratios: RatioOption[] = [
  { id: 'square', name: '方形', size: '1024*1024' },
  { id: 'portrait', name: '竖版', size: '720*1280' },
  { id: 'landscape', name: '横版', size: '1280*720' },
];
