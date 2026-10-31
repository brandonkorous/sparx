// The app side of sign-in over HTTP. Each case uses a fake fetch, so it proves
// what the app SENDS to api-rest and what it does with each kind of answer.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/headers', () => ({ headers: () => Promise.resolve(new Headers()) }));
vi.mock('next/navigation', () => ({ redirect: vi.fn() }));

const { readSession, fetchApiToken, proxyAuthRequest, proxiedPath, PlatformAuthUnavailableError } =
  await import('./index');

const saved = { url: process.env.SPARX_API_REST_URL, brand: process.env.PLATFORM_BRAND };

beforeEach(() => {
  process.env.SPARX_API_REST_URL = 'http://api-rest.test:3000/';
  process.env.PLATFORM_BRAND = 'piggles';
});
afterEach(() => {
  for (const [k, v] of [
    ['SPARX_API_REST_URL', saved.url],
    ['PLATFORM_BRAND', saved.brand],
  ] as const) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
});

function fakeFetch(response: Response) {
  return vi.fn<typeof fetch>(() => Promise.resolve(response));
}

const wire = {
  session: {
    user: {
      id: 'u1',
      email: 'owner@example.test',
      emailVerified: true,
      tenantId: 't-active',
      homeTenantId: 't-home',
      role: 'owner',
    },
    session: {
      id: 's1',
      userId: 'u1',
      expiresAt: '2026-11-01T00:00:00.000Z',
      activeOrganizationId: 't-active',
    },
  },
};

describe('readSession', () => {
  it("asks api-rest for this app's brand, forwarding only the identifying headers", async () => {
    const fetchImpl = fakeFetch(Response.json(wire));
    const incoming = new Headers({
      cookie: 'piggles-account.session_token=abc',
      'x-forwarded-for': '203.0.113.9',
      host: 'getpiggles.com',
      authorization: 'Bearer nope',
    });
    const session = await readSession(incoming, fetchImpl);

    const [url, init] = fetchImpl.mock.calls[0]!;
    expect(url).toBe('http://api-rest.test:3000/auth/piggles/session');
    const sent = new Headers(init?.headers);
    expect(sent.get('cookie')).toBe('piggles-account.session_token=abc');
    expect(sent.get('x-forwarded-for')).toBe('203.0.113.9');
    expect(sent.get('host')).toBeNull();
    expect(sent.get('authorization')).toBeNull();
    expect(session?.user.tenantId).toBe('t-active');
    expect(session?.session.expiresAt).toEqual(new Date('2026-11-01T00:00:00.000Z'));
  });

  it('is null when api-rest says nobody is signed in', async () => {
    expect(
      await readSession(new Headers(), fakeFetch(new Response(null, { status: 401 })))
    ).toBeNull();
  });

  it('throws rather than reading a server fault as signed out', async () => {
    await expect(
      readSession(new Headers(), fakeFetch(new Response(null, { status: 503 })))
    ).rejects.toBeInstanceOf(PlatformAuthUnavailableError);
  });

  it('throws when api-rest cannot be reached', async () => {
    const down = vi.fn<typeof fetch>(() => Promise.reject(new TypeError('fetch failed')));
    await expect(readSession(new Headers(), down)).rejects.toBeInstanceOf(
      PlatformAuthUnavailableError
    );
  });
});

describe('fetchApiToken', () => {
  it('posts to the brand token route and returns the body', async () => {
    const body = {
      token: 'jwt',
      expiresAt: 1,
      userId: 'u1',
      role: 'owner',
      userName: '',
      email: 'e',
      emailVerified: true,
    };
    const fetchImpl = fakeFetch(Response.json(body));
    expect(await fetchApiToken(new Headers({ cookie: 'c=1' }), fetchImpl)).toEqual(body);
    const [url, init] = fetchImpl.mock.calls[0]!;
    expect(url).toBe('http://api-rest.test:3000/auth/piggles/api-token');
    expect(init?.method).toBe('POST');
  });

  it('is null without a session', async () => {
    expect(
      await fetchApiToken(new Headers(), fakeFetch(new Response(null, { status: 401 })))
    ).toBeNull();
  });
});

describe('the /api/auth proxy', () => {
  it('maps the app path onto the brand route, keeping the query', () => {
    expect(
      proxiedPath(new URL('https://getpiggles.com/api/auth/callback/google?code=a&state=b'))
    ).toBe('/callback/google?code=a&state=b');
  });

  it('forwards method and body, and relays every cookie separately', async () => {
    const upstream = new Response('{"ok":true}', {
      status: 200,
      headers: { 'content-type': 'application/json', 'content-encoding': 'gzip' },
    });
    upstream.headers.append('set-cookie', 'a=1; Path=/; Expires=Wed, 21 Oct 2026 07:28:00 GMT');
    upstream.headers.append('set-cookie', 'b=2; Path=/');
    const fetchImpl = fakeFetch(upstream);

    const res = await proxyAuthRequest(
      new Request('https://getpiggles.com/api/auth/sign-in/email', {
        method: 'POST',
        headers: { 'content-type': 'application/json', cookie: 'x=1', host: 'getpiggles.com' },
        body: '{"email":"a@example.test"}',
      }),
      fetchImpl
    );

    const [url, init] = fetchImpl.mock.calls[0]!;
    expect(url).toBe('http://api-rest.test:3000/auth/piggles/sign-in/email');
    expect(init?.method).toBe('POST');
    expect(new TextDecoder().decode(init?.body as ArrayBuffer)).toBe('{"email":"a@example.test"}');
    expect(new Headers(init?.headers).get('host')).toBeNull();
    expect(res.status).toBe(200);
    expect(res.headers.getSetCookie()).toEqual([
      'a=1; Path=/; Expires=Wed, 21 Oct 2026 07:28:00 GMT',
      'b=2; Path=/',
    ]);
    expect(res.headers.get('content-encoding')).toBeNull();
    expect(await res.text()).toBe('{"ok":true}');
  });

  it('passes a redirect through instead of following it', async () => {
    const fetchImpl = fakeFetch(
      new Response(null, { status: 302, headers: { location: 'https://accounts.example/x' } })
    );
    const res = await proxyAuthRequest(
      new Request('https://getpiggles.com/api/auth/sign-in/social'),
      fetchImpl
    );
    expect(fetchImpl.mock.calls[0]![1]?.redirect).toBe('manual');
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toBe('https://accounts.example/x');
  });
});
