import Database from 'better-sqlite3';
import type { Lesson } from '../schema/lesson.js';
import { createUsersTable } from './users.js';
import { createModuleDataTable } from './moduleData.js';

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

export function getDb(path = 'lessons.db'): Database.Database {
  const db = new Database(path);
  db.exec(
    `CREATE TABLE IF NOT EXISTS lessons(
      id TEXT PRIMARY KEY,
      title TEXT,
      skill TEXT,
      createdAt TEXT,
      data TEXT
    )`,
  );
  createUsersTable(db);
  createModuleDataTable(db);
  return db;
}

export function insertLesson(db: Database.Database, lesson: Lesson): void {
  db.prepare(
    `INSERT INTO lessons (id, title, skill, createdAt, data) VALUES (?, ?, ?, ?, ?)`,
  ).run(lesson.id, lesson.title, lesson.input.skill, lesson.createdAt, JSON.stringify(lesson));
}

export function updateLesson(db: Database.Database, lesson: Lesson): void {
  db.prepare(`UPDATE lessons SET data = ? WHERE id = ?`).run(JSON.stringify(lesson), lesson.id);
}

function coverUrlFromLesson(lesson: Lesson): string | undefined {
  return lesson.images.find((image) => image.status === 'done' && image.url)?.url;
}

export function listLessons(db: Database.Database): LessonListItem[] {
  const rows = db
    .prepare(`SELECT id, title, skill, createdAt, data FROM lessons ORDER BY createdAt DESC`)
    .all() as LessonRow[];

  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    skill: row.skill,
    createdAt: row.createdAt,
    coverUrl: coverUrlFromLesson(JSON.parse(row.data) as Lesson),
  }));
}

export function getLesson(db: Database.Database, id: string): Lesson | null {
  const row = db.prepare(`SELECT data FROM lessons WHERE id = ?`).get(id) as
    | { data: string }
    | undefined;

  return row ? (JSON.parse(row.data) as Lesson) : null;
}

export function deleteLesson(db: Database.Database, id: string): boolean {
  const result = db.prepare(`DELETE FROM lessons WHERE id = ?`).run(id);
  return result.changes > 0;
}
