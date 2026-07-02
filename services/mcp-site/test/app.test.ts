import { afterEach, describe, expect, it, vi } from 'vitest';

// env is validated at import time — set the required var before importing app.
process.env.SPARX_API_REST_URL ??= 'http://api-rest.test';
process.env.NODE_ENV = 'test';

const { createApp } = await import('../src/app.js');

describe('mcp-site app', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('health returns ok', async () => {
    const app = await createApp();
    const res = await app.inject({ method: 'GET', url: '/health' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: 'ok' });
    await app.close();
  });

  it('returns 404 UNKNOWN_SITE for an unresolvable host', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(new Response('not found', { status: 404 })))
    );
    const app = await createApp();
    const res = await app.inject({
      method: 'POST',
      url: '/mcp',
      headers: { host: 'nobody.example', 'content-type': 'application/json' },
      payload: { jsonrpc: '2.0', id: 1, method: 'tools/list' },
    });
    expect(res.statusCode).toBe(404);
    expect(res.json().error.code).toBe('UNKNOWN_SITE');
    await app.close();
  });
});
