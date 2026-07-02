# Class-Lab · 特需儿童 DTT 教案生成工具 — 设计文档

- 日期：2026-07-02
- 状态：设计已确认，待复审 → 转实现计划

## 1. 背景与目标

面向培智学校 / 特殊教育老师的教案工具。老师输入训练目标和手头现有教具，工具用 AI 生成一份规范的、**个别化 DTT（回合式教学）训练方案**，并做成**海报化、图文并茂、可交互**的网页，方便备课与上课时照着执行。

产品灵魂：教案"像海报一样一眼抓住关键信息"（低文字密度、大字重、分区色块），且**结构必须规范**（严格对照给定模板，不能乱）。

### 本版范围
- 前端 `web/` + 后端 `serve/` + 真实 AI 生成。
- **只做一种模板**：个别化 DTT 回合式训练方案（对应用户提供的模板图）。

### 非目标（本版明确不做，但预留扩展位）
- 集体课教案、班级人数 / 师生配比 / 多课时。
- 教案手动编辑（本版只读展示）。
- 上课数据采集 / 正确率图表。
- 多用户 / 登录。
- 教材文件上传 + OCR 解析（教材本版用粘贴 / 手填）。

## 2. 技术栈
- 前端：React + Vite + TypeScript + Tailwind CSS。
- 后端：Node.js + Fastify + TypeScript。
- 存储：SQLite（`better-sqlite3`）。
- AI：阿里百炼 MaaS。
  - 文本：OpenAI 兼容地址（专属部署），`response_format: json_object` 约束输出。
  - 图片：`qwen-image-2.0`（DashScope 接口，实现时先实测确认调用方式）。
- 密钥：全部读 `serve/.env`，`.gitignore` 排除。

### 视觉方向
参考 motuai.cn：暖橙 + 奶油底色、圆角卡片、大标题海报感、留白充足、友好的 SaaS 风格。结合项目自带 UI skills（`minimalist-ui` / `high-end-visual-design` / `brandkit`）实现。教案详情页把"海报化"做足。

## 3. 架构与目录

```
class-lab/
├─ web/                    # 前端
│  ├─ src/
│  │  ├─ pages/            # 首页(列表) / 新建(表单) / 教案海报详情
│  │  ├─ components/       # 海报卡片、回合流程演示、图卡轮播...
│  │  ├─ api/              # 后端请求封装
│  │  └─ types/            # 教案 schema 的 TS 类型(前后端共享一份)
├─ serve/                  # 后端
│  ├─ src/
│  │  ├─ routes/           # lessons(增查删) / generate / images
│  │  ├─ ai/               # 文本 client + 图片 client(provider 无关适配层)
│  │  ├─ db/               # SQLite 连接 + 建表
│  │  └─ schema/           # 教案 schema(生成约束 + 入库校验)
│  ├─ .env                 # API Key (gitignore)
│  └─ uploads/             # 图片(或存模型返回 URL，实测后定)
└─ docs/superpowers/specs/ # 本设计文档
```

### 数据流（方案 A：一次成型）
1. 老师在新建页填表单 → `POST /api/lessons/generate`。
2. 后端调文本模型（带 JSON schema 约束）→ 得到整份结构化教案。
3. 校验 schema，缺字段 / 格式错**自动重试一次**，仍失败则报错。
4. 存 SQLite → 立即返回教案，前端渲染海报。
5. 前端就目标物 / 教具 / 步骤发起配图请求 → 后端异步调 `qwen-image` → 回填展示。

**取舍**：教案文字是关键路径（失败明确报错 + 可重试）；图片是增强项（失败降级为占位图，不阻塞主体）。

## 4. 数据模型（DTT Schema）

严格对照模板图抽象。**扩展性原则**：`templateType` 判别字段 + `schemaVersion`，将来加集体课教案是"新增类型"，不改老结构；字段只增不改。

