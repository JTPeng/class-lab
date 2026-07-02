import { beforeEach, describe, expect, it } from 'vitest';
import { generateJson } from './textClient.js';

function fakeChatCompletion(content: string) {
  return {
    id: 'chatcmpl-test',
    object: 'chat.completion',
    model: 'qwen3.7-max',
    choices: [
      {
        index: 0,
        message: { role: 'assistant', reasoning_content: '...ignored...', content },
        finish_reason: 'stop',
      },
    ],
    usage: {},
  };
}

describe('generateJson', () => {
  beforeEach(() => {
    process.env.MAAS_BASE_URL = 'https://example.com/compatible-mode/v1';
    process.env.MAAS_API_KEY = 'test-key';
    process.env.TEXT_MODEL = 'qwen3.7-max';
  });

  it('parses the JSON content of a well-formed chat.completion response', async () => {
    const fetchImpl = async () =>
      ({
        ok: true,
        status: 200,
        json: async () => fakeChatCompletion('{"foo":"bar"}'),
      }) as unknown as Response;

    const result = await generateJson('sys', 'user', { fetchImpl });

    expect(result).toEqual({ foo: 'bar' });
  });

  it('throws a clear error when content is not valid JSON', async () => {
    const fetchImpl = async () =>
      ({
        ok: true,
        status: 200,
        json: async () => fakeChatCompletion('not json'),
      }) as unknown as Response;

    await expect(generateJson('sys', 'user', { fetchImpl })).rejects.toThrow();
  });

  it('throws an error including status and body text on non-2xx response', async () => {
    const fetchImpl = async () =>
      ({
        ok: false,
        status: 401,
        text: async () => 'unauthorized',
      }) as unknown as Response;

    await expect(generateJson('sys', 'user', { fetchImpl })).rejects.toThrow(/401/);
    await expect(generateJson('sys', 'user', { fetchImpl })).rejects.toThrow(/unauthorized/);
  });
});
