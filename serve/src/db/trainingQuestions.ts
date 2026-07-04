// serve/src/db/trainingQuestions.ts
import { randomUUID } from 'node:crypto';
import type { DbClient } from './client.js';
import type { GeneratedQuestion, TrainingQuestion } from '../schema/training.js';

type TrainingQuestionRow = {
  id: string;
  topicId: string;
  type: string;
  question: string;
  options: string;
  correctAnswers: string;
  explanation: string;
  createdAt: string;
};

function rowToQuestion(row: TrainingQuestionRow): TrainingQuestion {
  return {
    id: row.id,
    topicId: row.topicId,
    type: row.type as TrainingQuestion['type'],
    question: row.question,
    options: JSON.parse(row.options),
    correctAnswers: JSON.parse(row.correctAnswers),
    explanation: row.explanation,
    createdAt: row.createdAt,
  };
}

export async function createTrainingQuestionsTable(db: DbClient): Promise<void> {
  const idColType = db.dialect === 'mysql' ? 'VARCHAR(191)' : 'TEXT';
  const dataType = db.dialect === 'mysql' ? 'LONGTEXT' : 'TEXT';
  await db.exec(
    `CREATE TABLE IF NOT EXISTS training_questions(
      id ${idColType} PRIMARY KEY,
      topicId ${idColType},
      type TEXT,
      question TEXT,
      options ${dataType},
      correctAnswers ${dataType},
      explanation ${dataType},
      createdAt TEXT
    )`,
  );
}

export async function insertTrainingQuestions(
  db: DbClient,
  topicId: string,
  questions: GeneratedQuestion[],
): Promise<TrainingQuestion[]> {
  const records: TrainingQuestion[] = questions.map((q) => ({
    id: randomUUID(),
    topicId,
    type: q.type,
    question: q.question,
    options: q.options,
    correctAnswers: q.correctAnswers,
    explanation: q.explanation,
    createdAt: new Date().toISOString(),
  }));
  for (const r of records) {
    await db.run(
      `INSERT INTO training_questions (id, topicId, type, question, options, correctAnswers, explanation, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [r.id, r.topicId, r.type, r.question, JSON.stringify(r.options), JSON.stringify(r.correctAnswers), r.explanation, r.createdAt],
    );
  }
  return records;
}

export async function listTrainingQuestionsByTopic(db: DbClient, topicId: string): Promise<TrainingQuestion[]> {
  const rows = await db.all<TrainingQuestionRow>(
    `SELECT * FROM training_questions WHERE topicId = ? ORDER BY createdAt ASC`,
    [topicId],
  );
  return rows.map(rowToQuestion);
}
