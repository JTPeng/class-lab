# 数据库配置

## 驱动切换

`serve/.env` 里的 `DB_DRIVER` 控制使用哪种数据库：

- `sqlite`（默认）：本地文件 `serve/lessons.db`，无需额外配置，clone 后直接可跑。
- `mysql`：团队共享 MySQL，需要下面几项环境变量。

## MySQL 连接信息（团队共享服务器）

| 环境变量 | 值 |
|---|---|
| `DB_HOST` | `47.102.43.19` |
| `DB_PORT` | `11432` |
| `DB_USER` | `root` |
| `DB_PASSWORD` | 见 `serve/.env`（已 gitignore，不在此文档记录明文） |
| `DB_NAME` | `timer_class_lab`（个人前缀 `timer`） |

密码来自项目内 `skills/dev-sql/SKILL.md` 技能文档，只写在本地 `.env` 里，不要提交到公开仓库。

## 数据迁移

首次从 SQLite 迁移到 MySQL：

```bash
cd serve
npm run migrate:mysql
```

脚本只读打开现有 `lessons.db`，在 MySQL 端建表后用 `INSERT IGNORE` 逐表复制数据，可重复执行不会重复插入。
