# 主题预览切换器 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 `web/` 前端加一个仅开发环境可见的悬浮切换器，能一键在 6 套配色/圆角/阴影/字体主题（现有暖橙 + 5 个候选风格）之间切换，方便在真实页面上对比选型。

**Architecture:** CSS 自定义属性 + `<html data-theme="...">` 属性。`tailwind.config.js` 把 `brand.*`、`cream`、`stone.900`、`borderRadius.{lg,xl,2xl,3xl}`、`boxShadow.{soft,card}`、`fontFamily.sans` 全部指向 `var(--xxx)`；`index.css` 用 `:root` 与 `[data-theme="style-N"]` 分别定义这些变量的 6 组取值。页面/组件的 className 不需要任何改动。

**Tech Stack:** React + TypeScript + Vite + Tailwind CSS v3.4（既有栈，不引入新依赖；字体通过运行时动态插入 Google Fonts `<link>` 加载）。

## Global Constraints

- 本项目 Slice 2+ 约定不新增测试文件，验证方式是 `npm run build` 通过 + 控制者用浏览器（或 chrome-devtools MCP）肉眼 E2E 核对，每个任务的验证步骤都遵循这一约定，不写 test。
- 切换器只在 `import.meta.env.DEV` 为真时渲染，生产构建 (`npm run build`) 不应包含它。
- 只新增/修改本计划列出的文件，不改动其它组件的 className。
- 所有颜色/圆角/阴影取值以 `docs/superpowers/specs/2026-07-03-theme-preview-switcher-design.md` 中的设计意图为准；本计划中据此展开出的具体色阶、阴影字符串、字体选择属于实施细节，与设计文档的方向描述一致即可，无需逐字匹配。
- `brand.*`/`cream`/`stone.900` 对应的 CSS 变量必须存成 RGB 通道三元组（如 `--color-brand-500: 249 115 22;`），并在 `tailwind.config.js` 中用 `rgb(var(--color-brand-500) / <alpha-value>)` 引用，不能写成裸的十六进制字符串 `var(--color-brand-500)`。原因：项目里大量使用 Tailwind 的透明度修饰符（`bg-cream/95`、`bg-stone-900/40`、`via-brand-100/60` 等，分布在 `AppShell.tsx`、`PictureBook.tsx`、`PoseMimic.tsx`、`poster/Hero.tsx`、`poster/Badge.tsx` 及 10+ 页面的渐变），裸十六进制 `var()` 值会让 Tailwind JIT 无法生成这些透明度类，导致对应位置完全不透明/样式丢失且构建不报错。`--radius-*`、`--shadow-*`、`--font-sans` 不涉及透明度修饰符，按原方式存字符串即可。
- `borderRadius` 主题化只覆盖实际有使用量的 4 个 key：`lg`（5 处使用）、`xl`（26 处）、`2xl`（52 处）、`3xl`（1 处）；`full`（84 处，用于圆形/胶囊按钮）与 `sm`/`md`/`none`/`DEFAULT` 不做主题化，保持 Tailwind 原生值，避免圆形按钮变形。
- "文字"主题化只覆盖 `stone.900`（标题级强调色），不覆盖 `stone.50`~`stone.800`（次级文字/边框保持中性灰阶不变），避免大范围改变次级文案的可读性。

---

### Task 1: Tailwind 配置改为读取 CSS 变量 + 建立零视觉差异的默认变量基线

**Files:**
- Modify: `web/tailwind.config.js`
- Modify: `web/src/index.css`

**Interfaces:**
- Produces：CSS 变量名约定 `--color-brand-{50..900}`、`--color-cream`、`--color-text-strong`、`--radius-{lg,xl,2xl,3xl}`、`--shadow-{soft,card}`、`--font-sans`，后续任务据此命名。

- [ ] **Step 1: 修改 `web/tailwind.config.js`**

把整个文件替换为：

