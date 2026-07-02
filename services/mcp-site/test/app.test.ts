import { afterEach, describe, expect, it, vi } from 'vitest';

// env is validated at import time — set the required var before importing app.
process.env.SPARX_API_REST_URL ??= 'http://api-rest.test';
process.env.NODE_ENV = 'test';

const { createApp } = await import('../src/app.js');

describe('mcp-site app', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('health returns ok', async () => {
    const app = await createApp();
    const res = await app.inject({ method: 'GET', url: '/health' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: 'ok' });
    await app.close();
  });

  it('returns 404 UNKNOWN_SITE for an unresolvable host', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(new Response('not found', { status: 404 })))
    );
    const app = await createApp();
    const res = await app.inject({
      method: 'POST',
      url: '/mcp',
      headers: { host: 'nobody.example', 'content-type': 'application/json' },
      payload: { jsonrpc: '2.0', id: 1, method: 'tools/list' },
    });
    expect(res.statusCode).toBe(404);
    expect(res.json().error.code).toBe('UNKNOWN_SITE');
    await app.close();
  });

  // Resolve the Host → site (site-by-host) and its canonical origin (site-info) so
  // the metadata handler can build `resource` + `authorization_servers`.
  const stubResolver = (siteUrl: string | null = 'https://acme.example') =>
    vi.stubGlobal(
      'fetch',
      vi.fn((input: string | URL) => {
        const url = typeof input === 'string' ? input : input.toString();
        const body = url.includes('/v1/public/site-by-host')
          ? { success: true, data: { tenantSlug: 'acme', propertySlug: null } }
          : url.includes('/v1/public/site-info')
            ? { success: true, data: { siteUrl, disabledModules: [] } }
            : null;
        return Promise.resolve(
          body
            ? new Response(JSON.stringify(body), {
                status: 200,
                headers: { 'content-type': 'application/json' },
              })
            : new Response('not found', { status: 404 })
        );
      })
    );

  // RFC 9728 §3.1: the metadata doc must be reachable at EVERY discovery shape a
  // client may construct, not only the path-suffixed one — a regression here is
  // exactly what broke Claude Code's OAuth discovery (it constructed the
  // path-inserted URL, got a 404, and never found the authorization server).
  const DISCOVERY_URLS = [
    '/mcp/.well-known/oauth-protected-resource', // path-suffixed (WWW-Authenticate)
    '/.well-known/oauth-protected-resource/mcp', // path-inserted (SDK-constructed)
    '/.well-known/oauth-protected-resource', // bare root (fallback)
  ];
  for (const url of DISCOVERY_URLS) {
    it(`serves protected-resource metadata at ${url}`, async () => {
      stubResolver('https://acme.example');
      const app = await createApp();
      const res = await app.inject({ method: 'GET', url, headers: { host: 'acme.example' } });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.resource).toBe('http://acme.example/mcp');
      expect(body.authorization_servers).toEqual(['https://acme.example']);
      expect(body.bearer_methods_supported).toEqual(['header']);
      expect(body.scopes_supported).toContain('account:read');
      await app.close();
    });
  }

  it('path-inserted canonical /s/:tenant/mcp metadata carries the resource path', async () => {
    stubResolver('https://acme.example');
    const app = await createApp();
    const res = await app.inject({
      method: 'GET',
      url: '/.well-known/oauth-protected-resource/s/acme/mcp',
      headers: { host: 'mcp.sparx.zone' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().resource).toBe('http://mcp.sparx.zone/s/acme/mcp');
    await app.close();
  });
});
