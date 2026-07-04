import { describe, expect, it } from 'vitest';
import { createDbClient } from './client.js';
import { createCase, deleteCase, getCase, getCaseByShareToken, listCases, updateCase } from './cases.js';
import { initSchema } from './index.js';

async function memoryDb() {
  const db = await createDbClient({ driver: 'sqlite', sqlitePath: ':memory:' });
  await initSchema(db);
  return db;
}

const TEACHER_ID = 'teacher-001';

describe('db/cases repository', () => {
  it('creates a case with a generated id and shareToken', async () => {
    const db = await memoryDb();

    const record = await createCase(db, {
      teacherId: TEACHER_ID,
      name: '小明',
      baseline: '能仿说单字',
      targets: ['配对', '仿说'],
    });

    expect(record.id).toBeTruthy();
    expect(record.shareToken).toBeTruthy();
    expect(await getCase(db, record.id)).toEqual(record);
  });

  it('getCaseByShareToken finds the case by its share token', async () => {
    const db = await memoryDb();
    const record = await createCase(db, { teacherId: TEACHER_ID, name: '小明', baseline: '', targets: [] });

    expect(await getCaseByShareToken(db, record.shareToken)).toEqual(record);
    expect(await getCaseByShareToken(db, 'missing')).toBeNull();
  });

  it('listCases only returns cases belonging to the given teacherId, newest first', async () => {
    const db = await memoryDb();
    const mine = await createCase(db, { teacherId: TEACHER_ID, name: '小明', baseline: '', targets: [] });
    await createCase(db, { teacherId: 'teacher-002', name: '小红', baseline: '', targets: [] });

    const list = await listCases(db, TEACHER_ID);

    expect(list.map((item) => item.id)).toEqual([mine.id]);
  });

  it('updateCase merges the patch and returns false for a missing/foreign id', async () => {
    const db = await memoryDb();
    const record = await createCase(db, { teacherId: TEACHER_ID, name: '小明', baseline: '旧基线', targets: [] });

    expect(await updateCase(db, record.id, TEACHER_ID, { baseline: '新基线' })).toBe(true);
    expect((await getCase(db, record.id))?.baseline).toBe('新基线');
    expect(await updateCase(db, record.id, 'teacher-002', { baseline: '被别人改' })).toBe(false);
    expect(await updateCase(db, 'missing', TEACHER_ID, { baseline: 'x' })).toBe(false);
  });

  it('deleteCase removes the row and returns true, then false for missing id', async () => {
    const db = await memoryDb();
    const record = await createCase(db, { teacherId: TEACHER_ID, name: '小明', baseline: '', targets: [] });

    expect(await deleteCase(db, record.id, TEACHER_ID)).toBe(true);
    expect(await getCase(db, record.id)).toBeNull();
    expect(await deleteCase(db, record.id, TEACHER_ID)).toBe(false);
  });
});
