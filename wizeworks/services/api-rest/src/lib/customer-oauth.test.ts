// The store's authorization server answers on every store host, which makes
// every store origin trusted to it. Only the OAuth endpoints may be reachable
// from a browser; sign-in, sign-up and the rest take a callback address and
// stay internal (shoppers sign in through api-rest's own account routes).

import { describe, expect, it, vi } from 'vitest';

vi.mock('@wizeworks/auth', () => ({ legacyMcpResponse: vi.fn() }));
vi.mock('@wizeworks/customer-auth', () => ({ getCustomerAuth: vi.fn() }));
vi.mock('@wizeworks/db', () => ({ prisma: {}, tenantStore: { run: vi.fn() } }));
vi.mock('./domain.js', () => ({ resolveSiteByHost: vi.fn() }));

const { isForwardedAuthPath } = await import('./customer-oauth.js');

describe('isForwardedAuthPath', () => {
  it('forwards the OAuth endpoints, the keys and discovery', () => {
    for (const path of [
      '/v1/public/auth/oauth2/authorize',
      '/v1/public/auth/oauth2/token',
      '/v1/public/auth/oauth2/register',
      '/v1/public/auth/oauth2/userinfo',
      '/v1/public/auth/oauth2/revoke',
      '/v1/public/auth/jwks',
      '/v1/public/auth/.well-known/openid-configuration',
    ]) {
      expect(isForwardedAuthPath(path), path).toBe(true);
    }
  });

  it('keeps every endpoint that takes a callback address internal', () => {
    for (const path of [
      '/v1/public/auth/sign-in/email',
      '/v1/public/auth/sign-up/email',
      '/v1/public/auth/request-password-reset',
      '/v1/public/auth/verify-email',
      '/v1/public/auth/sign-in/magic-link',
      '/v1/public/auth/get-session',
      '/v1/public/auth/oauth2/consent',
      '/v1/public/auth/oauth2/authorize/extra',
      '/v1/public/authx/oauth2/token',
    ]) {
      expect(isForwardedAuthPath(path), path).toBe(false);
    }
  });
});
