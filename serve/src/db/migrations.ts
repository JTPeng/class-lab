import type { DbClient } from './client.js';

// 把改造前产生的无主数据（lessons/video_analyses 里 userId 为空的历史行）统一挂到
// 已存在的 admin 账号下，并把该账号 role 补成 'admin'。找不到 admin 账号则跳过（不臆造账号）。
export async function backfillOwnerlessData(db: DbClient): Promise<void> {
  const admin = await db.get<{ id: string; role: string }>(
    `SELECT id, role FROM users WHERE username = ?`,
    ['admin'],
  );
  if (!admin) {
    console.warn('[migrations] 未找到 username=admin 的账号，跳过无主数据回填');
    return;
  }
  if (admin.role !== 'admin') {
    await db.run(`UPDATE users SET role = ? WHERE id = ?`, ['admin', admin.id]);
  }
  await db.run(`UPDATE lessons SET userId = ? WHERE userId IS NULL`, [admin.id]);
  await db.run(`UPDATE video_analyses SET userId = ? WHERE userId IS NULL`, [admin.id]);
}
