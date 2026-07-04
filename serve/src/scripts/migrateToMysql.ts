import 'dotenv/config';
import Database from 'better-sqlite3';
import { createDbClient } from '../db/client.js';
import { initSchema } from '../db/index.js';

const SQLITE_PATH = process.env.SQLITE_PATH ?? 'lessons.db';

type TableSpec = { name: string; columns: string[] };

const TABLES: TableSpec[] = [
  { name: 'lessons', columns: ['id', 'title', 'skill', 'createdAt', 'data'] },
  { name: 'users', columns: ['id', 'username', 'displayName', 'createdAt', 'role', 'meta', 'password'] },
  { name: 'user_module_data', columns: ['userId', 'module', 'key', 'data', 'updatedAt'] },
  { name: 'video_analyses', columns: ['id', 'filename', 'createdAt', 'data'] },
];

async function main() {
  const sqlite = new Database(SQLITE_PATH, { readonly: true });
  const mysql = await createDbClient({ driver: 'mysql' });
  await initSchema(mysql);

  for (const table of TABLES) {
    const rows = sqlite.prepare(`SELECT * FROM ${table.name}`).all() as Record<string, unknown>[];
    const cols = table.columns.map((c) => `\`${c}\``).join(', ');
    const placeholders = table.columns.map(() => '?').join(', ');
    let migrated = 0;
    for (const row of rows) {
      const values = table.columns.map((c) => row[c] ?? null);
      const result = await mysql.run(
        `INSERT IGNORE INTO ${table.name} (${cols}) VALUES (${placeholders})`,
        values,
      );
      migrated += result.changes;
    }
    console.log(`${table.name}: ${rows.length} 行读取，${migrated} 行迁移写入`);
  }

  sqlite.close();
  await mysql.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
