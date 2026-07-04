import { randomUUID } from 'node:crypto';
import type { DbClient } from './client.js';
import type { TrainingAttempt } from '../schema/training.js';

type TrainingAttemptRow = {
  id: string;
  topicId: string;
  userId: string;
  answers: string;
  score: number;
  feedback: string;
  createdAt: string;
};

function rowToAttempt(row: TrainingAttemptRow): TrainingAttempt {
  return {
    id: row.id,
    topicId: row.topicId,
    userId: row.userId,
    answers: JSON.parse(row.answers),
    score: row.score,
    feedback: row.feedback,
    createdAt: row.createdAt,
  };
}

export async function createTrainingAttemptsTable(db: DbClient): Promise<void> {
  const idColType = db.dialect === 'mysql' ? 'VARCHAR(191)' : 'TEXT';
  const dataType = db.dialect === 'mysql' ? 'LONGTEXT' : 'TEXT';
  await db.exec(
    `CREATE TABLE IF NOT EXISTS training_attempts(
      id ${idColType} PRIMARY KEY,
      topicId ${idColType},
      userId ${idColType},
      answers ${dataType},
      score INTEGER,
      feedback ${dataType},
      createdAt TEXT
    )`,
  );
}

export async function insertTrainingAttempt(
  db: DbClient,
  input: { topicId: string; userId: string; answers: number[][]; score: number; feedback: string },
): Promise<TrainingAttempt> {
  const record: TrainingAttempt = {
    id: randomUUID(),
    topicId: input.topicId,
    userId: input.userId,
    answers: input.answers,
    score: input.score,
    feedback: input.feedback,
    createdAt: new Date().toISOString(),
  };
  await db.run(
    `INSERT INTO training_attempts (id, topicId, userId, answers, score, feedback, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [record.id, record.topicId, record.userId, JSON.stringify(record.answers), record.score, record.feedback, record.createdAt],
  );
  return record;
}

export async function listTrainingAttempts(db: DbClient, topicId: string, userId: string): Promise<TrainingAttempt[]> {
  const rows = await db.all<TrainingAttemptRow>(
    `SELECT * FROM training_attempts WHERE topicId = ? AND userId = ? ORDER BY createdAt DESC`,
    [topicId, userId],
  );
  return rows.map(rowToAttempt);
}
