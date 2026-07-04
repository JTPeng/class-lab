// serve/src/db/trainingTopics.ts
import { randomUUID } from 'node:crypto';
import type { DbClient } from './client.js';
import type { StructuredContent, TrainingTopic } from '../schema/training.js';

type TrainingTopicRow = {
  id: string;
  title: string;
  rawTranscript: string;
  structuredContent: string | null;
  createdAt: string;
};

function rowToTopic(row: TrainingTopicRow): TrainingTopic {
  return {
    id: row.id,
    title: row.title,
    rawTranscript: row.rawTranscript,
    structuredContent: row.structuredContent ? (JSON.parse(row.structuredContent) as StructuredContent) : null,
    createdAt: row.createdAt,
  };
}

export async function createTrainingTopicsTable(db: DbClient): Promise<void> {
  const idColType = db.dialect === 'mysql' ? 'VARCHAR(191)' : 'TEXT';
  const dataType = db.dialect === 'mysql' ? 'LONGTEXT' : 'TEXT';
  await db.exec(
    `CREATE TABLE IF NOT EXISTS training_topics(
      id ${idColType} PRIMARY KEY,
      title TEXT,
      rawTranscript ${dataType},
      structuredContent ${dataType},
      createdAt TEXT
    )`,
  );
}

export async function insertTrainingTopic(
  db: DbClient,
  input: { title: string; rawTranscript: string; structuredContent: StructuredContent },
): Promise<TrainingTopic> {
  const record: TrainingTopic = {
    id: randomUUID(),
    title: input.title,
    rawTranscript: input.rawTranscript,
    structuredContent: input.structuredContent,
    createdAt: new Date().toISOString(),
  };
  await db.run(
    `INSERT INTO training_topics (id, title, rawTranscript, structuredContent, createdAt) VALUES (?, ?, ?, ?, ?)`,
    [record.id, record.title, record.rawTranscript, JSON.stringify(record.structuredContent), record.createdAt],
  );
  return record;
}

export async function listTrainingTopics(db: DbClient): Promise<TrainingTopic[]> {
  const rows = await db.all<TrainingTopicRow>(`SELECT * FROM training_topics ORDER BY createdAt ASC`);
  return rows.map(rowToTopic);
}

export async function getTrainingTopic(db: DbClient, id: string): Promise<TrainingTopic | null> {
  const row = await db.get<TrainingTopicRow>(`SELECT * FROM training_topics WHERE id = ?`, [id]);
  return row ? rowToTopic(row) : null;
}
