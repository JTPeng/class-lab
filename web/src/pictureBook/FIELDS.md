# 绘本打卡记录字段契约

前端当前存在 localStorage（`pictureBook/storage.ts` 的 `BookRecord`），按登录用户命名空间隔离。
待后端 db 层迁移稳定后，接入持久化时可参考以下字段：

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `id` | string | 是 | 前端生成的唯一 id（`crypto.randomUUID()`），建库后可直接作主键 |
| `title` | string | 是 | 书名 |
| `thoughts` | string | 否，空字符串代表无 | 阅读心得 |
| `stars` | number(1-5) | 是 | 评分 |
| `style` | string | 是 | AI 画风 id，需与后端 `STYLE_PROMPTS`（`serve/src/ai/picturebook.ts`）对齐 |
| `size` | string | 是 | 像素比尺寸串（如 `1024*1024`），需与后端 `ALLOWED_SIZES` 对齐 |
| `scenes` | `{ text: string; image: string }[]` | 是 | 逐页文案 + 插图；`image` 目前是 base64 data URL，**建库时建议改存文件路径/URL**，不要整段塞进一列 |
| `date` | string(`YYYY-MM-DD`) | 是 | 生成/打卡日期，用于展示 |
| `createdAt` | string(ISO datetime) | 是 | 精确生成时间，用于排序 |
| `count` | number | 是 | 生成时刻的“第 N 次打卡”，创建后不再变更（即使之后删除了更早的记录） |

关联用户：当前用户来自 `AuthContext`（`web/src/auth/AuthContext.tsx`）的 `AuthUser.id`，建库时应作为外键列（如 `userId`），与现有 `user_module_data` 表的 `(userId, module, key)` 维度一致。