```ts
Lesson {
  id: string
  schemaVersion: number        // 扩展位：schema 演进
  templateType: "dtt"          // 扩展位：将来可加 "collective" 等
  title: string
  createdAt: string

  // —— 生成输入(留档，便于复现 / 再生成) ——
  input: {
    skill: string              // 训练目标 / 能力
    availableTools: string[]   // 老师现有教具(支持"有限教具也发挥效果")
    context: "机构" | "居家" | "机构/居家"
    reinforcerPref?: string    // 增强物偏好(可选)
    sessionMinutes?: number    // 单次时长(可选)
  }

  // —— 教案主体(对应模板) ——
  longTermGoal: {
    description: string
    passCriteria: string       // 如 "80%×3, 90%×2"
  }
  phases: [{                   // 阶段性目标
    name: string               // "阶段一"
    description: string        // "3D&3D 不完全相同物品配物品"
    startDate: null            // 生成时留空，老师上课手填
    passDate: null
  }]
  sto: {                       // 短期目标 STO
    teachingMaterials: string  // 教学教材(多重范例说明)
    objectives: string[]       // ≥2 个目标
    strategy: string           // 策略
    reinforcementPlan: string  // 增强计划
    procedure: {               // 程序 —— ABA 回合结构
      sd: string               // A: 呈现刺激 + 获取注意 + 口头指令
      correct:   { response: string; consequence: string }  // B(+)/C(+)
      incorrect: { response: string; correction: string }   // B(-)/C(-)
    }
    dataCollection: string     // 数据采集方法
    masteryCriteria: string    // 通过标准
  }
  targetList: [{               // 目标清单(可自加)
    target: string             // "铁碗、塑料碗、瓷碗、橡胶碗"
    introDate: null            // 生成时留空
    masteryDate: null
  }]
  sessionSuggestion?: string   // 课时/时长建议(据 sessionMinutes 生成，只建议不倒计时)

  // —— 富媒体 ——
  images: [{
    refKey: string             // 关联对象，如 "target:碗" / "distractor" / "step:sd"
    prompt: string
    status: "pending" | "done" | "failed"
    url?: string
  }]
}
```

要点：
- 日期字段（阶段、目标清单）生成时一律留空，由老师上课后手填，AI 不编造。
- `procedure` 三分支（SD / 正确 / 错误）直接驱动前端"回合流程演示"。
- `targetList` 每行是一组多重范例，直接驱动"图卡轮播"。

## 5. 后端接口

| 方法 | 路径 | 作用 |
|---|---|---|
| POST | `/api/lessons/generate` | 收表单 → 生成 → 校验 → 存库 → 返回教案 |
| GET | `/api/lessons` | 教案列表 |
| GET | `/api/lessons/:id` | 教案详情 |
| POST | `/api/lessons/:id/images` | 触发 / 重生成某张配图(异步) |
| DELETE | `/api/lessons/:id` | 删除 |

### AI 调用
- **文本**：OpenAI 兼容 `chat/completions`。System prompt 内置「培智 / ABA 教案专家 + 模板结构说明 + 输出必须是符合 schema 的 JSON」，`response_format: json_object`。返回后按 schema 校验，失败重试一次。模型名实现时联通测试确认（专属部署）。
- **图片**：`qwen-image-2.0`，DashScope 接口。**实现时先用给定 key/host 实测**再定调用方式（同步 / 异步轮询）。失败仅置 `image.status=failed`，不影响教案主体。
- 配图对象：目标物 / 干扰物示意图、教具风格图、程序步骤图示。

## 6. 前端页面与交互

### 页面
1. **首页 / 列表**：卡片网格（标题、训练能力、封面图、时间）+ "＋ 新建教案"。
2. **新建页**：表单（训练目标、现有教具多输入、情景选择、可选项）→ 提交进入生成加载态（文字先出、图片陆续补齐）。
3. **教案海报详情页**（重头戏）。

### 海报详情布局（海报化：低文字密度、大字重、分区色块）
```
┌─────────────────────────────────────────┐
│  [长期目标 Hero 大标题]     [通过标准 徽章] │
├─────────────────────────────────────────┤
│  阶段目标：阶段一 → 阶段二 → 阶段三 (时间轴) │
├──────────────────────┬──────────────────┤
│  短期目标 STO         │  情景 chip        │
│  教材/目标/策略/增强   │                  │
├──────────────────────┴──────────────────┤
│  ▶ 程序 · 回合流程演示 (交互1)             │
├─────────────────────────────────────────┤
│  目标清单 · 图卡轮播 (交互2)               │
└─────────────────────────────────────────┘
```

### 交互 1 · 回合流程演示
把「程序」做成可点击分支卡，像操作指南带老师走一遍标准回合：
`SD 卡(呈现刺激+指令)` → 按钮 **[孩子正确] / [孩子错误]** → 正确显示强化(C+) / 错误显示纠正程序(C−) → "再来一回合"重置。

### 交互 2 · 图卡 / 教具轮播
目标清单每组一张卡，配 AI 生成图；同组多重范例可轮播（铁碗→塑料碗→瓷碗→橡胶碗）；点击放大看大图（lightbox）。图未生成时显示占位 / 加载态。

## 7. 时长控制
表单可填 `单次时长(分钟)`；AI 据此在 `sessionSuggestion` 给出"建议回合数 / 单次训练时长"提示。只做建议，不做硬性倒计时。

## 8. 测试
- 后端：schema 校验 + 生成重试逻辑单测（mock 模型返回）。
- 前端：回合流程演示分支切换、图卡轮播的组件测试。

## 9. 待实现时验证的开放项
- 文本模型名（专属部署）——联通测试确认。
- `qwen-image-2.0` 调用方式（同步 vs 异步轮询）、返回是 URL 还是二进制——实测确认。
- 图片存本地 `uploads/` 还是直接存模型 URL——按实测结果定。
