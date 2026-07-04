import { describe, expect, it } from 'vitest';
import { createDbClient } from './client.js';
import { createCaseSession, listCaseSessions, submitGuardianFeedback } from './caseSessions.js';
import { initSchema } from './index.js';

async function memoryDb() {
  const db = await createDbClient({ driver: 'sqlite', sqlitePath: ':memory:' });
  await initSchema(db);
  return db;
}

const CASE_ID = 'case-001';

describe('db/caseSessions repository', () => {
  it('creates a session with guardian fields left null', async () => {
    const db = await memoryDb();

    const record = await createCaseSession(db, {
      caseId: CASE_ID,
      lessonId: 'lesson-001',
      trialsTotal: 10,
      trialsCorrect: 8,
      teacherCooperation: 4,
      teacherProgress: 3,
    });

    expect(record.id).toBeTruthy();
    expect(record.guardianDifficulty).toBeNull();
    expect(record.guardianInterest).toBeNull();
    expect(record.guardianComment).toBeNull();
    expect(record.guardianFeedbackAt).toBeNull();
  });

  it('listCaseSessions only returns sessions for the given caseId, newest first', async () => {
    const db = await memoryDb();
    const mine = await createCaseSession(db, {
      caseId: CASE_ID,
      lessonId: null,
      trialsTotal: 10,
      trialsCorrect: 8,
      teacherCooperation: 4,
      teacherProgress: 3,
    });
    await createCaseSession(db, {
      caseId: 'case-002',
      lessonId: null,
      trialsTotal: 10,
      trialsCorrect: 5,
      teacherCooperation: 3,
      teacherProgress: 3,
    });

    const list = await listCaseSessions(db, CASE_ID);

    expect(list.map((item) => item.id)).toEqual([mine.id]);
  });

  it('submitGuardianFeedback fills the guardian fields and returns true, then false for missing id', async () => {
    const db = await memoryDb();
    const record = await createCaseSession(db, {
      caseId: CASE_ID,
      lessonId: null,
      trialsTotal: 10,
      trialsCorrect: 8,
      teacherCooperation: 4,
      teacherProgress: 3,
    });

    expect(
      await submitGuardianFeedback(db, record.id, {
        difficulty: 'just_right',
        interest: 5,
        comment: '孩子很喜欢',
      }),
    ).toBe(true);

    const [updated] = await listCaseSessions(db, CASE_ID);
    expect(updated.guardianDifficulty).toBe('just_right');
    expect(updated.guardianInterest).toBe(5);
    expect(updated.guardianComment).toBe('孩子很喜欢');
    expect(updated.guardianFeedbackAt).toBeTruthy();

    expect(await submitGuardianFeedback(db, 'missing', { difficulty: 'too_hard', interest: 1, comment: null })).toBe(
      false,
    );
  });
});
