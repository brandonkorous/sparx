import { describe, expect, it } from 'vitest';
import { SparxClient } from './client';
import { ApiError } from './envelope';

// PG-7: api-rest answers a pool outage with 503 + Retry-After: 2 (WW-1); the console
// breaker can only honour it if the error carries it.
function answering(status: number, headers: Record<string, string>) {
  const body = {
    success: false,
    error: { code: 'SERVICE_UNAVAILABLE', message: 'busy', request_id: 'r' },
  };
  return () =>
    Promise.resolve(
      new Response(JSON.stringify(body), {
        status,
        headers: { 'content-type': 'application/json', ...headers },
      })
    );
}

async function failure(fetch: typeof globalThis.fetch): Promise<ApiError> {
  const client = new SparxClient({ baseUrl: 'http://api.test', fetch });
  return client.request({ path: '/v1/x' }).then(
    () => Promise.reject(new Error('expected a failure')),
    (err: unknown) => err as ApiError
  );
}

describe('ApiError.retryAfterSeconds', () => {
  it('carries the Retry-After the server sent', async () => {
    const err = await failure(answering(503, { 'retry-after': '2' }));
    expect(err).toBeInstanceOf(ApiError);
    expect(err.status).toBe(503);
    expect(err.retryAfterSeconds).toBe(2);
  });

  it('is undefined when the server sent none', async () => {
    expect((await failure(answering(503, {}))).retryAfterSeconds).toBeUndefined();
  });
});
