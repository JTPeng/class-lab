# 主题预览切换器设计文档

## 背景

Class-Lab 面向儿童场景（DTT 特需儿童训练 + 绘本打卡亲子共读），当前视觉是暖橙+奶油配色，偏温暖但不算典型"儿童风"。经过风格调研，确定了 5 个候选视觉方向 + 现有暖橙风格（共 6 套），需要一个临时的内部预览工具，能在真实页面上一键切换对比，方便选定最终风格。

## 目标与范围

- **性质**：临时内部预览工具，只在开发环境（`import.meta.env.DEV`）渲染，选定风格后可整体删除。
- **作用范围**：`web/` 前端全站（DTT 教案、绘本打卡、游戏乐园、视频分析全部一起变，机制上无法只作用于部分模块），不涉及 `admin/`。
- **不包含**：插画/吉祥物等图片素材的重新生成；本次只做色彩、圆角、阴影、字体这层"皮肤"切换。
- **覆盖预期**：全站 32 个页面文件中 26 个已使用 `brand-*`/`bg-cream`/`shadow-card`/`shadow-soft` 等 token，会跟随主题变化；个别写死具体色值的局部装饰不受影响，视为预期内限制。

## 技术方案

CSS 变量 + `data-theme` 属性：

- `web/tailwind.config.js` 中 `colors.brand.*`、`colors.cream`、`boxShadow.soft/card`、`borderRadius.*`、`fontFamily.sans` 全部改为引用 CSS 变量（如 `var(--color-brand-500)`），而不是写死的十六进制值。
- `web/src/index.css` 中用 `:root`（默认值 = 现有暖橙风格）与 `[data-theme="style-N"]` 选择器分别覆盖这些变量，共 6 组（现有 + 5 个新风格）。
- 页面/组件中的 className（`bg-brand-500`、`rounded-2xl`、`shadow-card` 等）不需要任何改动——它们引用的 token 名不变，只是 token 背后的值随 `data-theme` 变化。

选型理由：曾考虑为每个风格建一份独立 `tailwind.config.js` 多份构建切换，但这样做不到运行时"一键"切换（需要重新构建/重启），故排除。

## 6 套主题的 Token 定义

| 主题 key | 名称 | bg | primary | emphasis | text | radius sm/md/lg | shadow | 字体基调 |
|---|---|---|---|---|---|---|---|---|
| `default`（`:root`） | 现有暖橙 | #FFF7ED | #F97316 | #EA580C | 现状 stone-* | 现状 Tailwind 默认 | 现状 soft/card | 现状 |
| `style-1` | 低感官负荷 | #F7F9F8 | #4C8C86 | #386B66 | #2B3A39 | 6/10/14px | 极轻 flat 阴影 | 系统无衬线，字距略宽 |
| `style-2` | 温和绘本插画 | #FFF8EE | #E8905C | #C96B3B | #4A3527 | 10/16/22px | 暖色调柔和阴影 | 圆润友好无衬线 |
| `style-3` | 纸艺拼贴 | #F3ECDD | #C1553B | #9C3F2B | #3A2E22 | 4/8/12px | 双层叠影模拟纸片堆叠 | 标题手写感，正文无衬线 |
| `style-4` | 游戏化学习 | #EEF3FF | #7C5CFC | #5B3FD1 | #1F2A44 | 12/18/999px | 底部实色"按压"厚阴影 | 圆胖粗体 |
| `style-5` | 专业可信 | #F5F7FA | #2F6FED | #2454BD | #1E293B | 6/8/12px | 现有 shadow-card 级别的极简阴影 | 中性无衬线 |

每套主题需要定义的具体 CSS 变量（对应 `--color-brand-50` ~ `--color-brand-900`、`--color-cream`、`--radius-sm/md/lg`、`--shadow-soft/card`、`--font-sans`）在实施时按上表色值/圆角/阴影/字体基调展开为完整的 9 级色阶（`brand.50`~`brand.900`，参考现有暖橙 9 级色阶的明度分布规律生成）。

## 切换器组件

- 新增 `web/src/components/ThemeSwitcher.tsx`：右下角悬浮的一组按钮/圆点，对应 6 个主题；点击后：
  - `document.documentElement.dataset.theme = themeKey`（`default` 时可删除该属性或设为 `default`，配合 `:root` 默认值）。
  - `localStorage.setItem('cl-theme', themeKey)`。
  - 应用启动时（组件内 `useEffect` 或更早）从 `localStorage` 读取并应用已保存的选择，默认 `default`。
- 仅 `import.meta.env.DEV` 为真时渲染该组件（生产构建不包含）。
- 挂载点：`web/src/components/AppShell.tsx` 顶层（对全站生效）。

## 涉及文件

- `web/tailwind.config.js`（改）：颜色/圆角/阴影 token 指向 CSS 变量。
- `web/src/index.css`（改）：新增 `:root` 默认变量块 + 5 个 `[data-theme="style-N"]` 覆盖块，以及 `body { font-family: var(--font-sans); }`。
- `web/src/components/ThemeSwitcher.tsx`（新增）：切换器组件。
- `web/src/components/AppShell.tsx`（改）：挂载 `<ThemeSwitcher />`。

## 验证方式

- `npm run build`（`web/`）确认生产构建成功且不报 Tailwind/PostCSS 错误。
- 浏览器手动验证：依次切换 6 个主题，检查 DTT 教案首页、教案详情海报页、绘本打卡页、游戏乐园页、视频分析页的色彩/圆角/阴影/字体是否随主题变化；刷新页面确认 `localStorage` 记忆生效；确认生产构建（`npm run build && npm run preview`）中切换器不出现。
- 前端暂无自动化测试（[[class-lab-no-test-files]]），本次也不新增测试，靠上述手动验证。
