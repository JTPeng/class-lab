# 多端响应式适配 Phase 1（全局断点与导航） Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让 AppShell 顶层导航和三个网格类页面（Home / Games / PictureBook）的容器宽度在手机/平板/PC 三档断点下都能正常显示，移动端用底部 Tab 栏替代顶部横向 Tab。

**Architecture:** 纯 Tailwind 断点类改造，不引入新组件库、不做设备检测。`AppShell.tsx` 内新增一个 `BottomNav` 子组件，`md` 以下渲染在页面底部固定；原顶部横向 Tab 只在 `md` 及以上渲染。三个网格页面的容器 `div` 加宽断点类。

**Tech Stack:** React 19 + React Router 7 + Tailwind CSS 3（已有项目栈，无新增依赖）。

## Global Constraints

- 沿用 Tailwind 默认断点（`sm`640 / `md`768 / `lg`1024 / `xl`1280），不新增自定义断点。参见设计文档 `docs/superpowers/specs/2026-07-04-responsive-multi-device-design.md`。
- 导航切换以 `md`（768px）为界。
- 本项目前端后续切片不写自动化测试（团队约定），每个任务用浏览器手动验证代替测试步骤。
- 表单/详情类页面（`NewLesson`、`LessonDetail`、`VideoAnalysisDetail`）本阶段不改动容器宽度。

---

### Task 1: AppShell 响应式导航（顶部栏简化 + 底部 Tab 栏）

**Files:**
- Modify: `web/src/components/AppShell.tsx`（整份文件，见下方 step 逐段替换）

**Interfaces:**
- 不新增导出、不改变路由结构。`tabs` 数组新增 `icon` 字段（`string`，emoji），供顶部 Tab 与底部 Tab 共用。

- [ ] **Step 1: 给 `tabs` 数组加 `icon` 字段**

把文件顶部的 `tabs` 定义替换为：

```tsx
const tabs = [
  {
    label: 'DTT 教案',
    icon: '📋',
    to: '/',
    match: (p: string) =>
      !p.startsWith('/picture-book') && !p.startsWith('/games') && !p.startsWith('/video'),
  },
  {
    label: '绘本打卡',
    icon: '📖',
    to: '/picture-book',
    match: (p: string) => p.startsWith('/picture-book'),
  },
  { label: '游戏乐园', icon: '🎮', to: '/games', match: (p: string) => p.startsWith('/games') },
  { label: '视频分析', icon: '🎥', to: '/video', match: (p: string) => p.startsWith('/video') },
]
```

- [ ] **Step 2: 顶部横向 Tab 只在 `md` 及以上显示**

把顶部栏里的：

```tsx
          <nav className="flex items-center gap-1">
```

改为：

```tsx
          <nav className="hidden md:flex items-center gap-1">
```

- [ ] **Step 3: 新增 `BottomNav` 组件**

在文件里 `AuthArea` 函数之后、`AppShell` 函数之前，新增：

```tsx
// 移动端（md 以下）底部固定 Tab 栏，顶部横向 Tab 空间不够时的替代导航。
function BottomNav({ pathname }: { pathname: string }) {
  return (
    <nav
      className="md:hidden fixed bottom-0 inset-x-0 z-50 flex items-stretch bg-cream/95 backdrop-blur border-t border-brand-100"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      {tabs.map((tab) => {
        const active = tab.match(pathname)
        return (
          <Link
            key={tab.to}
            to={tab.to}
            className={
              active
                ? 'flex-1 flex flex-col items-center justify-center gap-0.5 min-h-[56px] py-1.5 text-brand-600'
                : 'flex-1 flex flex-col items-center justify-center gap-0.5 min-h-[56px] py-1.5 text-stone-500'
            }
          >
            <span className="text-xl leading-none">{tab.icon}</span>
            <span className="text-[11px] font-bold leading-none">{tab.label}</span>
          </Link>
        )
      })}
    </nav>
  )
}
```

- [ ] **Step 4: `main` 加底部 padding，渲染 `BottomNav`**

把 `AppShell` 函数里的：

