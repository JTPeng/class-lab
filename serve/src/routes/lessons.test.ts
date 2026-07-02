import { describe, expect, it, vi } from 'vitest';
import { buildApp } from '../index.js';
import { getDb } from '../db/index.js';
import type { Lesson, LessonInput } from '../schema/lesson.js';

const validInput: LessonInput = {
  skill: '物品配对',
  availableTools: ['碗', '代币'],
  context: '机构',
  reinforcerPref: '贴纸',
  sessionMinutes: 20,
};

function lessonFixture(): Lesson {
  return {
    id: 'lesson-001',
    schemaVersion: 1,
    templateType: 'dtt',
    title: '碗的配对训练',
    createdAt: '2026-07-01T00:00:00.000Z',
    input: validInput,
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
    images: [],
  };
}

function buildTestApp(generateLesson = vi.fn().mockResolvedValue(lessonFixture())) {
  const db = getDb(':memory:');
  const app = buildApp({ db, generateLesson });
  return { app, db, generateLesson };
}

describe('lessons routes', () => {
  it('POST /api/lessons/generate returns 200 + the generated lesson, then it is listable/gettable', async () => {
    const fixture = lessonFixture();
    const { app } = buildTestApp(vi.fn().mockResolvedValue(fixture));

    const generateResponse = await app.inject({
      method: 'POST',
      url: '/api/lessons/generate',
      payload: validInput,
    });

    expect(generateResponse.statusCode).toBe(200);
    expect(generateResponse.json()).toEqual(fixture);

    const listResponse = await app.inject({ method: 'GET', url: '/api/lessons' });
    expect(listResponse.statusCode).toBe(200);
    expect(listResponse.json()).toEqual([
      {
        id: fixture.id,
        title: fixture.title,
        skill: fixture.input.skill,
        createdAt: fixture.createdAt,
        coverUrl: undefined,
      },
    ]);

    const getResponse = await app.inject({ method: 'GET', url: `/api/lessons/${fixture.id}` });
    expect(getResponse.statusCode).toBe(200);
    expect(getResponse.json()).toEqual(fixture);
  });

  it('POST /api/lessons/generate returns 400 for invalid input', async () => {
    const { app } = buildTestApp();

    const response = await app.inject({
      method: 'POST',
      url: '/api/lessons/generate',
      payload: { availableTools: ['碗'], context: '机构' }, // missing `skill`
    });

    expect(response.statusCode).toBe(400);
  });

  it('POST /api/lessons/generate returns 502 when generation fails', async () => {
    const { app } = buildTestApp(vi.fn().mockRejectedValue(new Error('upstream boom')));

    const response = await app.inject({
      method: 'POST',
      url: '/api/lessons/generate',
      payload: validInput,
    });

    expect(response.statusCode).toBe(502);
    expect(response.json().error).not.toMatch(/upstream boom/);
  });

  it('GET /api/lessons/:id returns 404 for an unknown id', async () => {
    const { app } = buildTestApp();

    const response = await app.inject({ method: 'GET', url: '/api/lessons/unknown-id' });

    expect(response.statusCode).toBe(404);
  });

  it('DELETE /api/lessons/:id returns 204, then GET :id returns 404', async () => {
    const fixture = lessonFixture();
    const { app } = buildTestApp(vi.fn().mockResolvedValue(fixture));

    await app.inject({ method: 'POST', url: '/api/lessons/generate', payload: validInput });

    const deleteResponse = await app.inject({
      method: 'DELETE',
      url: `/api/lessons/${fixture.id}`,
    });
    expect(deleteResponse.statusCode).toBe(204);
    expect(deleteResponse.body).toBe('');

    const getResponse = await app.inject({ method: 'GET', url: `/api/lessons/${fixture.id}` });
    expect(getResponse.statusCode).toBe(404);
  });
});
