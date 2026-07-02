import { describe, expect, it } from 'vitest';
import {
  GeneratedLessonSchema,
  LessonSchema,
} from './lesson.js';

const validGeneratedLesson = {
  title: '碗的配对训练',
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
};

const validLesson = {
  id: 'lesson-001',
  schemaVersion: 1,
  templateType: 'dtt',
  title: validGeneratedLesson.title,
  createdAt: '2026-07-02T00:00:00.000Z',
  input: {
    skill: '物品配对',
    availableTools: ['碗', '代币'],
    context: '机构',
    reinforcerPref: '贴纸',
    sessionMinutes: 20,
  },
  longTermGoal: validGeneratedLesson.longTermGoal,
  phases: validGeneratedLesson.phases,
  sto: validGeneratedLesson.sto,
  targetList: validGeneratedLesson.targetList,
  sessionSuggestion: validGeneratedLesson.sessionSuggestion,
  images: [
    { refKey: 'target:碗', prompt: '四种材质的碗', status: 'pending' },
  ],
};

describe('LessonSchema', () => {
  it('accepts a fully valid lesson sample', () => {
    expect(() => LessonSchema.parse(validLesson)).not.toThrow();
  });

  it('rejects when sto.procedure.sd is missing', () => {
    const invalid = structuredClone(validLesson);
    delete (invalid.sto.procedure as Record<string, unknown>).sd;

    expect(() => LessonSchema.parse(invalid)).toThrow();
  });

  it('rejects when phases[].startDate is a non-null string', () => {
    const invalid = structuredClone(validLesson);
    invalid.phases[0].startDate = '2026-07-01' as unknown as null;

    expect(() => LessonSchema.parse(invalid)).toThrow();
  });

  it('rejects when sto.objectives has fewer than 2 items', () => {
    const invalid = structuredClone(validLesson);
    invalid.sto.objectives = ['只有一个目标'];

    expect(() => LessonSchema.parse(invalid)).toThrow();
  });
});

describe('GeneratedLessonSchema', () => {
  it('accepts the generated-subset sample (no id/schemaVersion/templateType/createdAt/input/images)', () => {
    expect(() => GeneratedLessonSchema.parse(validGeneratedLesson)).not.toThrow();
  });
});
