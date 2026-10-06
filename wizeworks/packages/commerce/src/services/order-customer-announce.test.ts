// A person who first reaches a business by BUYING is announced.
//
// Two paths mint a customer from an order, inside the order's own transaction:
// a guest checkout on the website, and an order pulled in from a marketplace.
// Both wrote the row and said nothing, so the owner could open the order and
// could not find the buyer by searching for them, and nothing that groups or
// scores people ever saw them arrive (sparx persona issue 086).
//
// Both register the announcement inside the write; `announceCustomer` hands it to
// `afterCommit`, so it goes out once the order commits and never for one that
// rolled back. Neither says anything about a buyer the business already had.

import { beforeEach, describe, expect, it, vi } from 'vitest';

const announceCustomer = vi.fn();

vi.mock('@wizeworks/crm', async (importOriginal) => {
  const real = await importOriginal<Record<string, unknown>>();
  return {
    ...real,
    customerService: {
      ...(real.customerService as Record<string, unknown>),
      announceCustomer,
    },
  };
});

const { ensureCheckoutCustomer } = await import('./checkout-service');
const { ensureChannelCustomer } = await import('./channel-order-ingest');

const TENANT = '5944fe23-be83-4ce5-aafc-ef56b8594508';
const SITE = '8af579c5-b6d1-4a46-a3a0-0d3d109b37b6';

function fakeTx(existing: { id: string } | null) {
  return {
    property: { findFirst: () => Promise.resolve({ id: SITE }) },
    customer: {
      findFirst: () => Promise.resolve(existing),
      create: ({ data }: { data: { email: string } }) =>
        Promise.resolve({ id: 'new-buyer', type: 'retail', email: data.email }),
    },
  } as never;
}

beforeEach(() => {
  announceCustomer.mockReset().mockResolvedValue(undefined);
});

describe('a guest checkout', () => {
  it('announces a buyer the business did not have as captured', async () => {
    const id = await ensureCheckoutCustomer(
      fakeTx(null),
      TENANT,
      SITE,
      'Marcus@Example.test',
      'Marcus Oyelaran-Pike'
    );
    expect(id).toBe('new-buyer');
    expect(announceCustomer).toHaveBeenCalledWith(TENANT, 'crm.customer.captured', {
      id: 'new-buyer',
      type: 'retail',
      email: 'marcus@example.test',
    });
  });

  it('says nothing about a buyer it already had', async () => {
    await ensureCheckoutCustomer(fakeTx({ id: 'known' }), TENANT, SITE, 'marcus@example.test');
    expect(announceCustomer).not.toHaveBeenCalled();
  });
});

describe('a marketplace order', () => {
  it('announces a buyer the business did not have as captured', async () => {
    const id = await ensureChannelCustomer(
      fakeTx(null),
      TENANT,
      { email: 'marcus@example.test', name: 'Marcus Oyelaran-Pike' },
      'tiktok-1001'
    );
    expect(id).toBe('new-buyer');
    expect(announceCustomer).toHaveBeenCalledWith(TENANT, 'crm.customer.captured', {
      id: 'new-buyer',
      type: 'retail',
      email: 'marcus@example.test',
    });
  });

  it('says nothing about a buyer it already had', async () => {
    await ensureChannelCustomer(
      fakeTx({ id: 'known' }),
      TENANT,
      { email: 'marcus@example.test', name: null },
      'tiktok-1001'
    );
    expect(announceCustomer).not.toHaveBeenCalled();
  });
});
