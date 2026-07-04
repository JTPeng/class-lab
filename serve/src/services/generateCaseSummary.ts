import { generateJson as defaultGenerateJson } from '../ai/textClient.js';
import { buildCaseSummaryPrompt, CASE_SUMMARY_SYSTEM_PROMPT, type CaseSummaryPromptInput } from '../ai/caseSummaryPrompt.js';
import { CaseSummarySchema } from '../schema/case.js';

export interface GenerateCaseSummaryDeps {
  generateJson?: typeof defaultGenerateJson;
}

export async function generateCaseSummary(
  input: CaseSummaryPromptInput,
  deps: GenerateCaseSummaryDeps = {},
): Promise<string> {
  const generateJson = deps.generateJson ?? defaultGenerateJson;
  const userPrompt = buildCaseSummaryPrompt(input);

  const firstRaw = await generateJson(CASE_SUMMARY_SYSTEM_PROMPT, userPrompt);
  const firstResult = CaseSummarySchema.safeParse(firstRaw);
  if (firstResult.success) return firstResult.data.summary;

  const retryPrompt = `${userPrompt}\n\n上一次生成的 JSON 未通过校验，错误如下，请修正后重新输出一个完整、合法的 JSON 对象：\n${JSON.stringify(firstResult.error.issues)}`;
  const secondRaw = await generateJson(CASE_SUMMARY_SYSTEM_PROMPT, retryPrompt);
  const secondResult = CaseSummarySchema.safeParse(secondRaw);
  if (!secondResult.success) {
    throw new Error(`个案总结生成两次校验均失败: ${JSON.stringify(secondResult.error.issues)}`);
  }
  return secondResult.data.summary;
}
