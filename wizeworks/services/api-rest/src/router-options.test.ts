// A product with a long name had a page nobody could open (sparx persona issue 213).
//
// The router's default refuses any path part over 100 letters, and answers that the
// ROUTE does not exist. Gillett's catalog had 44 products whose address was longer
// (the S&B 68 gallon tank's is 112), so 44 product pages said "We couldn't find that
// page" to a customer who had just found the product in search.

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import Fastify from 'fastify';
import { describe, expect, it } from 'vitest';
import { ROUTER_OPTIONS } from './router-options.js';

const TANK =
  's-b-68-gallon-high-capacity-fuel-tank-for-2017-2026-ford-f-250-f-350-f-450-powerstroke-6-7l-crew-cab-long-bed';

async function statusFor(handle: string, options?: typeof ROUTER_OPTIONS): Promise<number> {
  const app = Fastify(options ? { routerOptions: options } : {});
  app.get('/v1/public/commerce/products/:handle', () => ({ ok: true }));
  const res = await app.inject({
    method: 'GET',
    url: `/v1/public/commerce/products/${encodeURIComponent(handle)}`,
  });
  await app.close();
  return res.statusCode;
}

describe('a long address part', () => {
  it('is refused by the router as it comes, which is the defect', async () => {
    expect(await statusFor(TANK)).toBe(404);
  });

  it('reaches its route with the API’s options', async () => {
    expect(await statusFor(TANK, ROUTER_OPTIONS)).toBe(200);
  });

  // A product's, a category's and a market listing's address are VarChar(127). Typed
  // in another alphabet, one letter can be up to 12 characters once encoded for a URL.
  it('fits the longest address the database can hold, encoded', async () => {
    expect(ROUTER_OPTIONS.maxParamLength).toBeGreaterThanOrEqual(127 * 12);
    expect(await statusFor('🔧'.repeat(127), ROUTER_OPTIONS)).toBe(200);
  });

  it('is what the API is built with', () => {
    const app = readFileSync(resolve(__dirname, 'app.ts'), 'utf8');
    expect(app).toMatch(/routerOptions: ROUTER_OPTIONS/);
  });
});