```js
import colors from 'tailwindcss/colors'

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // 主题化色板：色阶数值由 CSS 变量（RGB 通道三元组）提供，具体取值见 src/index.css。
        // 用 rgb(var(...) / <alpha-value>) 而不是裸的 var(...)，是为了保留 Tailwind
        // 的透明度修饰符（如 bg-cream/95、bg-stone-900/40）——裸十六进制字符串的
        // var() 值会让 Tailwind 无法为其生成透明度变体。
        brand: {
          50: 'rgb(var(--color-brand-50) / <alpha-value>)',
          100: 'rgb(var(--color-brand-100) / <alpha-value>)',
          200: 'rgb(var(--color-brand-200) / <alpha-value>)',
          300: 'rgb(var(--color-brand-300) / <alpha-value>)',
          400: 'rgb(var(--color-brand-400) / <alpha-value>)',
          500: 'rgb(var(--color-brand-500) / <alpha-value>)',
          600: 'rgb(var(--color-brand-600) / <alpha-value>)',
          700: 'rgb(var(--color-brand-700) / <alpha-value>)',
          800: 'rgb(var(--color-brand-800) / <alpha-value>)',
          900: 'rgb(var(--color-brand-900) / <alpha-value>)',
        },
        cream: 'rgb(var(--color-cream) / <alpha-value>)',
        // 只有 900（标题强调色）主题化，其余沿用 Tailwind 默认中性灰阶
        stone: {
          ...colors.stone,
          900: 'rgb(var(--color-text-strong) / <alpha-value>)',
        },
      },
      borderRadius: {
        lg: 'var(--radius-lg)',
        xl: 'var(--radius-xl)',
        '2xl': 'var(--radius-2xl)',
        '3xl': 'var(--radius-3xl)',
      },
      boxShadow: {
        soft: 'var(--shadow-soft)',
        card: 'var(--shadow-card)',
      },
      fontFamily: {
        sans: 'var(--font-sans)',
      },
    },
  },
  plugins: [],
}
```

- [ ] **Step 2: 在 `web/src/index.css` 顶部（`@tailwind utilities;` 之后、`@media print` 之前）插入默认变量块**

在现有内容基础上新增（不要删除已有的 `@tailwind` 指令和 `@media print` 块）：

```css
:root {
  --color-brand-50: 255 247 237;
  --color-brand-100: 255 237 213;
  --color-brand-200: 254 215 170;
  --color-brand-300: 253 186 116;
  --color-brand-400: 251 146 60;
  --color-brand-500: 249 115 22;
  --color-brand-600: 234 88 12;
  --color-brand-700: 194 65 12;
  --color-brand-800: 154 52 18;
  --color-brand-900: 124 45 18;
  --color-cream: 255 247 237;
  --color-text-strong: 28 25 23;
  --radius-lg: 0.5rem;
  --radius-xl: 0.75rem;
  --radius-2xl: 1rem;
  --radius-3xl: 1.5rem;
  --shadow-soft: 0 8px 24px -8px rgba(234, 88, 12, 0.18);
  --shadow-card: 0 2px 10px -2px rgba(120, 53, 15, 0.08);
  --font-sans: ui-sans-serif, system-ui, -apple-system, 'PingFang SC', 'Microsoft YaHei', sans-serif;
}
```

CSS 变量存成 RGB 通道三元组（"R G B"，不带 `#`/`rgb()`），配合 `tailwind.config.js` 里的 `rgb(var(...) / <alpha-value>)` 引用方式——这是 Tailwind 官方文档给出的、能同时支持透明度修饰符的 CSS 变量配色方案。上面每个通道三元组都是原十六进制写死值（如 `#F97316` → `249 115 22`）转换后的等值，此步骤结束后页面视觉应该零差异。

- [ ] **Step 3: 验证构建通过**

Run: `cd web && npm run build`
Expected: 构建成功，无 Tailwind/PostCSS 报错。

- [ ] **Step 4: 启动 dev server 肉眼确认无视觉差异**

Run: `cd web && npm run dev`

打开 `http://localhost:5173`，对比首页头部（暖橙色 Tab、奶油底色）、卡片阴影、圆角是否和改动前一致（应完全看不出区别，因为变量值等于原来的写死值）。

- [ ] **Step 5: Commit**

```bash
git add web/tailwind.config.js web/src/index.css
git commit -m "refactor(web): 主题色/圆角/阴影/字体改为 CSS 变量驱动"
```

---

### Task 2: 新增 5 套候选主题的 CSS 变量覆盖块

**Files:**
- Modify: `web/src/index.css`

