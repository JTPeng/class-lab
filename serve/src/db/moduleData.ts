import type Database from 'better-sqlite3';

// 通用「模块数据」表：三个菜单模块（games/lessons/picture-book）都往这里挂
// 「某用户在此模块的数据」，用 (userId, module, key) 定位，data 存 JSON 字符串。
// 加新模块无需改表。游戏分数：module='games', key=gameId, data={level,score,best}。
export function createModuleDataTable(db: Database.Database): void {
  db.exec(
    `CREATE TABLE IF NOT EXISTS user_module_data(
      userId TEXT,
      module TEXT,
      key TEXT,
      data TEXT,
      updatedAt TEXT,
      PRIMARY KEY (userId, module, key)
    )`,
  );
}

export function getModuleData(
  db: Database.Database,
  userId: string,
  module: string,
  key: string,
): unknown | null {
  const row = db
    .prepare(`SELECT data FROM user_module_data WHERE userId = ? AND module = ? AND key = ?`)
    .get(userId, module, key) as { data: string } | undefined;
  return row ? JSON.parse(row.data) : null;
}

export function putModuleData(
  db: Database.Database,
  userId: string,
  module: string,
  key: string,
  data: unknown,
): void {
  db.prepare(
    `INSERT INTO user_module_data (userId, module, key, data, updatedAt)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(userId, module, key) DO UPDATE SET data = excluded.data, updatedAt = excluded.updatedAt`,
  ).run(userId, module, key, JSON.stringify(data), new Date().toISOString());
}