```tsx
      <main className="flex-1">
        <Outlet />
      </main>
      {import.meta.env.DEV && <ThemeSwitcher />}
    </div>
  )
}
```

改为：

```tsx
      <main className="flex-1 pb-24 md:pb-0">
        <Outlet />
      </main>
      <BottomNav pathname={pathname} />
      {import.meta.env.DEV && <ThemeSwitcher />}
    </div>
  )
}
```

- [ ] **Step 5: 启动前端开发服务，手动验证**

```bash
cd web && npm run dev
```

用浏览器（或 Chrome DevTools 设备工具栏）依次切到以下宽度，访问 `http://localhost:5173`：

- 375px：应看到顶部只有 logo + 用户信息，看不到横向 Tab；页面底部有固定的 4 图标 Tab 栏；切换 Tab 页面正常跳转且高亮正确；页面内容底部没有被 Tab 栏遮住。
- 768px 及以上（如 1024px、1440px）：应看到顶部横向 Tab 恢复显示；底部 Tab 栏消失。

若发现遮挡或跳转异常，回到对应 step 调整 class 后重新验证。

- [ ] **Step 6: Commit**

```bash
git add web/src/components/AppShell.tsx
git commit -m "feat(web): 移动端导航改为底部固定 Tab 栏"
```

---

### Task 2: 网格类页面容器宽度放宽

**Files:**
- Modify: `web/src/pages/Home.tsx:53`
- Modify: `web/src/pages/Games.tsx:70`
- Modify: `web/src/pages/PictureBook.tsx:163`

**Interfaces:**
- 无接口变化，只改容器 `div` 的 `className`。

- [ ] **Step 1: Home.tsx 容器加宽**

第 53 行：

```tsx
      <div className="max-w-4xl mx-auto">
```

改为：

```tsx
      <div className="max-w-4xl lg:max-w-6xl xl:max-w-7xl mx-auto">
```

- [ ] **Step 2: Games.tsx 容器加宽**

第 70 行同样的替换：

```tsx
      <div className="max-w-4xl mx-auto">
```

改为：

```tsx
      <div className="max-w-4xl lg:max-w-6xl xl:max-w-7xl mx-auto">
```

- [ ] **Step 3: PictureBook.tsx 容器加宽**

第 163 行（这个页面基础宽度是 `max-w-2xl`，按同比例放宽，不套用和 Home/Games 一样的绝对值，避免表单区域在宽屏下被拉得过宽）：

```tsx
      <div className="max-w-2xl mx-auto">
```

改为：

```tsx
      <div className="max-w-2xl lg:max-w-4xl xl:max-w-5xl mx-auto">
```

- [ ] **Step 4: 手动验证三个页面**

`web` 开发服务保持运行（Task 1 Step 5 的 `npm run dev`），浏览器分别打开：

- `http://localhost:5173/`（Home）
- `http://localhost:5173/games`
- `http://localhost:5173/picture-book`

在 1440px 宽度下检查：Home 的教案网格、Games 的游戏卡片网格应展示更多列、不再局促在页面中间一小块；PictureBook 的表单区域适度变宽但不过宽、历史记录网格列数合理增加。

再切回 375px / 768px，确认三个页面网格布局和之前一样正常（不因为加了 `lg:`/`xl:` 类而在小屏出问题）。

- [ ] **Step 5: Commit**

```bash
git add web/src/pages/Home.tsx web/src/pages/Games.tsx web/src/pages/PictureBook.tsx
git commit -m "feat(web): 网格类页面容器宽度按断点放宽，改善宽屏利用率"
```

---

### Task 3: 生产构建校验

**Files:**
- 无新文件，只运行命令。

- [ ] **Step 1: 跑生产构建，确认没有类型/构建错误**

```bash
cd web && npm run build
```

Expected: 构建成功退出（exit code 0），无 TypeScript 报错。

- [ ] **Step 2: 若构建失败**

按报错信息定位到 Task 1/2 里改动的具体文件和行号修正，不要跳过报错。修完重新跑 Step 1 直到通过。

（本任务不需要额外 commit——如果构建失败并修复，修复内容随手改到 Task 1/2 对应的 commit 里即可；如果构建一次通过则无需改动。）
