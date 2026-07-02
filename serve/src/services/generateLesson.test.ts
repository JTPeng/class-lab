import { describe, expect, it, vi } from 'vitest';
import type { LessonInput } from '../schema/lesson.js';
import { generateLesson } from './generateLesson.js';

const validInput: LessonInput = {
  skill: '物品配对',
  availableTools: ['碗', '代币'],
  context: '机构',
  reinforcerPref: '贴纸',
  sessionMinutes: 20,
};

function validGeneratedLessonFixture() {
  return {
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
    targetList: [{ target: '铁碗、塑料碗、瓷碗、橡胶碗', introDate: null, masteryDate: null }],
    sessionSuggestion: '建议每次 20 分钟,进行 10 个回合',
  };
}

function invalidGeneratedLessonFixture() {
  // missing required `sto` field
  const { sto, ...rest } = validGeneratedLessonFixture();
  return rest;
}

describe('generateLesson', () => {
  it('retries once and resolves when the first attempt fails validation but the second succeeds', async () => {
    const generateJson = vi
      .fn()
      .mockResolvedValueOnce(invalidGeneratedLessonFixture())
      .mockResolvedValueOnce(validGeneratedLessonFixture());

    const lesson = await generateLesson(validInput, { generateJson });

    expect(generateJson).toHaveBeenCalledTimes(2);
    expect(lesson.title).toBe('碗的配对训练');
  });

  it('throws when both attempts fail validation', async () => {
    const generateJson = vi
      .fn()
      .mockResolvedValueOnce(invalidGeneratedLessonFixture())
      .mockResolvedValueOnce(invalidGeneratedLessonFixture());

    await expect(generateLesson(validInput, { generateJson })).rejects.toThrow();
    expect(generateJson).toHaveBeenCalledTimes(2);
  });

  it('assembles a full Lesson (id/schemaVersion/templateType/createdAt/input/images) on first success', async () => {
    const generateJson = vi.fn().mockResolvedValueOnce(validGeneratedLessonFixture());

    const lesson = await generateLesson(validInput, { generateJson });

    expect(generateJson).toHaveBeenCalledTimes(1);
    expect(lesson.id).toBeTruthy();
    expect(typeof lesson.id).toBe('string');
    expect(lesson.schemaVersion).toBe(1);
    expect(lesson.templateType).toBe('dtt');
    expect(new Date(lesson.createdAt).toISOString()).toBe(lesson.createdAt);
    expect(lesson.input).toEqual(validInput);
    expect(lesson.images).toEqual([]);
  });
});
