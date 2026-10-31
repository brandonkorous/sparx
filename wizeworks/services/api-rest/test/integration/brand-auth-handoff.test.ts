// Redeeming a cross-domain session handoff, against the real `verifications`
// table (routes/auth/brand-auth.ts → @wizeworks/auth session-handoff).
//
// The redeem is the security-relevant half: it must hand out the session's
// cookies exactly once, refuse a token meant for another domain, and refuse one
// past its minute. It ran on the app's database client before it moved here,
// so this pins that the statement still deletes and returns in one step.

import { randomBytes } from 'node:crypto';
import Fastify, { type FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

process.env.PLATFORM_AUTH_BRANDS = 'piggles';
process.env.PLATFORM_BRAND_SOURCE = 'request';
process.env.PIGGLES_BETTER_AUTH_SECRET = 'piggles-test-secret-that-is-at-least-32-chars';
process.env.PIGGLES_BETTER_AUTH_URL = 'https://getpiggles.test';
process.env.PIGGLES_BETTER_AUTH_COOKIE_PREFIX = 'piggles-account';

const { authPrisma } = await import('@wizeworks/auth');
const { default: brandAuthRoutes } = await import('../../src/routes/auth/brand-auth.js');

const INTERNAL = 'api-rest.sparx-prod.svc.cluster.local:3000';
const SESSION_TOKEN = 'Oj0qQjSZjgZJ1lwYyZ5ReKTts1PVdqXN';

async function seed(payload: object, ttlMs = 60_000): Promise<string> {
  const token = randomBytes(24).toString('base64url');
  await authPrisma.verification.create({
    data: {
      identifier: `piggles-handoff:${token}`,
      value: JSON.stringify(payload),
      expiresAt: new Date(Date.now() + ttlMs),
    },
  });
  return token;
}

describe('redeeming a session handoff', () => {
  let app: FastifyInstance;
  const redeem = (token: string, audience = 'console') =>
    app.inject({
      method: 'POST',
      url: '/auth/piggles/platform/handoff/consume',
      headers: { host: INTERNAL },
      payload: { token, audience },
    });

  beforeAll(async () => {
    app = Fastify();
    await app.register(brandAuthRoutes);
    await app.ready();
  });
  afterAll(async () => {
    await authPrisma.verification.deleteMany({
      where: { identifier: { startsWith: 'piggles-handoff:' } },
    });
    await app.close();
  });

  it('hands out the signed session cookie once, then never again', async () => {
    const token = await seed({
      sessionToken: SESSION_TOKEN,
      audience: 'console',
      userId: 'u1',
      next: '/orders',
      remember: true,
    });

    const first = (await redeem(token)).json<{
      ok: boolean;
      next: string;
      cookies: { name: string; value: string; options: { maxAge?: number } }[];
    }>();
    expect(first.ok).toBe(true);
    expect(first.next).toBe('/orders');
    const session = first.cookies.find((c) => c.name === '__Secure-piggles-account.session_token');
    expect(session?.value.startsWith(`${SESSION_TOKEN}.`)).toBe(true);
    expect(session?.options.maxAge).toBeGreaterThan(0);

    expect((await redeem(token)).json()).toEqual({ ok: false, reason: 'missing' });
  });

  it('forgets the session with the browser when the person unticked "Keep me signed in"', async () => {
    const token = await seed({
      sessionToken: SESSION_TOKEN,
      audience: 'console',
      userId: 'u1',
      remember: false,
    });
    const body = (await redeem(token)).json<{
      cookies: { name: string; options: { maxAge?: number } }[];
    }>();
    expect(
      body.cookies.find((c) => c.name.endsWith('.session_token'))?.options.maxAge
    ).toBeUndefined();
    expect(body.cookies.some((c) => c.name.endsWith('.dont_remember'))).toBe(true);
  });

  it('refuses a token minted for another domain, and burns it', async () => {
    const token = await seed({ sessionToken: SESSION_TOKEN, audience: 'console', userId: 'u1' });
    expect((await redeem(token, 'elsewhere')).json()).toEqual({
      ok: false,
      reason: 'wrong-audience',
    });
    expect((await redeem(token)).json()).toEqual({ ok: false, reason: 'missing' });
  });

  it('refuses a token past its minute', async () => {
    const token = await seed(
      { sessionToken: SESSION_TOKEN, audience: 'console', userId: 'u1' },
      -1_000
    );
    expect((await redeem(token)).json()).toEqual({ ok: false, reason: 'expired' });
  });

  it('never sends the person anywhere outside the console', async () => {
    const token = await seed({
      sessionToken: SESSION_TOKEN,
      audience: 'console',
      userId: 'u1',
      next: '//evil.example/x',
    });
    expect((await redeem(token)).json<{ next: string }>().next).toBe('/');
  });
});
