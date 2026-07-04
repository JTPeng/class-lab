import { randomUUID } from 'node:crypto';
import type { DbClient } from './client.js';

// 个案档案：教师账号下管理的被训练个案（一对多），与 lessons/picture_books 一致按拥有者隔离，
// 但拥有者字段叫 teacherId。shareToken 用于家长/督导免登录只读访问（见 routes/cases.ts /share/*）。

export interface CaseRecord {
  id: string;
  teacherId: string;
  name: string;
  baseline: string;
  targets: string[];
  shareToken: string;
  createdAt: string;
}

type CaseRow = {
  id: string;
  teacherId: string;
  name: string;
  baseline: string;
  targets: string;
  shareToken: string;
  createdAt: string;
};

function rowToRecord(row: CaseRow): CaseRecord {
  return { ...row, targets: JSON.parse(row.targets) };
}

export async function createCasesTable(db: DbClient): Promise<void> {
  const idColType = db.dialect === 'mysql' ? 'VARCHAR(191)' : 'TEXT';
  const dataType = db.dialect === 'mysql' ? 'LONGTEXT' : 'TEXT';
  await db.exec(
    `CREATE TABLE IF NOT EXISTS cases(
      id ${idColType} PRIMARY KEY,
      teacherId ${idColType},
      name TEXT,
      baseline ${dataType},
      targets ${dataType},
      shareToken ${idColType} UNIQUE,
      createdAt TEXT
    )`,
  );
}

export async function createCase(
  db: DbClient,
  input: { teacherId: string; name: string; baseline: string; targets: string[] },
): Promise<CaseRecord> {
  const record: CaseRecord = {
    id: randomUUID(),
    teacherId: input.teacherId,
    name: input.name,
    baseline: input.baseline,
    targets: input.targets,
    shareToken: randomUUID(),
    createdAt: new Date().toISOString(),
  };
  await db.run(
    `INSERT INTO cases (id, teacherId, name, baseline, targets, shareToken, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [record.id, record.teacherId, record.name, record.baseline, JSON.stringify(record.targets), record.shareToken, record.createdAt],
  );
  return record;
}

export async function listCases(db: DbClient, teacherId: string): Promise<CaseRecord[]> {
  const rows = await db.all<CaseRow>(`SELECT * FROM cases WHERE teacherId = ? ORDER BY createdAt DESC`, [teacherId]);
  return rows.map(rowToRecord);
}

export async function getCase(db: DbClient, id: string, teacherId?: string): Promise<CaseRecord | null> {
  const row = teacherId
    ? await db.get<CaseRow>(`SELECT * FROM cases WHERE id = ? AND teacherId = ?`, [id, teacherId])
    : await db.get<CaseRow>(`SELECT * FROM cases WHERE id = ?`, [id]);
  return row ? rowToRecord(row) : null;
}

export async function getCaseByShareToken(db: DbClient, shareToken: string): Promise<CaseRecord | null> {
  const row = await db.get<CaseRow>(`SELECT * FROM cases WHERE shareToken = ?`, [shareToken]);
  return row ? rowToRecord(row) : null;
}

export async function updateCase(
  db: DbClient,
  id: string,
  teacherId: string,
  patch: { name?: string; baseline?: string; targets?: string[] },
): Promise<boolean> {
  const existing = await getCase(db, id, teacherId);
  if (!existing) return false;
  const next = { ...existing, ...patch };
  await db.run(`UPDATE cases SET name = ?, baseline = ?, targets = ? WHERE id = ? AND teacherId = ?`, [
    next.name,
    next.baseline,
    JSON.stringify(next.targets),
    id,
    teacherId,
  ]);
  return true;
}

export async function deleteCase(db: DbClient, id: string, teacherId: string): Promise<boolean> {
  const result = await db.run(`DELETE FROM cases WHERE id = ? AND teacherId = ?`, [id, teacherId]);
  return result.changes > 0;
}
