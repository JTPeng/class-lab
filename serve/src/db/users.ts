import type Database from 'better-sqlite3';
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
  const columns = db.prepare(`PRAGMA table_info(users)`).all() as { name: string }[];
  if (!columns.some((c) => c.name === 'password')) {
    db.exec(`ALTER TABLE users ADD COLUMN password TEXT`);
  }
}

export function findUserByUsername(db: Database.Database, username: string): User | null {
  const row = db.prepare(`SELECT * FROM users WHERE username = ?`).get(username) as User | undefined;
  return row ?? null;
}

export function insertUser(db: Database.Database, user: User): void {
  db.prepare(
    `INSERT INTO users (id, username, displayName, createdAt, role, meta, password)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(user.id, user.username, user.displayName, user.createdAt, user.role, user.meta, user.password);
}

// 账号不存在则注册；账号存在但尚无密码（老账号）则补种本次密码；
// 账号存在且已有密码则校验，不通过抛 InvalidCredentialsError。用户名首尾空白已在路由层清理。
export function login(db: Database.Database, username: string, password: string): User {
  const existing = findUserByUsername(db, username);
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
    insertUser(db, user);
    return user;
  }
  if (!existing.password) {
    const hashed = hashPassword(password);
    db.prepare(`UPDATE users SET password = ? WHERE id = ?`).run(hashed, existing.id);
    return { ...existing, password: hashed };
  }
  if (!verifyPassword(password, existing.password)) {
    throw new InvalidCredentialsError('密码错误');
  }
  return existing;
}
