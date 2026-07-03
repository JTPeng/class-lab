import { describe, expect, it } from 'vitest';
import {
  ALLOWED_SIZES,
  MAX_PAGES,
  STYLE_PROMPTS,
  buildScenePrompt,
  normalizeOptions,
  parseScenes,
} from './picturebook.js';

describe('parseScenes', () => {
  it('解析字符串数组', () => {
    expect(parseScenes('["场景一","场景二"]')).toEqual(['场景一', '场景二']);
  });

  it('解析对象数组（scene 字段）并提取文本', () => {
    expect(parseScenes('[{"scene":"日出"},{"scene":"日落"}]')).toEqual(['日出', '日落']);
  });

  it('从夹带多余文字的内容中提取 JSON 数组', () => {
    expect(parseScenes('这是分镜：["a","b"] 完成')).toEqual(['a', 'b']);
  });

  it('过滤空白项', () => {
    expect(parseScenes('["有效","","  "]')).toEqual(['有效']);
  });

  it('无法解析时返回 null', () => {
    expect(parseScenes('完全不是 JSON')).toBeNull();
    expect(parseScenes('[]')).toBeNull();
  });
});

describe('normalizeOptions', () => {
  it('页数限制在 1~MAX_PAGES', () => {
    expect(normalizeOptions({ n: 0 }).pages).toBe(1);
    expect(normalizeOptions({ n: 99 }).pages).toBe(MAX_PAGES);
    expect(normalizeOptions({ n: 3 }).pages).toBe(3);
  });

  it('非法/缺失页数回退为 1', () => {
    expect(normalizeOptions({ n: undefined }).pages).toBe(1);
    expect(normalizeOptions({ n: 'abc' }).pages).toBe(1);
  });

  it('尺寸走白名单，非法回退默认 1024*1024', () => {
    expect(normalizeOptions({ size: '720*1280' }).size).toBe('720*1280');
    expect(normalizeOptions({ size: '999*999' }).size).toBe('1024*1024');
    expect(normalizeOptions({}).size).toBe('1024*1024');
    for (const size of ALLOWED_SIZES) {
      expect(normalizeOptions({ size }).size).toBe(size);
    }
  });
});

describe('buildScenePrompt', () => {
  it('已知画风使用对应前缀，并包含书名与场景', () => {
    const prompt = buildScenePrompt('好饿的毛毛虫', '毛毛虫啃苹果', 'watercolor');
    expect(prompt).toContain(STYLE_PROMPTS.watercolor);
    expect(prompt).toContain('好饿的毛毛虫');
    expect(prompt).toContain('毛毛虫啃苹果');
    expect(prompt).toContain('不要出现任何文字');
  });

  it('未知/缺失画风回退到 storybook 前缀', () => {
    expect(buildScenePrompt('书', '场景', 'unknown')).toContain(STYLE_PROMPTS.storybook);
    expect(buildScenePrompt('书', '场景')).toContain(STYLE_PROMPTS.storybook);
  });
});
