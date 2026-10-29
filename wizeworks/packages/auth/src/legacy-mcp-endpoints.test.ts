// An assistant that connected under Better Auth 1.6 still holds the old
// `/mcp/*` addresses. It must be sent to the new ones, not shown a bare 404.

import { describe, expect, it } from 'vitest';

import { legacyMcpResponse } from './legacy-mcp-endpoints';

const at = (path: string, method = 'GET') => new Request(`https://app.example${path}`, { method });

describe('legacyMcpResponse', () => {
  it('sends the old authorize address to the new one, query intact', () => {
    const res = legacyMcpResponse(at('/api/auth/mcp/authorize?client_id=a&state=s'), '/api/auth');
    expect(res?.status).toBe(302);
    expect(res?.headers.get('location')).toBe('/api/auth/oauth2/authorize?client_id=a&state=s');
  });

  it('keeps the method and body on the token and registration hops', () => {
    for (const [from, to] of [
      ['/mcp/token', '/oauth2/token'],
      ['/mcp/register', '/oauth2/register'],
    ]) {
      const res = legacyMcpResponse(at(`/v1/public/auth${from}`, 'POST'), '/v1/public/auth');
      expect(res?.status).toBe(308);
      expect(res?.headers.get('location')).toBe(`/v1/public/auth${to}`);
    }
  });

  it('explains an old address with no successor', async () => {
    const res = legacyMcpResponse(at('/api/auth/mcp/get-session'), '/api/auth');
    expect(res?.status).toBe(410);
    expect(((await res?.json()) as { error: string }).error).toBe('invalid_request');
  });

  it('leaves every other path alone', () => {
    expect(legacyMcpResponse(at('/api/auth/oauth2/authorize'), '/api/auth')).toBeNull();
    expect(legacyMcpResponse(at('/api/auth/mcpx/authorize'), '/api/auth')).toBeNull();
  });
});
