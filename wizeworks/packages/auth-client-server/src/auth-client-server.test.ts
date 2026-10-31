// The app side of sign-in over HTTP. Each case uses a fake fetch, so it proves
// what the app SENDS to api-rest and what it does with each kind of answer.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/headers', () => ({ headers: () => Promise.resolve(new Headers()) }));
vi.mock('next/navigation', () => ({ redirect: vi.fn() }));

const {
  readSession,
  fetchApiToken,
  proxyAuthRequest,
  proxiedPath,
  forwardAccountOperation,
  accountOperationPath,
  signOutSession,
  PlatformAuthUnavailableError,
} = await import('./index');

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
    expect(url).toBe('http://api-rest.test:3000/auth/piggles/platform/session');
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
      tenantId: 't1',
      role: 'owner',
      userName: '',
      email: 'e',
      emailVerified: true,
    };
    const fetchImpl = fakeFetch(Response.json(body));
    expect(await fetchApiToken(new Headers({ cookie: 'c=1' }), fetchImpl)).toEqual(body);
    const [url, init] = fetchImpl.mock.calls[0]!;
    expect(url).toBe('http://api-rest.test:3000/auth/piggles/platform/api-token');
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

  it.each([
    '/api/auth/platform/session',
    '/api/auth/Platform/handoff/consume',
    '/api/auth//platform/api-token',
    '/api/auth/%70latform/session',
  ])('never forwards %s, which only app servers may call', async (path) => {
    const fetchImpl = fakeFetch(Response.json({}));
    const res = await proxyAuthRequest(
      new Request(`https://getpiggles.com${path}`, { method: 'POST' }),
      fetchImpl
    );
    expect(res.status).toBe(404);
    expect(fetchImpl).not.toHaveBeenCalled();
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

describe('account operations', () => {
  it('maps the console path onto the operation name', () => {
    expect(
      accountOperationPath(new URL('https://mypiggles.com/api/account/two-factor/verify/'))
    ).toBe('two-factor/verify');
  });

  it('forwards the body and the session cookie, and relays the answer as it came', async () => {
    const fetchImpl = fakeFetch(Response.json({ error: 'Invalid password' }, { status: 400 }));
    const res = await forwardAccountOperation(
      new Request('https://mypiggles.com/api/account/password', {
        method: 'POST',
        headers: {
          cookie: 'piggles-account.session_token=abc',
          'content-type': 'application/json',
        },
        body: JSON.stringify({ currentPassword: 'a', newPassword: 'b' }),
      }),
      fetchImpl
    );
    const [url, init] = fetchImpl.mock.calls[0]!;
    expect(url).toBe('http://api-rest.test:3000/auth/piggles/platform/account/password');
    expect(JSON.parse(init?.body as string)).toEqual({ currentPassword: 'a', newPassword: 'b' });
    expect(new Headers(init?.headers).get('cookie')).toBe('piggles-account.session_token=abc');
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'Invalid password' });
    expect(res.headers.get('cache-control')).toBe('no-store, private');
  });

  it("passes a rotated session's new cookie to the browser", async () => {
    const upstream = new Headers({ 'content-type': 'application/json' });
    upstream.append('set-cookie', 'piggles-account.session_token=new.sig; Path=/; HttpOnly');
    upstream.append('set-cookie', 'piggles-account.session_data=x; Path=/; HttpOnly');
    const fetchImpl = fakeFetch(
      new Response('{"status":true}', { status: 200, headers: upstream })
    );
    const res = await forwardAccountOperation(
      new Request('https://mypiggles.com/api/account/two-factor/verify', {
        method: 'POST',
        body: JSON.stringify({ code: '123456' }),
      }),
      fetchImpl
    );
    expect(res.headers.getSetCookie()).toEqual([
      'piggles-account.session_token=new.sig; Path=/; HttpOnly',
      'piggles-account.session_data=x; Path=/; HttpOnly',
    ]);
  });

  it('answers in a sentence when api-rest cannot be reached', async () => {
    const down = vi.fn<typeof fetch>(() => Promise.reject(new TypeError('fetch failed')));
    const res = await forwardAccountOperation(
      new Request('https://mypiggles.com/api/account/sessions'),
      down
    );
    expect(res.status).toBe(503);
    expect(((await res.json()) as { error: string }).error).toMatch(/did not answer/);
  });
});

describe('signOutSession', () => {
  const carried =
    '__Secure-piggles-account.session_token=a; __Secure-piggles-account.session_data.0=b; theme=dark; piggles-account.dont_remember=true.s';

  it("returns api-rest's cookies when it answers", async () => {
    const cleared = [
      {
        name: 'x.session_token',
        value: '',
        options: { httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: 0 },
      },
    ];
    const fetchImpl = fakeFetch(Response.json({ cookies: cleared }));
    expect(await signOutSession(new Headers({ cookie: carried }), fetchImpl)).toEqual(cleared);
  });

  it('still clears every session cookie the request carries when api-rest is down', async () => {
    const down = vi.fn<typeof fetch>(() => Promise.reject(new TypeError('fetch failed')));
    const cookies = await signOutSession(new Headers({ cookie: carried }), down);
    expect(cookies.map((c) => c.name)).toEqual([
      '__Secure-piggles-account.session_token',
      '__Secure-piggles-account.session_data.0',
      'piggles-account.dont_remember',
    ]);
    expect(cookies.every((c) => c.value === '' && c.options.maxAge === 0)).toBe(true);
    expect(cookies[0]!.options.secure).toBe(true);
    expect(cookies[2]!.options.secure).toBe(false);
  });
});
