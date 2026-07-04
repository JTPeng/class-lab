import { generateJson as defaultGenerateJson } from '../ai/textClient.js';
import { buildFeedbackPrompt, FEEDBACK_SYSTEM_PROMPT } from '../ai/trainingPrompts.js';
import { FeedbackSchema } from '../schema/training.js';

export interface GenerateTrainingFeedbackDeps {
  generateJson?: typeof defaultGenerateJson;
}

export async function generateTrainingFeedback(
  score: number,
  total: number,
  wrongItems: { question: string; explanation: string }[],
  deps: GenerateTrainingFeedbackDeps = {},
): Promise<string> {
  const generateJson = deps.generateJson ?? defaultGenerateJson;
  const userPrompt = buildFeedbackPrompt(score, total, wrongItems);

  const firstRaw = await generateJson(FEEDBACK_SYSTEM_PROMPT, userPrompt);
  const firstResult = FeedbackSchema.safeParse(firstRaw);
  if (firstResult.success) return firstResult.data.feedback;

  const retryPrompt = `${userPrompt}\n\n上一次生成的 JSON 未通过校验，错误如下，请修正后重新输出一个完整、合法的 JSON 对象：\n${JSON.stringify(firstResult.error.issues)}`;
  const secondRaw = await generateJson(FEEDBACK_SYSTEM_PROMPT, retryPrompt);
  const secondResult = FeedbackSchema.safeParse(secondRaw);
  if (!secondResult.success) {
    throw new Error(`反馈生成两次校验均失败: ${JSON.stringify(secondResult.error.issues)}`);
  }
  return secondResult.data.feedback;
}
