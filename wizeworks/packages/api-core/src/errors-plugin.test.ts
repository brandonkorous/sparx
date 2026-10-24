import Fastify from 'fastify';
import { Prisma } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import { createErrorsPlugin } from './errors-plugin.js';

// WW-1: when the database ran out of connections (P2028 on 10-21, P2037 on 10-19)
// every caller got a generic 500 with no hint to retry.

function known(code: string, message = `prisma ${code}`) {
  return new Prisma.PrismaClientKnownRequestError(message, { code, clientVersion: '6.19.3' });
}

async function serverThrowing(err: Error) {
  const app = Fastify();
  await app.register(createErrorsPlugin());
  app.get('/boom', () => Promise.reject(err));
  return app;
}

describe('a database pool error', () => {
  it.each(['P2024', 'P2028', 'P2037'])('%s is a 503 with Retry-After', async (code) => {
    const res = await (await serverThrowing(known(code))).inject({ method: 'GET', url: '/boom' });
    expect(res.statusCode).toBe(503);
    expect(res.headers['retry-after']).toBe('2');
    expect(res.json().error.code).toBe('SERVICE_UNAVAILABLE');
  });

  it('P1001 (database unreachable) is a 503 too', async () => {
    const err = new Prisma.PrismaClientInitializationError(
      "Can't reach database",
      '6.19.3',
      'P1001'
    );
    const res = await (await serverThrowing(err)).inject({ method: 'GET', url: '/boom' });
    expect(res.statusCode).toBe(503);
  });

  it('any other Prisma error stays a 500', async () => {
    const res = await (
      await serverThrowing(known('P2002'))
    ).inject({ method: 'GET', url: '/boom' });
    expect(res.statusCode).toBe(500);
    expect(res.headers['retry-after']).toBeUndefined();
  });
});

// WW-2: a scanner's `/%00production.json` reached Postgres and came back a 500.
describe('a NUL byte that reached Postgres (22021)', () => {
  it("is the caller's 400, not our 500", async () => {
    const message =
      'Error occurred during query execution:\nConnectorError(ConnectorError { user_facing_error: None, kind: QueryError(PostgresError { code: "22021", message: "invalid byte sequence for encoding \\"UTF8\\": 0x00" }) })';
    const err = new Prisma.PrismaClientUnknownRequestError(message, { clientVersion: '6.19.3' });
    const res = await (await serverThrowing(err)).inject({ method: 'GET', url: '/boom' });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('VALIDATION_ERROR');
  });
});
