import { generateJson as defaultGenerateJson } from '../ai/textClient.js';
import { buildStructurePrompt, STRUCTURE_SYSTEM_PROMPT } from '../ai/trainingPrompts.js';
import { StructuredContentSchema, type StructuredContent } from '../schema/training.js';

export interface GenerateTrainingContentDeps {
  generateJson?: typeof defaultGenerateJson;
}

export async function generateStructuredContent(
  title: string,
  rawTranscript: string,
  deps: GenerateTrainingContentDeps = {},
): Promise<StructuredContent> {
  const generateJson = deps.generateJson ?? defaultGenerateJson;
  const userPrompt = buildStructurePrompt(title, rawTranscript);

  const firstRaw = await generateJson(STRUCTURE_SYSTEM_PROMPT, userPrompt);
  const firstResult = StructuredContentSchema.safeParse(firstRaw);
  if (firstResult.success) return firstResult.data;

  const retryPrompt = `${userPrompt}\n\n上一次生成的 JSON 未通过校验，错误如下，请修正后重新输出一个完整、合法的 JSON 对象：\n${JSON.stringify(firstResult.error.issues)}`;
  const secondRaw = await generateJson(STRUCTURE_SYSTEM_PROMPT, retryPrompt);
  const secondResult = StructuredContentSchema.safeParse(secondRaw);
  if (!secondResult.success) {
    throw new Error(`结构化内容生成两次校验均失败: ${JSON.stringify(secondResult.error.issues)}`);
  }
  return secondResult.data;
}
