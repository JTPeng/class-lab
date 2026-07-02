import { describe, expect, it } from 'vitest';
import { LessonSchema, type Lesson } from '../schema/lesson.js';
import {
  deleteLesson,
  getDb,
  getLesson,
  insertLesson,
  listLessons,
} from './index.js';

function buildLesson(overrides: Partial<Lesson> = {}): Lesson {
  const base = {
    id: 'lesson-001',
    schemaVersion: 1,
    templateType: 'dtt',
    title: '碗的配对训练',
    createdAt: '2026-07-01T00:00:00.000Z',
    input: {
      skill: '物品配对',
      availableTools: ['碗', '代币'],
      context: '机构',
      reinforcerPref: '贴纸',
      sessionMinutes: 20,
    },
    longTermGoal: {
      description: '能够在多种干扰项下正确配对同类物品',
      passCriteria: '80%×3, 90%×2',
    },
    phases: [
      {
        name: '阶段一',
        description: '3D&3D 不完全相同物品配物品',
        startDate: null,
        passDate: null,
      },
    ],
    sto: {
      teachingMaterials: '铁碗、塑料碗、瓷碗、橡胶碗等多重范例',
      objectives: ['能配对相同材质的碗', '能配对不同材质的碗'],
      strategy: '最小提示原则,逐步撤除提示',
      reinforcementPlan: '正确反应后立即给予代币增强',
      procedure: {
        sd: '呈现刺激并说“把一样的放一起”',
        correct: { response: '正确配对', consequence: '立即代币+口头夸奖' },
        incorrect: { response: '配对错误或无反应', correction: '示范正确配对后重新尝试' },
      },
      dataCollection: '每次尝试记录正确/错误',
      masteryCriteria: '连续 3 次达到 80% 正确率',
    },
    targetList: [
      { target: '铁碗、塑料碗、瓷碗、橡胶碗', introDate: null, masteryDate: null },
    ],
    sessionSuggestion: '建议每次 20 分钟,进行 10 个回合',
    images: [
      { refKey: 'target:碗', prompt: '四种材质的碗', status: 'pending' },
    ],
    ...overrides,
  };

  return LessonSchema.parse(base);
}

describe('db/lessons repository', () => {
  it('round-trips a lesson through insertLesson/getLesson', () => {
    const db = getDb(':memory:');
    const lesson = buildLesson();

    insertLesson(db, lesson);

    expect(getLesson(db, lesson.id)).toEqual(lesson);
  });

  it('returns null from getLesson when the id does not exist', () => {
    const db = getDb(':memory:');

    expect(getLesson(db, 'missing')).toBeNull();
  });

  it('listLessons returns summary fields ordered newest first', () => {
    const db = getDb(':memory:');
    const older = buildLesson({
      id: 'lesson-old',
      title: '旧教案',
      createdAt: '2026-07-01T00:00:00.000Z',
    });
    const newer = buildLesson({
      id: 'lesson-new',
      title: '新教案',
      createdAt: '2026-07-02T00:00:00.000Z',
    });

    insertLesson(db, older);
    insertLesson(db, newer);

    const list = listLessons(db);

    expect(list).toHaveLength(2);
    expect(list.map((item) => item.id)).toEqual(['lesson-new', 'lesson-old']);
    expect(list[0]).toEqual({
      id: 'lesson-new',
      title: '新教案',
      skill: '物品配对',
      createdAt: '2026-07-02T00:00:00.000Z',
      coverUrl: undefined,
    });
  });

  it('listLessons derives coverUrl from the first done image with a url', () => {
    const db = getDb(':memory:');
    const lesson = buildLesson({
      images: [
        { refKey: 'target:a', prompt: 'a', status: 'pending' },
        { refKey: 'target:b', prompt: 'b', status: 'done', url: 'https://example.com/b.png' },
        { refKey: 'target:c', prompt: 'c', status: 'done', url: 'https://example.com/c.png' },
      ],
    });

    insertLesson(db, lesson);

    expect(listLessons(db)[0].coverUrl).toBe('https://example.com/b.png');
  });

  it('deleteLesson removes the row and returns true, then false for missing id', () => {
    const db = getDb(':memory:');
    const lesson = buildLesson();
    insertLesson(db, lesson);

    expect(deleteLesson(db, lesson.id)).toBe(true);
    expect(getLesson(db, lesson.id)).toBeNull();
    expect(deleteLesson(db, lesson.id)).toBe(false);
  });
});