**Interfaces:**
- Consumes：Task 1 定义的变量名集合（`--color-brand-*`、`--color-cream`、`--color-text-strong`、`--radius-*`、`--shadow-*`、`--font-sans`）。
- Produces：可通过 `document.documentElement.dataset.theme = 'style-1'`（到 `'style-5'`）激活的 5 组主题，供 Task 3 的切换器使用。

- [ ] **Step 1: 在 `:root` 块之后追加 5 个 `[data-theme]` 覆盖块**

```css
[data-theme='style-1'] {
  --color-brand-50: 242 247 246;
  --color-brand-100: 224 237 235;
  --color-brand-200: 196 222 218;
  --color-brand-300: 163 202 196;
  --color-brand-400: 125 174 167;
  --color-brand-500: 76 140 134;
  --color-brand-600: 65 122 116;
  --color-brand-700: 56 107 102;
  --color-brand-800: 44 86 82;
  --color-brand-900: 31 62 59;
  --color-cream: 247 249 248;
  --color-text-strong: 43 58 57;
  --radius-lg: 0.375rem;
  --radius-xl: 0.625rem;
  --radius-2xl: 0.875rem;
  --radius-3xl: 1.125rem;
  --shadow-soft: 0 2px 6px -2px rgba(56, 107, 102, 0.10);
  --shadow-card: 0 1px 4px -1px rgba(43, 58, 57, 0.06);
  --font-sans: 'Inter', ui-sans-serif, system-ui, -apple-system, 'PingFang SC', sans-serif;
}
[data-theme='style-1'] body {
  letter-spacing: 0.01em;
}

[data-theme='style-2'] {
  --color-brand-50: 255 248 238;
  --color-brand-100: 252 233 214;
  --color-brand-200: 248 210 174;
  --color-brand-300: 243 183 132;
  --color-brand-400: 237 162 110;
  --color-brand-500: 232 144 92;
  --color-brand-600: 218 124 72;
  --color-brand-700: 201 107 59;
  --color-brand-800: 168 83 43;
  --color-brand-900: 124 61 32;
  --color-cream: 255 248 238;
  --color-text-strong: 74 53 39;
  --radius-lg: 0.625rem;
  --radius-xl: 1rem;
  --radius-2xl: 1.375rem;
  --radius-3xl: 1.75rem;
  --shadow-soft: 0 10px 28px -10px rgba(201, 107, 59, 0.20);
  --shadow-card: 0 3px 12px -3px rgba(74, 53, 39, 0.10);
  --font-sans: 'Baloo 2', 'PingFang SC', ui-rounded, ui-sans-serif, system-ui, sans-serif;
}

[data-theme='style-3'] {
  --color-brand-50: 251 242 236;
  --color-brand-100: 244 223 210;
  --color-brand-200: 231 192 170;
  --color-brand-300: 216 157 128;
  --color-brand-400: 203 119 88;
  --color-brand-500: 193 85 59;
  --color-brand-600: 172 72 50;
  --color-brand-700: 156 63 43;
  --color-brand-800: 124 49 34;
  --color-brand-900: 92 36 25;
  --color-cream: 243 236 221;
  --color-text-strong: 58 46 34;
  --radius-lg: 0.25rem;
  --radius-xl: 0.5rem;
  --radius-2xl: 0.75rem;
  --radius-3xl: 1rem;
  --shadow-soft: 0 1px 0 rgba(58, 46, 34, 0.35), 0 6px 16px -6px rgba(58, 46, 34, 0.25);
  --shadow-card: 0 1px 0 rgba(58, 46, 34, 0.25), 0 3px 10px -3px rgba(58, 46, 34, 0.15);
  --font-sans: 'Kalam', 'PingFang SC', ui-sans-serif, system-ui, sans-serif;
}

[data-theme='style-4'] {
  --color-brand-50: 243 240 255;
  --color-brand-100: 228 220 255;
  --color-brand-200: 201 186 255;
  --color-brand-300: 172 150 255;
  --color-brand-400: 144 117 255;
  --color-brand-500: 124 92 252;
  --color-brand-600: 106 74 232;
  --color-brand-700: 91 63 209;
  --color-brand-800: 72 48 166;
  --color-brand-900: 52 34 122;
  --color-cream: 238 243 255;
  --color-text-strong: 31 42 68;
  --radius-lg: 0.75rem;
  --radius-xl: 1.125rem;
  --radius-2xl: 1.5rem;
  --radius-3xl: 2rem;
  --shadow-soft: 0 4px 0 rgba(91, 63, 209, 0.9), 0 10px 20px -6px rgba(91, 63, 209, 0.35);
  --shadow-card: 0 3px 0 rgba(31, 42, 68, 0.15), 0 6px 14px -4px rgba(124, 92, 252, 0.20);
  --font-sans: 'Fredoka', 'PingFang SC', ui-rounded, ui-sans-serif, system-ui, sans-serif;
}

[data-theme='style-5'] {
  --color-brand-50: 238 243 252;
  --color-brand-100: 214 228 250;
  --color-brand-200: 175 201 245;
  --color-brand-300: 133 170 240;
  --color-brand-400: 90 137 234;
  --color-brand-500: 47 111 237;
  --color-brand-600: 40 96 214;
  --color-brand-700: 36 84 189;
  --color-brand-800: 29 67 150;
  --color-brand-900: 22 51 112;
  --color-cream: 245 247 250;
  --color-text-strong: 30 41 59;
  --radius-lg: 0.375rem;
  --radius-xl: 0.5rem;
  --radius-2xl: 0.625rem;
  --radius-3xl: 0.75rem;
  --shadow-soft: 0 6px 16px -6px rgba(36, 84, 189, 0.16);
  --shadow-card: 0 2px 8px -2px rgba(30, 41, 59, 0.08);
  --font-sans: ui-sans-serif, system-ui, -apple-system, 'PingFang SC', 'Microsoft YaHei', sans-serif;
}
```

