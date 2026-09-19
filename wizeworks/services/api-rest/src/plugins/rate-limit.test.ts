// A RATE-LIMITED REQUEST CAME BACK AS "AN INTERNAL ERROR OCCURRED".
//
// Measured against the running API: every `/v1/*` call answered
//
//     HTTP/1.1 500 Internal Server Error
//     x-ratelimit-limit: 600
//     x-ratelimit-remaining: 0
//     retry-after: 50
//     {"code":"INTERNAL_ERROR","message":"An internal error occurred."}
//
// The headers knew exactly what had happened. The body did not.
//
// `@fastify/rate-limit` THROWS whatever `errorResponseBuilder` returns
// (index.js:333). The builder here returned a plain envelope object with no
// `statusCode`, so `createErrorsPlugin` matched none of its branches and used
// the last one. The whole stack is exercised below rather than the builder
// alone, because the defect lived in the seam between the two and either half
// read correctly on its own.

import Fastify from 'fastify';
import { createErrorsPlugin } from '@wizeworks/api-core/errors-plugin';
import { describe, expect, it } from 'vitest';
import rateLimitPlugin from './rate-limit.js';

interface Envelope {
  success: false;
  error: { code: string; message: string; details?: { retry_after_seconds?: number } };
}

/** The real plugin behind the real error handler, with a tiny budget. */
async function server(max: number) {
  const app = Fastify();
  await app.register(createErrorsPlugin());
  await app.register(rateLimitPlugin);
  app.get('/v1/thing', { config: { rateLimit: { max, timeWindow: '1 minute' } } }, () => ({
    success: true,
  }));
  app.get('/health', () => ({ ok: true }));
  return app;
}

describe('a rate-limited request', () => {
  it('is a 429, not a 500', async () => {
    const app = await server(1);
    expect((await app.inject({ method: 'GET', url: '/v1/thing' })).statusCode).toBe(200);

    const limited = await app.inject({ method: 'GET', url: '/v1/thing' });
    expect(limited.statusCode).toBe(429);
    await app.close();
  });

  it('says it was rate limited, and how long to wait', async () => {
    // The remedy has to be in the body. It was in a header nobody reads, and
    // the body said the server had broken.
    const app = await server(1);
    await app.inject({ method: 'GET', url: '/v1/thing' });
    const limited = await app.inject({ method: 'GET', url: '/v1/thing' });

    const body = limited.json<Envelope>();
    expect(body.error.code).toBe('RATE_LIMITED');
    expect(body.error.code).not.toBe('INTERNAL_ERROR');
    expect(body.error.message).not.toContain('An internal error occurred');
    expect(body.error.message).toContain('Rate limit of 1 requests');
    expect(body.error.details?.retry_after_seconds).toBeGreaterThan(0);
    await app.close();
  });

  it('still carries the retry-after header it always did', async () => {
    const app = await server(1);
    await app.inject({ method: 'GET', url: '/v1/thing' });
    const limited = await app.inject({ method: 'GET', url: '/v1/thing' });

    expect(limited.headers['retry-after']).toBeDefined();
    expect(String(limited.headers['x-ratelimit-remaining'])).toBe('0');
    await app.close();
  });

  it('never limits /health, which is what keeps pods alive', async () => {
    const app = await server(1);
    for (let i = 0; i < 5; i += 1) {
      expect((await app.inject({ method: 'GET', url: '/health' })).statusCode).toBe(200);
    }
    await app.close();
  });
});
