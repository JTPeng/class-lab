import type { DbClient } from './client.js';

// 绘本打卡记录持久化：与 lessons/video_analyses「单表存整对象 JSON」模式一致，
// 但按 userId 隔离（每个用户只能看到自己的打卡历史）。字段契约见 web/src/pictureBook/FIELDS.md。

export interface PictureBookRecord {
  id: string;
  userId: string;
  title: string;
  thoughts: string;
  stars: number;
  style: string;
  size: string;
  scenes: { text: string; image: string }[];
  date: string;
  createdAt: string;
  count: number;
  caseId: string | null;
  teacherCooperation: number | null;
  teacherProgress: number | null;
}

type PictureBookRow = {
  id: string;
  userId: string;
  title: string;
  thoughts: string;
  stars: number;
  style: string;
  size: string;
  scenes: string;
  date: string;
  createdAt: string;
  count: number;
  caseId: string | null;
  teacherCooperation: number | null;
  teacherProgress: number | null;
};

function rowToRecord(row: PictureBookRow): PictureBookRecord {
  return { ...row, scenes: JSON.parse(row.scenes) };
}

export async function createPictureBooksTable(db: DbClient): Promise<void> {
  const idColType = db.dialect === 'mysql' ? 'VARCHAR(191)' : 'TEXT';
  const dataType = db.dialect === 'mysql' ? 'LONGTEXT' : 'TEXT';
  await db.exec(
    `CREATE TABLE IF NOT EXISTS picture_books(
      id ${idColType} PRIMARY KEY,
      userId ${idColType},
      title TEXT,
      thoughts TEXT,
      stars INTEGER,
      style TEXT,
      size TEXT,
      scenes ${dataType},
      date TEXT,
      createdAt TEXT,
      count INTEGER
    )`,
  );
}

export async function insertPictureBook(db: DbClient, record: PictureBookRecord): Promise<void> {
  await db.run(
    `INSERT INTO picture_books (id, userId, title, thoughts, stars, style, size, scenes, date, createdAt, count)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      record.id,
      record.userId,
      record.title,
      record.thoughts,
      record.stars,
      record.style,
      record.size,
      JSON.stringify(record.scenes),
      record.date,
      record.createdAt,
      record.count,
    ],
  );
}

export async function listPictureBooks(db: DbClient, userId: string): Promise<PictureBookRecord[]> {
  const rows = await db.all<PictureBookRow>(
    `SELECT * FROM picture_books WHERE userId = ? ORDER BY createdAt DESC`,
    [userId],
  );
  return rows.map(rowToRecord);
}

export async function deletePictureBook(db: DbClient, userId: string, id: string): Promise<boolean> {
  const result = await db.run(`DELETE FROM picture_books WHERE id = ? AND userId = ?`, [id, userId]);
  return result.changes > 0;
}

export async function linkPictureBookScore(
  db: DbClient,
  id: string,
  userId: string,
  input: { caseId: string; teacherCooperation: number; teacherProgress: number },
): Promise<boolean> {
  const result = await db.run(
    `UPDATE picture_books SET caseId = ?, teacherCooperation = ?, teacherProgress = ? WHERE id = ? AND userId = ?`,
    [input.caseId, input.teacherCooperation, input.teacherProgress, id, userId],
  );
  return result.changes > 0;
}

export async function listPictureBooksByCase(db: DbClient, caseId: string): Promise<PictureBookRecord[]> {
  const rows = await db.all<PictureBookRow>(
    `SELECT * FROM picture_books WHERE caseId = ? ORDER BY createdAt DESC`,
    [caseId],
  );
  return rows.map(rowToRecord);
}
