import Fastify from 'fastify';
import { createErrorsPlugin } from '@wizeworks/api-core/errors-plugin';
import { describe, expect, it } from 'vitest';
import responseHeaders from './response-headers.js';

// WW-12: WizeLens saw api-rest answer without X-Content-Type-Options.
async function server() {
  const app = Fastify();
  await app.register(createErrorsPlugin());
  await app.register(responseHeaders);
  app.get('/ok', () => ({ success: true }));
  return app;
}

describe('response headers', () => {
  it.each(['/ok', '/missing'])('%s carries nosniff and the request id', async (url) => {
    const res = await (await server()).inject({ method: 'GET', url });
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-request-id']).toBeTruthy();
  });
});
