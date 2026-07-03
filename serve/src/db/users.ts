import type Database from 'better-sqlite3';

// 轻量演示用户：只认用户名，登录时没有则自动创建。role/meta 为预留字段，
// 供以后菜单/权限扩展，本次不使用。
export interface User {
  id: string;
  username: string;
  displayName: string;
  createdAt: string;
  role: string;
  meta: string | null;
}

export function createUsersTable(db: Database.Database): void {
  db.exec(
    `CREATE TABLE IF NOT EXISTS users(
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE,
      displayName TEXT,
      createdAt TEXT,
      role TEXT DEFAULT 'student',
      meta TEXT
    )`,
  );
}

export function findUserByUsername(db: Database.Database, username: string): User | null {
  const row = db.prepare(`SELECT * FROM users WHERE username = ?`).get(username) as User | undefined;
  return row ?? null;
}

export function insertUser(db: Database.Database, user: User): void {
  db.prepare(
    `INSERT INTO users (id, username, displayName, createdAt, role, meta)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(user.id, user.username, user.displayName, user.createdAt, user.role, user.meta);
}

// 没有该用户名则创建，返回用户。用户名首尾空白已在路由层清理。
export function loginOrCreate(db: Database.Database, username: string): User {
  const existing = findUserByUsername(db, username);
  if (existing) return existing;
  const user: User = {
    id: crypto.randomUUID(),
    username,
    displayName: username,
    createdAt: new Date().toISOString(),
    role: 'student',
    meta: null,
  };
  insertUser(db, user);
  return user;
}
