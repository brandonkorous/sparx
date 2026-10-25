// WW-2: a scanner asked the storefront for `/%00production.json`; the site passed
// the NUL on as `slug=%00…` and api-rest handed it to Postgres, which refused it
// (22021) and the request became a 500. The guard stops it before the route.

import Fastify from 'fastify';
import { createErrorsPlugin } from '@wizeworks/api-core/errors-plugin';
import { describe, expect, it, vi } from 'vitest';
import nulGuard, { hasNulByte } from './nul-guard.js';

async function server(handler: () => unknown) {
  const app = Fastify();
  await app.register(createErrorsPlugin());
  await app.register(nulGuard);
  app.get('/v1/public/content/entries/by-slug', handler);
  app.get('/v1/public/commerce/products/:handle', handler);
  return app;
}

describe('the NUL guard', () => {
  it('answers 400 for a NUL in the query, and the route never runs', async () => {
    const route = vi.fn(() => ({ success: true }));
    const res = await (
      await server(route)
    ).inject({
      method: 'GET',
      url: '/v1/public/content/entries/by-slug?tenant=t&type=page&slug=%00a',
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('VALIDATION_ERROR');
    expect(route).not.toHaveBeenCalled();
  });

  it('answers 400 for a NUL in a path param', async () => {
    const route = vi.fn(() => ({ success: true }));
    const res = await (
      await server(route)
    ).inject({ method: 'GET', url: '/v1/public/commerce/products/%00tee' });
    expect(res.statusCode).toBe(400);
    expect(route).not.toHaveBeenCalled();
  });

  it('lets an ordinary request through', async () => {
    const route = vi.fn(() => ({ success: true }));
    const res = await (
      await server(route)
    ).inject({ method: 'GET', url: '/v1/public/content/entries/by-slug?tenant=t&slug=about' });
    expect(res.statusCode).toBe(200);
    expect(route).toHaveBeenCalledOnce();
  });

  it.each([
    ['a\u0000b', true],
    [['ok', 'x\u0000'], true],
    [{ deep: { v: '\u0000' } }, true],
    [{ a: 'fine', n: 3 }, false],
    [undefined, false],
  ])('hasNulByte(%j) is %s', (value, expected) => {
    expect(hasNulByte(value)).toBe(expected);
  });
});
