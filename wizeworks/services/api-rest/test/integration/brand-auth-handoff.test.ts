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

const { auth, authPrisma } = await import('@wizeworks/auth');
const { runAsBrand } = await import('@wizeworks/brand-core/request-scope');
const { createTestTenant, dropTestTenant } = await import('../helpers.js');
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

// A password change that signs out other devices deletes EVERY session row,
// the caller's included, and writes a new one. The new cookie has to reach the
// browser, or the person's next click carries a cookie for a deleted row.
describe('an account operation that rotates the session', () => {
  let app: FastifyInstance;
  let tenantId: string;
  let email: string;

  beforeAll(async () => {
    let userId: string;
    ({ tenantId, userId, email } = await createTestTenant());
    // A Piggles business and person: each brand's sign-in finds only its own.
    await authPrisma.tenant.update({ where: { id: tenantId }, data: { platformBrand: 'piggles' } });
    await authPrisma.user.update({ where: { id: userId }, data: { platformBrand: 'piggles' } });
    await authPrisma.account.create({
      data: {
        userId,
        providerId: 'credential',
        accountId: userId,
        // The brand's own hasher, the one its sign-in verifies against.
        password: await runAsBrand('piggles', async () =>
          (await auth.$context).password.hash('first-password-123')
        ),
      },
    });
    app = Fastify();
    await app.register(brandAuthRoutes);
    await app.ready();
  });
  afterAll(async () => {
    await dropTestTenant(tenantId);
    await app.close();
  });

  it('hands back the new session cookie', async () => {
    const signIn = await app.inject({
      method: 'POST',
      url: '/auth/piggles/sign-in/email',
      headers: { host: INTERNAL, 'content-type': 'application/json' },
      payload: JSON.stringify({ email, password: 'first-password-123' }),
    });
    expect(signIn.statusCode).toBe(200);
    const sessionCookie = signIn.cookies.find((c) => c.name.endsWith('.session_token'));
    expect(sessionCookie).toBeDefined();
    const cookie = `${sessionCookie!.name}=${sessionCookie!.value}`;

    const res = await app.inject({
      method: 'POST',
      url: '/auth/piggles/platform/account/password',
      headers: { host: INTERNAL, 'content-type': 'application/json', cookie },
      payload: JSON.stringify({
        currentPassword: 'first-password-123',
        newPassword: 'second-password-456',
      }),
    });
    expect(res.statusCode).toBe(200);
    const rotated = res.cookies.find((c) => c.name === sessionCookie!.name);
    expect(rotated?.value).toBeTruthy();
    expect(rotated?.value).not.toBe(sessionCookie!.value);
  });
});
