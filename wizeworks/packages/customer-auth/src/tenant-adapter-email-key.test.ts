// Sparx persona issue 329: Better Auth marks an address confirmed with
// `update({ where: { email } })`. A shopper's email is unique per business, so
// that call failed and every "confirm it's you" link answered with an error.

import { describe, expect, it, vi } from 'vitest';

vi.mock('@wizeworks/db', () => ({ prisma: {}, tenantStore: {}, withTenant: vi.fn() }));

const { withTenantEmailKey } = await import('./tenant-adapter');

const T = '5944fe23-be83-4ce5-aafc-ef56b8594508';

describe('withTenantEmailKey', () => {
  it('names the business beside the email on an update', () => {
    expect(
      withTenantEmailKey(
        'customerUser',
        'update',
        { where: { email: 'a@b.test' }, data: { x: 1 } },
        T
      )
    ).toEqual({ where: { tenantId_email: { tenantId: T, email: 'a@b.test' } }, data: { x: 1 } });
  });

  it('leaves an update by id alone', () => {
    const args = { where: { id: 'u1' }, data: {} };
    expect(withTenantEmailKey('customerUser', 'update', args, T)).toBe(args);
  });

  it('leaves a search by email alone: it needs no unique key', () => {
    const args = { where: { email: 'a@b.test' } };
    expect(withTenantEmailKey('customerUser', 'findFirst', args, T)).toBe(args);
  });

  it('leaves other models alone', () => {
    const args = { where: { email: 'a@b.test' } };
    expect(withTenantEmailKey('customerSession', 'update', args, T)).toBe(args);
  });
});
