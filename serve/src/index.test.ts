import { describe, expect, it } from 'vitest';
import { buildApp } from './index.js';
import { createDbClient } from './db/client.js';
import { initSchema } from './db/index.js';

describe('GET /health', () => {
  it('returns 200 and ok:true', async () => {
    const db = await createDbClient({ driver: 'sqlite', sqlitePath: ':memory:' });
    await initSchema(db);
    const app = await buildApp({ db });
    const response = await app.inject({ method: 'GET', url: '/health' });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ ok: true });
  });
});
