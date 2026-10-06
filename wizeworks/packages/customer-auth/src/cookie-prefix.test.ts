// The customer sign-in must never read the staff sign-in's cookies.
//
// Both Better Auth instances defaulted to the prefix `better-auth`. The staff one
// keeps a signed copy of its session in `better-auth.session_data`; the customer
// one read it, failed it, and answered "not signed in". A shop owner signed in to
// the workbench on the same host could not stay signed in to their own site as a
// customer (sparx persona issue 084, measured 200 → 401 with that one cookie).
//
// Built from the real config: a prefix defined and never wired in would pass a
// test of the constant alone.

import { describe, expect, it, vi } from 'vitest';

vi.mock('@wizeworks/db', () => ({
  tenantScopedClient: {},
  prisma: {},
  tenantStore: { run: (_tenantId: string, fn: () => unknown) => fn(), getStore: () => undefined },
}));

process.env.CUSTOMER_AUTH_SECRET ??= 'test-secret-test-secret-test-secret-123';

const { getCustomerAuth } = await import('./server');
const { SESSION_COOKIE_NAME } = await import('./session');

describe('customer sign-in cookies', () => {
  const advanced = getCustomerAuth().options.advanced ?? {};

  it('use their own prefix, never the staff default', () => {
    const staffPrefix = process.env.BETTER_AUTH_COOKIE_PREFIX ?? 'better-auth';
    expect(advanced.cookiePrefix).toBeTruthy();
    expect(advanced.cookiePrefix).not.toBe(staffPrefix);
    expect(advanced.cookiePrefix).not.toBe('better-auth');
  });

  it('keep the session cookie name every signed-in customer already holds', () => {
    expect(advanced.cookies?.session_token?.name).toBe(SESSION_COOKIE_NAME);
    expect(SESSION_COOKIE_NAME).toBe('sparx_customer_session');
  });
});