- [ ] **Step 2: 验证构建通过**

Run: `cd web && npm run build`
Expected: 构建成功，无 CSS 语法错误。

- [ ] **Step 3: 用浏览器 devtools console 手动核对（此时还没有切换器 UI）**

`npm run dev` 打开首页，在浏览器 devtools console 依次执行：

```js
document.documentElement.dataset.theme = 'style-2'
```

确认头部背景色/按钮色变成暖珊瑚色系；再执行 `delete document.documentElement.dataset.theme` 确认恢复原暖橙色。任选另外一个 `style-N` 再确认一次颜色明显不同即可，不需要六个全测。

- [ ] **Step 4: Commit**

```bash
git add web/src/index.css
git commit -m "feat(web): 新增 5 套候选主题的 CSS 变量覆盖"
```

---

### Task 3: 新建 ThemeSwitcher 组件

**Files:**
- Create: `web/src/components/ThemeSwitcher.tsx`

**Interfaces:**
- Consumes：Task 2 中生效的 `data-theme` 取值集合（`'default' | 'style-1' | 'style-2' | 'style-3' | 'style-4' | 'style-5'`）。
- Produces：`export default function ThemeSwitcher()` —— 无 props，内部自管理状态；供 Task 4 直接引入渲染。

- [ ] **Step 1: 创建 `web/src/components/ThemeSwitcher.tsx`**

```tsx
import { useEffect, useState } from 'react'

type ThemeOption = {
  key: string
  label: string
  swatch: string
  googleFont?: string
}

const THEMES: ThemeOption[] = [
  { key: 'default', label: '现有暖橙', swatch: '#F97316' },
  { key: 'style-1', label: '低感官负荷', swatch: '#4C8C86', googleFont: 'Inter:wght@400;500;600' },
  { key: 'style-2', label: '温和绘本插画', swatch: '#E8905C', googleFont: 'Baloo+2:wght@500;700' },
  { key: 'style-3', label: '纸艺拼贴', swatch: '#C1553B', googleFont: 'Kalam:wght@400;700' },
  { key: 'style-4', label: '游戏化学习', swatch: '#7C5CFC', googleFont: 'Fredoka:wght@500;700' },
  { key: 'style-5', label: '专业可信', swatch: '#2F6FED' },
]

const STORAGE_KEY = 'cl-theme'
const FONT_LINK_ID = 'cl-theme-preview-fonts'

function ensureFontsLoaded() {
  if (document.getElementById(FONT_LINK_ID)) return
  const families = THEMES.filter((t) => t.googleFont).map((t) => `family=${t.googleFont}`)
  const link = document.createElement('link')
  link.id = FONT_LINK_ID
  link.rel = 'stylesheet'
  link.href = `https://fonts.googleapis.com/css2?${families.join('&')}&display=swap`
  document.head.appendChild(link)
}

