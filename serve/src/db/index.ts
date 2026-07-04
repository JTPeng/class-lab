import type { DbClient } from './client.js';
import type { Lesson } from '../schema/lesson.js';
import { createUsersTable } from './users.js';
import { createModuleDataTable } from './moduleData.js';
import { createVideoAnalysesTable } from './videoAnalyses.js';
import { createPictureBooksTable, addPictureBooksCoverColumn } from './pictureBooks.js';
import { createTrainingTopicsTable } from './trainingTopics.js';
import { createTrainingQuestionsTable } from './trainingQuestions.js';
import { createTrainingAttemptsTable } from './trainingAttempts.js';
import { createCasesTable } from './cases.js';
import { createCaseSessionsTable } from './caseSessions.js';
import { createGameSessionsTable } from './gameSessions.js';
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

async function addLessonsCaseIdColumn(db: DbClient): Promise<void> {
  if (db.dialect === 'mysql') {
    const row = await db.get<{ count: number }>(
      `SELECT COUNT(*) AS count FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'lessons' AND column_name = 'caseId'`,
    );
    if (!row || row.count === 0) {
      await db.exec(`ALTER TABLE lessons ADD COLUMN caseId VARCHAR(191)`);
    }
  } else {
    const columns = await db.all<{ name: string }>(`PRAGMA table_info(lessons)`);
    if (!columns.some((c) => c.name === 'caseId')) {
      await db.exec(`ALTER TABLE lessons ADD COLUMN caseId TEXT`);
    }
  }
}

async function addPictureBooksScoreColumns(db: DbClient): Promise<void> {
  const columns: Array<[string, string]> = [
    ['caseId', db.dialect === 'mysql' ? 'VARCHAR(191)' : 'TEXT'],
    ['teacherCooperation', db.dialect === 'mysql' ? 'INT' : 'INTEGER'],
    ['teacherProgress', db.dialect === 'mysql' ? 'INT' : 'INTEGER'],
  ];
  for (const [name, colType] of columns) {
    if (db.dialect === 'mysql') {
      const row = await db.get<{ count: number }>(
        `SELECT COUNT(*) AS count FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'picture_books' AND column_name = ?`,
        [name],
      );
      if (!row || row.count === 0) {
        await db.exec(`ALTER TABLE picture_books ADD COLUMN ${name} ${colType}`);
      }
    } else {
      const existing = await db.all<{ name: string }>(`PRAGMA table_info(picture_books)`);
      if (!existing.some((c) => c.name === name)) {
        await db.exec(`ALTER TABLE picture_books ADD COLUMN ${name} ${colType}`);
      }
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
  await addLessonsCaseIdColumn(client);
  await createUsersTable(client);
  await createModuleDataTable(client);
  await createVideoAnalysesTable(client);
  await createPictureBooksTable(client);
  await createTrainingTopicsTable(client);
  await createTrainingQuestionsTable(client);
  await createTrainingAttemptsTable(client);
  await addPictureBooksScoreColumns(client);
  await addPictureBooksCoverColumn(client);
  await createCasesTable(client);
  await createCaseSessionsTable(client);
  await createGameSessionsTable(client);
  await backfillOwnerlessData(client);
}

export async function insertLesson(db: DbClient, lesson: Lesson, userId: string, caseId: string): Promise<void> {
  await db.run(
    `INSERT INTO lessons (id, title, skill, createdAt, data, userId, caseId) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [lesson.id, lesson.title, lesson.input.skill, lesson.createdAt, JSON.stringify(lesson), userId, caseId],
  );
}

export async function updateLesson(db: DbClient, lesson: Lesson): Promise<void> {
  await db.run(`UPDATE lessons SET data = ? WHERE id = ?`, [JSON.stringify(lesson), lesson.id]);
}

function coverUrlFromLesson(lesson: Lesson): string | undefined {
  return lesson.images.find((image) => image.status === 'done' && image.url)?.url;
}

export async function listLessons(db: DbClient, caseId: string): Promise<LessonListItem[]> {
  const rows = await db.all<LessonRow>(
    `SELECT id, title, skill, createdAt, data FROM lessons WHERE caseId = ? ORDER BY createdAt DESC`,
    [caseId],
  );

  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    skill: row.skill,
    createdAt: row.createdAt,
    coverUrl: coverUrlFromLesson(JSON.parse(row.data) as Lesson),
  }));
}

export async function getLesson(db: DbClient, id: string, caseId?: string): Promise<Lesson | null> {
  const row = caseId
    ? await db.get<{ data: string }>(`SELECT data FROM lessons WHERE id = ? AND caseId = ?`, [id, caseId])
    : await db.get<{ data: string }>(`SELECT data FROM lessons WHERE id = ?`, [id]);
  return row ? (JSON.parse(row.data) as Lesson) : null;
}

export async function deleteLesson(db: DbClient, id: string, caseId?: string): Promise<boolean> {
  const result = caseId
    ? await db.run(`DELETE FROM lessons WHERE id = ? AND caseId = ?`, [id, caseId])
    : await db.run(`DELETE FROM lessons WHERE id = ?`, [id]);
  return result.changes > 0;
}
