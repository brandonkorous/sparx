// The staff sign-in routes api-rest serves for every brand (docs/154).
//
// What has to hold: the routes answer only from inside the cluster, only for a
// brand this process was given, and each request reaches THAT brand's Better
// Auth instance at the brand's public address. None of these cases reaches the
// database: Better Auth's `/ok` answers without one, and a request with no
// session cookie is refused before any lookup.

import Fastify, { type FastifyInstance } from 'fastify';
import { jwtVerify } from 'jose';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { SparxSession } from '@wizeworks/auth';

process.env.PLATFORM_AUTH_BRANDS = 'sparx, Piggles';
process.env.PLATFORM_BRAND_SOURCE = 'request';
process.env.SPARX_BETTER_AUTH_SECRET = 'sparx-test-secret-that-is-at-least-32-chars';
process.env.SPARX_BETTER_AUTH_URL = 'https://app.sparx.test';
process.env.PIGGLES_BETTER_AUTH_SECRET = 'piggles-test-secret-that-is-at-least-32-chars';
process.env.PIGGLES_BETTER_AUTH_URL = 'https://getpiggles.test';
process.env.PIGGLES_BETTER_AUTH_COOKIE_PREFIX = 'piggles-account';

const {
  default: brandAuthRoutes,
  betterAuthUrl,
  isInternalHost,
  mintApiToken,
  parseBrandList,
} = await import('./brand-auth.js');

const INTERNAL = 'api-rest.sparx-prod.svc.cluster.local:3000';

describe('parseBrandList', () => {
  it('normalizes, trims and de-duplicates', () => {
    expect(parseBrandList(' sparx, Piggles ,sparx,, ')).toEqual(['sparx', 'piggles']);
  });

  it('is empty when unset', () => {
    expect(parseBrandList(undefined)).toEqual([]);
    expect(parseBrandList('')).toEqual([]);
  });
});

describe('isInternalHost', () => {
  it.each([
    INTERNAL,
    'api-rest:3000',
    'api-rest.sparx-prod.svc',
    'localhost:3100',
    '127.0.0.1',
    '[::1]:3000',
  ])('accepts %s', (host) => expect(isInternalHost(host)).toBe(true));

  it.each([
    'api.sparx.works',
    'api.mypiggles.com',
    'svc.cluster.local.evil.example',
    undefined,
    '',
  ])('refuses %s', (host) => expect(isInternalHost(host)).toBe(false));
});

describe('betterAuthUrl', () => {
  it("rebuilds the path under the brand's public address and Better Auth's mount", () => {
    expect(
      betterAuthUrl('https://getpiggles.com', 'sign-in/email', '/auth/piggles/sign-in/email')
    ).toBe('https://getpiggles.com/api/auth/sign-in/email');
  });

  it('keeps the query string', () => {
    expect(
      betterAuthUrl(
        'https://app.sparx.works/',
        'callback/google',
        '/auth/sparx/callback/google?code=a&state=b'
      )
    ).toBe('https://app.sparx.works/api/auth/callback/google?code=a&state=b');
  });

  it('uses only the origin of a base URL that carries a path', () => {
    expect(betterAuthUrl('https://app.sparx.works/api/auth', 'ok', '/auth/sparx/ok')).toBe(
      'https://app.sparx.works/api/auth/ok'
    );
  });
});

describe('mintApiToken', () => {
  const session: SparxSession = {
    user: {
      id: 'user-1',
      email: 'owner@example.test',
      emailVerified: true,
      name: 'Marta',
      tenantId: 'tenant-active',
      homeTenantId: 'tenant-home',
      role: 'admin',
    },
    session: { id: 's1', userId: 'user-1', expiresAt: new Date(), activeOrganizationId: null },
  };
  const secret = 'dev-only-internal-jwt-secret-change-me-32chars';

  it('signs the claims api-rest verifies, with the ACTIVE tenant', async () => {
    const now = Math.floor(Date.now() / 1000);
    const body = await mintApiToken(session, secret, now);
    const { payload, protectedHeader } = await jwtVerify(
      body.token,
      new TextEncoder().encode(secret)
    );
    expect(protectedHeader.alg).toBe('HS256');
    expect(payload).toMatchObject({ sub: 'user-1', tid: 'tenant-active', role: 'admin', ev: true });
    expect(payload.exp).toBe(now + 600);
    expect(body).toMatchObject({
      expiresAt: (now + 600) * 1000,
      userId: 'user-1',
      role: 'admin',
      userName: 'Marta',
      email: 'owner@example.test',
      emailVerified: true,
    });
  });

  it('sends an empty name rather than a missing one', async () => {
    const body = await mintApiToken({ ...session, user: { ...session.user, name: null } }, secret);
    expect(body.userName).toBe('');
  });
});

describe('the routes', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = Fastify();
    await app.register(brandAuthRoutes);
    await app.ready();
  });
  afterAll(() => app.close());

  it("reaches the brand's Better Auth handler from inside the cluster", async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/auth/piggles/ok',
      headers: { host: INTERNAL },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true });
  });

  it('is not found through a public hostname', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/auth/sparx/ok',
      headers: { host: 'api.sparx.works' },
    });
    expect(res.statusCode).toBe(404);
  });

  it('is not found for a brand this process does not serve', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/auth/acme/ok',
      headers: { host: INTERNAL },
    });
    expect(res.statusCode).toBe(404);
    expect(res.json()).toEqual({ error: 'unknown_brand' });
  });

  it('answers 401 to a session read with no session cookie', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/auth/sparx/session',
      headers: { host: INTERNAL },
    });
    expect(res.statusCode).toBe(401);
    expect(res.headers['cache-control']).toBe('no-store, private');
  });

  it('mints no API token without a session', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/auth/sparx/api-token',
      headers: { host: INTERNAL },
    });
    expect(res.statusCode).toBe(401);
  });
});
