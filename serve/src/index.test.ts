import { describe, expect, it } from 'vitest';
import { buildApp } from './index.js';

describe('GET /health', () => {
  it('returns 200 and ok:true', async () => {
    const app = buildApp();
    const response = await app.inject({ method: 'GET', url: '/health' });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ ok: true });
  });
});
