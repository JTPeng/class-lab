import type { DbClient } from './client.js';

// 通用「模块数据」表：三个菜单模块（games/lessons/picture-book）都往这里挂
// 「某用户在此模块的数据」，用 (userId, module, key) 定位，data 存 JSON 字符串。
// 加新模块无需改表。游戏分数：module='games', key=gameId, data={level,score,best}。
export async function createModuleDataTable(db: DbClient): Promise<void> {
  const idColType = db.dialect === 'mysql' ? 'VARCHAR(191)' : 'TEXT';
  const dataType = db.dialect === 'mysql' ? 'LONGTEXT' : 'TEXT';
  await db.exec(
    `CREATE TABLE IF NOT EXISTS user_module_data(
      userId ${idColType},
      module ${idColType},
      \`key\` ${idColType},
      data ${dataType},
      updatedAt TEXT,
      PRIMARY KEY (userId, module, \`key\`)
    )`,
  );
}

export async function getModuleData(
  db: DbClient,
  userId: string,
  module: string,
  key: string,
): Promise<unknown | null> {
  const row = await db.get<{ data: string }>(
    `SELECT data FROM user_module_data WHERE userId = ? AND module = ? AND \`key\` = ?`,
    [userId, module, key],
  );
  return row ? JSON.parse(row.data) : null;
}

export async function putModuleData(
  db: DbClient,
  userId: string,
  module: string,
  key: string,
  data: unknown,
): Promise<void> {
  const upsert =
    db.dialect === 'mysql'
      ? `INSERT INTO user_module_data (userId, module, \`key\`, data, updatedAt)
         VALUES (?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE data = VALUES(data), updatedAt = VALUES(updatedAt)`
      : `INSERT INTO user_module_data (userId, module, \`key\`, data, updatedAt)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(userId, module, \`key\`) DO UPDATE SET data = excluded.data, updatedAt = excluded.updatedAt`;
  await db.run(upsert, [userId, module, key, JSON.stringify(data), new Date().toISOString()]);
}
