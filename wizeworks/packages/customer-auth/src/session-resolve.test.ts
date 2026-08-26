import { describe, expect, it, vi, beforeEach } from 'vitest';

// `tenantStore.run` just scopes the adapter; for these tests it only has to
// invoke the callback.
vi.mock('@wizeworks/db', () => ({
  tenantStore: { run: (_tenantId: string, fn: () => unknown) => fn() },
}));

const getSession = vi.fn();
vi.mock('./server', () => ({
  getCustomerAuth: () => ({ api: { getSession } }),
}));

const { getCustomerSession } = await import('./service');

const CTX = { tenantId: 'tenant-1' };
const COOKIE = 'sparx_customer_session=whatever';

beforeEach(() => {
  getSession.mockReset();
});

describe('getCustomerSession', () => {
  it('resolves the user on a session belonging to this tenant', async () => {
    getSession.mockResolvedValue({
      user: { id: 'u1', email: 'rowan@example.com', name: 'Rowan' },
      session: { tenantId: 'tenant-1' },
    });
    await expect(getCustomerSession(CTX, COOKIE)).resolves.toEqual({
      userId: 'u1',
      email: 'rowan@example.com',
      name: 'Rowan',
    });
  });

  it('is null without a cookie, without asking Better Auth', async () => {
    await expect(getCustomerSession(CTX, undefined)).resolves.toBeNull();
    expect(getSession).not.toHaveBeenCalled();
  });

  it('is null for a session bound to another tenant', async () => {
    getSession.mockResolvedValue({
      user: { id: 'u1', email: 'rowan@example.com' },
      session: { tenantId: 'someone-else' },
    });
    await expect(getCustomerSession(CTX, COOKIE)).resolves.toBeNull();
  });

  it('is null when the cookie cannot be decoded, rather than throwing', async () => {
    // The reason this matters is two layers up: the public product listing
    // resolves the viewer to price the cards, so a throw here fails the READ,
    // and the storefront renders a failed read as "No products found" — a shop
    // with seven garments in it telling a shopper it sells nothing (issue 253).
    getSession.mockRejectedValue(new Error('failed to decode session cookie'));
    await expect(getCustomerSession(CTX, COOKIE)).resolves.toBeNull();
  });

  it('is null when Better Auth answers with no session at all', async () => {
    getSession.mockResolvedValue(null);
    await expect(getCustomerSession(CTX, COOKIE)).resolves.toBeNull();
  });
});
