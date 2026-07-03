# 用户表 / 轻量登录 / 分数存储 设计

日期：2026-07-03

## 目标

在现有 SQLite（better-sqlite3, `lessons.db`）中新增用户体系，做一个轻量演示登录，并预留一张通用的「模块数据」表，让三个菜单模块（DTT 教案 / 绘本打卡 / 游戏乐园）都能挂「该用户在此模块的数据」。本次先把游戏分数接上后端。

## 决策

- 登录形态：**轻量演示登录**，只输入用户名，后端没有则**自动创建**，无密码、无 token。
- 菜单打通：**通用模块数据表**（方案 A），加新模块零改表。
- 本次落地范围：`users` + `user_module_data` 表、登录/模块数据接口、前端登录态、游戏分数从 localStorage 迁到后端（未登录仍走 localStorage 兜底）。绘本/教案模块不动，仅预留。

## 数据模型

### users
| 字段 | 说明 |
|---|---|
| id | uuid, 主键 |
| username | 唯一 |
| displayName | 展示名（初始 = username）|
| createdAt | ISO 字符串 |
| role | 预留，默认 `student` |
| meta | 预留 JSON 文本，用户级杂项 |

### user_module_data
| 字段 | 说明 |
|---|---|
| userId | 关联 users.id |
| module | `games` / `lessons` / `picture-book` |
| key | 模块内定位键（游戏为 gameId）|
| data | JSON 文本 |
| updatedAt | ISO 字符串 |

主键 `(userId, module, key)`。游戏分数：`module='games', key=gameId, data={level,score,best}`。

## 后端接口（挂 `/api`）

- `POST /api/auth/login` `{ username }` → 无则创建，返回 user（含预留字段）。
- `GET  /api/users/:userId/modules/:module/:key` → 返回 `{ data }` 或 404。
- `PUT  /api/users/:userId/modules/:module/:key` `{ data }` → upsert，返回保存结果。

用 zod 校验入参；沿用 `getDb()` 里 `CREATE TABLE IF NOT EXISTS` 建表模式，新增 `db/users.ts`、`db/moduleData.ts`，在 `getDb()` 中一并建表。路由文件 `routes/auth.ts`、`routes/userData.ts`，在 `index.ts` 注册。

## 前端

- `AuthContext`：当前用户存 `localStorage('clab_user')`，提供 `login(username)` / `logout()` / `user`。
- 登录：菜单右侧显示登录入口；未登录点入口弹出输入用户名 → 调 `/api/auth/login` → 存用户；已登录显示用户名 + 退出。
- 游戏分数：`games/storage.ts` 增加后端同步。登录后 `loadProgress/saveProgress` 走后端（按 userId + gameId）；未登录保持 localStorage。加载异步化，游戏页在挂载时拉取。

## 验证（不写测试，按项目约定）

1. `serve` build + `web` build 通过。
2. 浏览器 E2E：输入用户名登录 → 后端建用户；玩游戏得分并保存；刷新 / 退出重登后分数仍在（来自后端）。
