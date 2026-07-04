import type { DbClient } from './client.js';
import type { Lesson } from '../schema/lesson.js';
import { createUsersTable } from './users.js';
import { createModuleDataTable } from './moduleData.js';
import { createVideoAnalysesTable } from './videoAnalyses.js';
import { createPictureBooksTable } from './pictureBooks.js';
import { createTrainingTopicsTable } from './trainingTopics.js';
import { backfillOwnerlessData } from './migrations.js';

export type LessonListItem = {
  id: string;
  title: string;
  skill: string;
  createdAt: string;
  coverUrl?: string;
};

type LessonRow = {
  id: string;
  title: string;
  skill: string;
  createdAt: string;
  data: string;
};

async function addLessonsUserIdColumn(db: DbClient): Promise<void> {
  if (db.dialect === 'mysql') {
    const row = await db.get<{ count: number }>(
      `SELECT COUNT(*) AS count FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'lessons' AND column_name = 'userId'`,
    );
    if (!row || row.count === 0) {
      await db.exec(`ALTER TABLE lessons ADD COLUMN userId VARCHAR(191)`);
    }
  } else {
    const columns = await db.all<{ name: string }>(`PRAGMA table_info(lessons)`);
    if (!columns.some((c) => c.name === 'userId')) {
      await db.exec(`ALTER TABLE lessons ADD COLUMN userId TEXT`);
    }
  }
}

export async function initSchema(client: DbClient): Promise<void> {
  const idType = client.dialect === 'mysql' ? 'VARCHAR(36) PRIMARY KEY' : 'TEXT PRIMARY KEY';
  const dataType = client.dialect === 'mysql' ? 'LONGTEXT' : 'TEXT';
  await client.exec(
    `CREATE TABLE IF NOT EXISTS lessons(
      id ${idType},
      title TEXT,
      skill TEXT,
      createdAt TEXT,
      data ${dataType}
    )`,
  );
  await addLessonsUserIdColumn(client);
  await createUsersTable(client);
  await createModuleDataTable(client);
  await createVideoAnalysesTable(client);
  await createPictureBooksTable(client);
  await createTrainingTopicsTable(client);
  await backfillOwnerlessData(client);
}

export async function insertLesson(db: DbClient, lesson: Lesson, userId: string): Promise<void> {
  await db.run(
    `INSERT INTO lessons (id, title, skill, createdAt, data, userId) VALUES (?, ?, ?, ?, ?, ?)`,
    [lesson.id, lesson.title, lesson.input.skill, lesson.createdAt, JSON.stringify(lesson), userId],
  );
}

export async function updateLesson(db: DbClient, lesson: Lesson): Promise<void> {
  await db.run(`UPDATE lessons SET data = ? WHERE id = ?`, [JSON.stringify(lesson), lesson.id]);
}

function coverUrlFromLesson(lesson: Lesson): string | undefined {
  return lesson.images.find((image) => image.status === 'done' && image.url)?.url;
}

export async function listLessons(db: DbClient, userId: string): Promise<LessonListItem[]> {
  const rows = await db.all<LessonRow>(
    `SELECT id, title, skill, createdAt, data FROM lessons WHERE userId = ? ORDER BY createdAt DESC`,
    [userId],
  );

  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    skill: row.skill,
    createdAt: row.createdAt,
    coverUrl: coverUrlFromLesson(JSON.parse(row.data) as Lesson),
  }));
}

export async function getLesson(db: DbClient, id: string, userId?: string): Promise<Lesson | null> {
  const row = userId
    ? await db.get<{ data: string }>(`SELECT data FROM lessons WHERE id = ? AND userId = ?`, [id, userId])
    : await db.get<{ data: string }>(`SELECT data FROM lessons WHERE id = ?`, [id]);
  return row ? (JSON.parse(row.data) as Lesson) : null;
}

export async function deleteLesson(db: DbClient, id: string, userId?: string): Promise<boolean> {
  const result = userId
    ? await db.run(`DELETE FROM lessons WHERE id = ? AND userId = ?`, [id, userId])
    : await db.run(`DELETE FROM lessons WHERE id = ?`, [id]);
  return result.changes > 0;
}
