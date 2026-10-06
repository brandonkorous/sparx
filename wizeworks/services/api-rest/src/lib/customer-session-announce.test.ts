// A buyer who makes an account on a business's website is announced.
//
// MEASURED on Gillett Diesel, 2026-10-03: Marcus Oyelaran-Pike registered at
// /account/register, his `customers` row was written at 03:26, and ten minutes
// later the console's search box still answered "Nothing in your records matches"
// about him. The sign-up wrote the row and told nobody, so the search worker
// never heard of him (sparx persona issue 086).
//
// `ensureMembership` lives in a package that cannot reach the CRM bus, so the
// announcing is done here, by the one function every sign-up, sign-in and
// session lookup goes through.

import { beforeEach, describe, expect, it, vi } from 'vitest';

const ensureMembership = vi.fn();
const announceCustomer = vi.fn();

vi.mock('@wizeworks/customer-auth', () => ({
  ensureMembership,
  getCustomerSession: vi.fn(),
  verifyCustomerMcpToken: vi.fn(),
}));
vi.mock('@wizeworks/crm', () => ({ customerService: { announceCustomer } }));
vi.mock('@wizeworks/db', () => ({ withTenant: vi.fn() }));
vi.mock('./property.js', () => ({ resolvePublicPropertyId: vi.fn() }));

const { ensureAnnouncedMembership } = await import('./customer-session.js');

const CTX = { tenantId: '5944fe23-be83-4ce5-aafc-ef56b8594508' };
const SITE = '8af579c5-b6d1-4a46-a3a0-0d3d109b37b6';
const USER = 'b1d0c6a2-6a0e-4f43-9d55-7f3b5c1e2a10';
const MARCUS = '72c35937-9a06-45b2-8cc3-a5a4547920c3';
const EMAIL = 'marcus@example.test';

beforeEach(() => {
  ensureMembership.mockReset();
  announceCustomer.mockReset();
});

describe('ensureAnnouncedMembership', () => {
  it('announces a brand-new person as a new customer', async () => {
    ensureMembership.mockResolvedValue({ customerId: MARCUS, created: true, adopted: false });
    const result = await ensureAnnouncedMembership(CTX, SITE, USER, EMAIL, { firstName: 'Marcus' });
    expect(result.customerId).toBe(MARCUS);
    expect(announceCustomer).toHaveBeenCalledWith(CTX.tenantId, 'crm.customer.created', {
      id: MARCUS,
      type: 'retail',
      email: EMAIL,
    });
  });

  it('announces a guest who now has a login as changed', async () => {
    ensureMembership.mockResolvedValue({ customerId: MARCUS, created: false, adopted: true });
    await ensureAnnouncedMembership(CTX, SITE, USER, EMAIL, {});
    expect(announceCustomer).toHaveBeenCalledWith(CTX.tenantId, 'crm.customer.updated', {
      id: MARCUS,
    });
  });

  // Every signed-in page view resolves the membership. Announcing those would
  // re-index the same person on every click.
  it('says nothing about somebody who was already signed up here', async () => {
    ensureMembership.mockResolvedValue({ customerId: MARCUS, created: false, adopted: false });
    await ensureAnnouncedMembership(CTX, SITE, USER, EMAIL, {});
    expect(announceCustomer).not.toHaveBeenCalled();
  });
});
