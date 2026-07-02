export interface GenerateJsonOptions {
  fetchImpl?: typeof fetch;
}

export async function generateJson(
  system: string,
  user: string,
  opts: GenerateJsonOptions = {},
): Promise<unknown> {
  const fetchImpl = opts.fetchImpl ?? fetch;
  const baseUrl = process.env.MAAS_BASE_URL;
  const apiKey = process.env.MAAS_API_KEY;
  const model = process.env.TEXT_MODEL;

  const response = await fetchImpl(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      response_format: { type: 'json_object' },
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`MAAS chat/completions failed: ${response.status} ${body}`);
  }

  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content;

  if (typeof content !== 'string') {
    throw new Error('MAAS chat/completions response missing choices[0].message.content');
  }

  try {
    return JSON.parse(content);
  } catch {
    throw new Error(
      `MAAS chat/completions returned content that is not valid JSON: ${content}`,
    );
  }
}
