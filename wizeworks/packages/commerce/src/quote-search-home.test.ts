// Where a quote and an invoice live in the search box (sparx persona issue
// 086).
//
// A wholesale quote and an invoice are rows in one table. The search box filed
// Wasatch Front's quotes Q-000012 and Q-000013 under "Invoices", and opening one
// landed on the wholesale invoices list instead of the quote. Each kind now
// indexes as its own entity type, so the box groups it under its own heading
// and opens its own screen. Only one of the two readers answers for any one
// document; the other says null, which deletes a stale entry of the wrong kind.

import { beforeEach, describe, expect, it, vi } from 'vitest';

interface Row {
  id: string;
  number: string;
  status: string;
  workflow: { slug: string };
  company: { companyName: string } | null;
  customer: null;
  createdAt: Date;
  updatedAt: Date;
}

let rows: Row[] = [];

const tx = {
  billingDocument: {
    findFirst: ({ where }: { where: { id: string } }) =>
      Promise.resolve(rows.find((row) => row.id === where.id) ?? null),
  },
};

vi.mock('@wizeworks/db', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  withTenant: (_ctx: unknown, fn: (t: unknown) => unknown) => Promise.resolve(fn(tx)),
}));

const { commerceUniversalProjectors } = await import('./universal-projection');

const ctx = { tenantId: 'tenant-1' };

function projector(entityType: string) {
  const found = commerceUniversalProjectors.find((p) => p.entityType === entityType);
  if (!found) throw new Error(`no ${entityType} projector`);
  return found;
}

function doc(id: string, number: string, slug: string): Row {
  return {
    id,
    number,
    status: 'sent',
    workflow: { slug },
    company: { companyName: 'Wasatch Front Utility Contractors, LLC' },
    customer: null,
    createdAt: new Date('2026-10-02T15:00:00Z'),
    updatedAt: new Date('2026-10-02T15:00:00Z'),
  };
}

beforeEach(() => {
  rows = [
    doc('q12', 'Q-000012', 'b2b-quotes'),
    doc('inv7', 'INV-000007', 'net-terms-ar'),
    doc('inv3', 'INV-000003', 'invoice'),
  ];
});

describe('a wholesale quote in the search box', () => {
  it('is indexed as a quote that opens the quote', async () => {
    const indexed = await projector('quote').project(ctx, 'q12');
    expect(indexed).toMatchObject({
      entity_type: 'quote',
      module: 'b2b',
      title: 'Q-000012',
      url: '/wholesale/quotes/q12',
    });
  });

  it('is not indexed a second time as an invoice', async () => {
    expect(await projector('billing_document').project(ctx, 'q12')).toBeNull();
  });
});

describe('an invoice in the search box', () => {
  it('a wholesale one opens the wholesale invoice', async () => {
    const indexed = await projector('billing_document').project(ctx, 'inv7');
    expect(indexed).toMatchObject({
      entity_type: 'billing_document',
      module: 'invoicing',
      url: '/wholesale/invoices/inv7',
    });
  });

  it('any other one opens the invoice editor', async () => {
    const indexed = await projector('billing_document').project(ctx, 'inv3');
    expect(indexed).toMatchObject({ module: 'invoicing', url: '/invoicing/invoices/inv3' });
  });

  it('is never indexed as a quote', async () => {
    expect(await projector('quote').project(ctx, 'inv7')).toBeNull();
    expect(await projector('quote').project(ctx, 'inv3')).toBeNull();
  });
});
