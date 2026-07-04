// serve/src/services/generateTrainingQuestions.ts
import { generateJson as defaultGenerateJson } from '../ai/textClient.js';
import { buildQuestionPrompt, QUESTION_SYSTEM_PROMPT } from '../ai/trainingPrompts.js';
import { QuestionBankSchema, type GeneratedQuestion, type StructuredContent } from '../schema/training.js';

export interface GenerateTrainingQuestionsDeps {
  generateJson?: typeof defaultGenerateJson;
}

export async function generateTrainingQuestions(
  content: StructuredContent,
  deps: GenerateTrainingQuestionsDeps = {},
): Promise<GeneratedQuestion[]> {
  const generateJson = deps.generateJson ?? defaultGenerateJson;
  const userPrompt = buildQuestionPrompt(content.summary, content.sections);

  const firstRaw = await generateJson(QUESTION_SYSTEM_PROMPT, userPrompt);
  const firstResult = QuestionBankSchema.safeParse(firstRaw);
  if (firstResult.success) return firstResult.data.questions;

  const retryPrompt = `${userPrompt}\n\n上一次生成的 JSON 未通过校验，错误如下，请修正后重新输出一个完整、合法的 JSON 对象：\n${JSON.stringify(firstResult.error.issues)}`;
  const secondRaw = await generateJson(QUESTION_SYSTEM_PROMPT, retryPrompt);
  const secondResult = QuestionBankSchema.safeParse(secondRaw);
  if (!secondResult.success) {
    throw new Error(`题库生成两次校验均失败: ${JSON.stringify(secondResult.error.issues)}`);
  }
  return secondResult.data.questions;
}
