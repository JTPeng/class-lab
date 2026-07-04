import { randomUUID } from 'node:crypto';
import type { DbClient } from './client.js';

// 执行记录：个案每次训练（RoundFlow 演示走完点「结束训练」）落一条，
// 教师侧打分随提交一起写入；家长侧打分是后补的（通过 shareToken 免登录提交），初始为空。

export type GuardianDifficulty = 'too_easy' | 'just_right' | 'too_hard';

export interface CaseSessionRecord {
  id: string;
  caseId: string;
  lessonId: string | null;
  createdAt: string;
  trialsTotal: number;
  trialsCorrect: number;
  teacherCooperation: number;
  teacherProgress: number;
  guardianDifficulty: GuardianDifficulty | null;
  guardianInterest: number | null;
  guardianComment: string | null;
  guardianFeedbackAt: string | null;
}

export async function createCaseSessionsTable(db: DbClient): Promise<void> {
  const idColType = db.dialect === 'mysql' ? 'VARCHAR(191)' : 'TEXT';
  await db.exec(
    `CREATE TABLE IF NOT EXISTS case_sessions(
      id ${idColType} PRIMARY KEY,
      caseId ${idColType},
      lessonId ${idColType},
      createdAt TEXT,
      trialsTotal INTEGER,
      trialsCorrect INTEGER,
      teacherCooperation INTEGER,
      teacherProgress INTEGER,
      guardianDifficulty TEXT,
      guardianInterest INTEGER,
      guardianComment TEXT,
      guardianFeedbackAt TEXT
    )`,
  );
}

export async function createCaseSession(
  db: DbClient,
  input: {
    caseId: string;
    lessonId: string | null;
    trialsTotal: number;
    trialsCorrect: number;
    teacherCooperation: number;
    teacherProgress: number;
  },
): Promise<CaseSessionRecord> {
  const record: CaseSessionRecord = {
    id: randomUUID(),
    caseId: input.caseId,
    lessonId: input.lessonId,
    createdAt: new Date().toISOString(),
    trialsTotal: input.trialsTotal,
    trialsCorrect: input.trialsCorrect,
    teacherCooperation: input.teacherCooperation,
    teacherProgress: input.teacherProgress,
    guardianDifficulty: null,
    guardianInterest: null,
    guardianComment: null,
    guardianFeedbackAt: null,
  };
  await db.run(
    `INSERT INTO case_sessions
      (id, caseId, lessonId, createdAt, trialsTotal, trialsCorrect, teacherCooperation, teacherProgress, guardianDifficulty, guardianInterest, guardianComment, guardianFeedbackAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      record.id,
      record.caseId,
      record.lessonId,
      record.createdAt,
      record.trialsTotal,
      record.trialsCorrect,
      record.teacherCooperation,
      record.teacherProgress,
      record.guardianDifficulty,
      record.guardianInterest,
      record.guardianComment,
      record.guardianFeedbackAt,
    ],
  );
  return record;
}

export async function listCaseSessions(db: DbClient, caseId: string): Promise<CaseSessionRecord[]> {
  return db.all<CaseSessionRecord>(`SELECT * FROM case_sessions WHERE caseId = ? ORDER BY createdAt DESC`, [caseId]);
}

export async function submitGuardianFeedback(
  db: DbClient,
  sessionId: string,
  feedback: { difficulty: GuardianDifficulty; interest: number; comment: string | null },
): Promise<boolean> {
  const result = await db.run(
    `UPDATE case_sessions SET guardianDifficulty = ?, guardianInterest = ?, guardianComment = ?, guardianFeedbackAt = ? WHERE id = ?`,
    [feedback.difficulty, feedback.interest, feedback.comment, new Date().toISOString(), sessionId],
  );
  return result.changes > 0;
}
