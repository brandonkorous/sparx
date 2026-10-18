// mcp-site calls api-rest on the caller's behalf, so it must say who the caller
// is — otherwise every agent on every site shares this pod's one rate-limit
// budget there. (Which hops are trusted, and that the list matches Caddy's, is
// tested once, in @wizeworks/client-ip.)

import { afterEach, describe, expect, it, vi } from 'vitest';

process.env.SPARX_API_REST_URL ??= 'http://api-rest.test';
process.env.NODE_ENV = 'test';

const { createApp } = await import('../src/app.js');

describe('a call made on the caller’s behalf', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('carries the caller’s chain to api-rest, untrimmed', async () => {
    const seen: (string | null)[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn((_url: URL, init?: RequestInit) => {
        seen.push(new Headers(init?.headers).get('x-forwarded-for'));
        // An unknown host ends the request after the one resolver call.
        return Promise.resolve(new Response('{}', { status: 404 }));
      })
    );

    const app = await createApp();
    await app.inject({
      method: 'POST',
      url: '/mcp',
      headers: {
        host: 'shop.example.com',
        'x-forwarded-for': '6.6.6.6, 9.9.9.9, 104.16.0.5',
        'content-type': 'application/json',
      },
      payload: { jsonrpc: '2.0', id: 1, method: 'tools/list' },
    });
    await app.close();

    expect(seen).toEqual(['6.6.6.6, 9.9.9.9, 104.16.0.5']);
  });
});
