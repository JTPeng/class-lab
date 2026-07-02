import { generateJson as defaultGenerateJson } from '../ai/textClient.js';
import { buildUserPrompt, LESSON_SYSTEM_PROMPT } from '../ai/lessonPrompt.js';
import { GeneratedLessonSchema, LessonSchema, type Lesson, type LessonInput } from '../schema/lesson.js';

export interface GenerateLessonDeps {
  generateJson?: typeof defaultGenerateJson;
}

export async function generateLesson(input: LessonInput, deps: GenerateLessonDeps = {}): Promise<Lesson> {
  const generateJson = deps.generateJson ?? defaultGenerateJson;
  const system = LESSON_SYSTEM_PROMPT;
  const userPrompt = buildUserPrompt(input);

  const firstRaw = await generateJson(system, userPrompt);
  const firstResult = GeneratedLessonSchema.safeParse(firstRaw);

  let generated;
  if (firstResult.success) {
    generated = firstResult.data;
  } else {
    const retryUserPrompt = `${userPrompt}\n\n上一次生成的 JSON 未通过校验，错误如下，请修正后重新输出一个完整、合法的 JSON 对象：\n${JSON.stringify(firstResult.error.issues)}`;
    const secondRaw = await generateJson(system, retryUserPrompt);
    const secondResult = GeneratedLessonSchema.safeParse(secondRaw);

    if (!secondResult.success) {
      throw new Error(`教案生成两次校验均失败: ${JSON.stringify(secondResult.error.issues)}`);
    }

    generated = secondResult.data;
  }

  return LessonSchema.parse({
    ...generated,
    id: crypto.randomUUID(),
    schemaVersion: 1,
    templateType: 'dtt',
    createdAt: new Date().toISOString(),
    input,
    images: [],
  });
}
