import Database from 'better-sqlite3';
import mysql from 'mysql2/promise';

export interface DbClient {
  dialect: 'sqlite' | 'mysql';
  run(sql: string, params?: unknown[]): Promise<{ changes: number }>;
  get<T>(sql: string, params?: unknown[]): Promise<T | undefined>;
  all<T>(sql: string, params?: unknown[]): Promise<T[]>;
  exec(sql: string): Promise<void>;
  close(): Promise<void>;
}

export interface CreateDbClientOptions {
  driver?: 'sqlite' | 'mysql';
  sqlitePath?: string;
}

function createSqliteClient(path: string): DbClient {
  const db = new Database(path);
  return {
    dialect: 'sqlite',
    async run(sql, params = []) {
      const result = db.prepare(sql).run(...(params as never[]));
      return { changes: result.changes };
    },
    async get(sql, params = []) {
      return db.prepare(sql).get(...(params as never[])) as never;
    },
    async all(sql, params = []) {
      return db.prepare(sql).all(...(params as never[])) as never;
    },
    async exec(sql) {
      db.exec(sql);
    },
    async close() {
      db.close();
    },
  };
}

async function createMysqlClient(): Promise<DbClient> {
  const host = process.env.DB_HOST;
  const port = Number(process.env.DB_PORT ?? 3306);
  const user = process.env.DB_USER;
  const password = process.env.DB_PASSWORD;
  const database = process.env.DB_NAME;
  if (!host || !user || !database) {
    throw new Error('缺少 DB_HOST/DB_USER/DB_NAME 环境变量，无法连接 MySQL');
  }

  const bootstrap = await mysql.createConnection({ host, port, user, password });
  await bootstrap.query(`CREATE DATABASE IF NOT EXISTS \`${database}\` CHARACTER SET utf8mb4`);
  await bootstrap.end();

  const pool = mysql.createPool({ host, port, user, password, database, waitForConnections: true, connectionLimit: 5 });
  return {
    dialect: 'mysql',
    async run(sql, params = []) {
      const [result] = await pool.execute(sql, params as never[]);
      return { changes: (result as mysql.ResultSetHeader).affectedRows ?? 0 };
    },
    async get(sql, params = []) {
      const [rows] = await pool.execute(sql, params as never[]);
      return (rows as never[])[0];
    },
    async all(sql, params = []) {
      const [rows] = await pool.execute(sql, params as never[]);
      return rows as never;
    },
    async exec(sql) {
      await pool.query(sql);
    },
    async close() {
      await pool.end();
    },
  };
}

export async function createDbClient(opts: CreateDbClientOptions = {}): Promise<DbClient> {
  const driver = opts.driver ?? (process.env.DB_DRIVER as 'sqlite' | 'mysql' | undefined) ?? 'sqlite';
  if (driver === 'mysql') return createMysqlClient();
  return createSqliteClient(opts.sqlitePath ?? 'lessons.db');
}
