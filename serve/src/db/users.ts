import type { DbClient } from './client.js';
import { hashPassword, verifyPassword } from '../lib/password.js';

// 账号+密码登录：用户名唯一，密码为 scrypt 哈希（"salt:hash"）。role/meta 为预留字段，
// 供以后菜单/权限扩展，本次不使用。
export interface User {
  id: string;
  username: string;
  displayName: string;
  createdAt: string;
  role: string;
  meta: string | null;
  password: string | null;
}

export class InvalidCredentialsError extends Error {}

export async function createUsersTable(db: DbClient): Promise<void> {
  const idType = db.dialect === 'mysql' ? 'VARCHAR(36) PRIMARY KEY' : 'TEXT PRIMARY KEY';
  const roleType = db.dialect === 'mysql' ? "VARCHAR(32) DEFAULT 'student'" : "TEXT DEFAULT 'student'";
  await db.exec(
    `CREATE TABLE IF NOT EXISTS users(
      id ${idType},
      username VARCHAR(255) UNIQUE,
      displayName TEXT,
      createdAt TEXT,
      role ${roleType},
      meta TEXT
    )`,
  );
  if (db.dialect === 'mysql') {
    const row = await db.get<{ count: number }>(
      `SELECT COUNT(*) AS count FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'users' AND column_name = 'password'`,
    );
    if (!row || row.count === 0) {
      await db.exec(`ALTER TABLE users ADD COLUMN password VARCHAR(255)`);
    }
  } else {
    const columns = await db.all<{ name: string }>(`PRAGMA table_info(users)`);
    if (!columns.some((c) => c.name === 'password')) {
      await db.exec(`ALTER TABLE users ADD COLUMN password TEXT`);
    }
  }
}

export async function findUserByUsername(db: DbClient, username: string): Promise<User | null> {
  const row = await db.get<User>(`SELECT * FROM users WHERE username = ?`, [username]);
  return row ?? null;
}

export async function insertUser(db: DbClient, user: User): Promise<void> {
  await db.run(
    `INSERT INTO users (id, username, displayName, createdAt, role, meta, password)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [user.id, user.username, user.displayName, user.createdAt, user.role, user.meta, user.password],
  );
}

// 账号不存在则注册；账号存在但尚无密码（老账号）则补种本次密码；
// 账号存在且已有密码则校验，不通过抛 InvalidCredentialsError。用户名首尾空白已在路由层清理。
export async function login(db: DbClient, username: string, password: string): Promise<User> {
  const existing = await findUserByUsername(db, username);
  if (!existing) {
    const user: User = {
      id: crypto.randomUUID(),
      username,
      displayName: username,
      createdAt: new Date().toISOString(),
      role: 'student',
      meta: null,
      password: hashPassword(password),
    };
    await insertUser(db, user);
    return user;
  }
  if (!existing.password) {
    const hashed = hashPassword(password);
    await db.run(`UPDATE users SET password = ? WHERE id = ?`, [hashed, existing.id]);
    return { ...existing, password: hashed };
  }
  if (!verifyPassword(password, existing.password)) {
    throw new InvalidCredentialsError('密码错误');
  }
  return existing;
}