function applyTheme(key: string) {
  if (key === 'default') {
    delete document.documentElement.dataset.theme
  } else {
    document.documentElement.dataset.theme = key
  }
  localStorage.setItem(STORAGE_KEY, key)
}

function ThemeSwitcher() {
  const [active, setActive] = useState('default')

  useEffect(() => {
    ensureFontsLoaded()
    const saved = localStorage.getItem(STORAGE_KEY) ?? 'default'
    applyTheme(saved)
    setActive(saved)
  }, [])

  return (
    <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-1 rounded-2xl bg-white/95 p-2 shadow-lg ring-1 ring-black/10">
      {THEMES.map((theme) => (
        <button
          key={theme.key}
          type="button"
          title={theme.label}
          onClick={() => {
            applyTheme(theme.key)
            setActive(theme.key)
          }}
          className={
            active === theme.key
              ? 'flex items-center gap-2 rounded-full px-2 py-1 text-xs font-bold bg-stone-900 text-white'
              : 'flex items-center gap-2 rounded-full px-2 py-1 text-xs font-bold text-stone-600 hover:bg-stone-100 transition-colors'
          }
        >
          <span className="h-3 w-3 rounded-full" style={{ backgroundColor: theme.swatch }} />
          {theme.label}
        </button>
      ))}
    </div>
  )
}

export default ThemeSwitcher
```

- [ ] **Step 2: 验证构建通过**

Run: `cd web && npm run build`
Expected: 构建成功（此时组件尚未被引用，仅确认语法/类型无误）。

- [ ] **Step 3: Commit**

```bash
git add web/src/components/ThemeSwitcher.tsx
git commit -m "feat(web): 新增主题预览切换器组件"
```

---

### Task 4: 挂载切换器到 AppShell，并做全站主题切换 E2E 验证

**Files:**
- Modify: `web/src/components/AppShell.tsx`

**Interfaces:**
- Consumes：Task 3 的 `export default function ThemeSwitcher()`。

- [ ] **Step 1: 修改 `web/src/components/AppShell.tsx`**

在文件顶部 import 区添加：

```tsx
import ThemeSwitcher from './ThemeSwitcher'
```

在 `return (` 的根 `<div className="min-h-screen flex flex-col">` 内、`</div>` 闭合标签之前（即 `<main>` 之后）添加：

```tsx
      {import.meta.env.DEV && <ThemeSwitcher />}
```

即该组件返回值变为：

```tsx
  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-50 bg-cream/95 backdrop-blur border-b border-brand-100 shadow-card">
        {/* ...原有内容不变... */}
      </header>
      <main className="flex-1">
        <Outlet />
      </main>
      {import.meta.env.DEV && <ThemeSwitcher />}
    </div>
  )
```

- [ ] **Step 2: 验证生产构建不包含切换器**

Run: `cd web && npm run build && npm run preview`

打开 preview 给出的地址，确认右下角**没有**主题切换悬浮框。完成后 `Ctrl+C` 停掉 preview。

- [ ] **Step 3: 开发环境下做全站 6 主题目视 E2E 验证**

Run: `cd web && npm run dev`

打开 `http://localhost:5173`，用浏览器（或 chrome-devtools MCP）依次点击右下角切换器的 6 个选项，对以下页面分别确认颜色/圆角/阴影/字体随主题变化、无报错：
- 首页（DTT 教案列表）
- 任意一份教案详情页（海报排版）
- 绘本打卡页 `/picture-book`
- 游戏乐园页 `/games`
- 视频分析页 `/video`

再刷新页面确认停留在最后选择的主题（localStorage 生效）。检查浏览器 console 是否有 Google Fonts 加载失败或 React 报错（字体加载失败可接受降级为系统字体，不算阻塞项，但要确认不报 JS 错误）。

- [ ] **Step 4: Commit**

```bash
git add web/src/components/AppShell.tsx
git commit -m "feat(web): 挂载主题预览切换器到 AppShell"
```
