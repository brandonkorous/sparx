// The invoice list holds quotes too, and a quote is not a bill (sparx persona
// issue 085). Doty's list read "Q-000002 · Owed · $4,075.60" under the invoice
// for the same order, and the "Owed" filter kept it: a quote carries `unpaid`
// from the moment it exists, and the filter asked only the payment status.

import { beforeEach, describe, expect, it, vi } from 'vitest';

let rows: Record<string, unknown>[];
const findMany = vi.fn((_args: { where: Record<string, unknown> }) => Promise.resolve(rows));

const tx = {
  billingDocument: { findMany, count: vi.fn(() => Promise.resolve(rows.length)) },
};

vi.mock('@wizeworks/db', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  withTenant: (_ctx: unknown, fn: (t: unknown) => unknown) => Promise.resolve(fn(tx)),
}));

const { list, ISSUED_BILL_WHERE } = await import('../../src/services/billing-document-service');

const CTX = { tenantId: '5944fe23-be83-4ce5-aafc-ef56b8594508' };

function row(slug: string, stage: { name: string; stageType: string }) {
  return {
    id: slug,
    billTo: null,
    metadata: {},
    customer: null,
    company: { companyName: 'Wasatch Front Utility Contractors, LLC' },
    workflow: { slug },
    stage,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  rows = [
    row('net-terms-ar', { name: 'Invoice', stageType: 'final' }),
    row('b2b-quotes', { name: 'Accepted', stageType: 'committed' }),
  ];
});

describe('the invoice list', () => {
  it('asks a payment filter of bills only', async () => {
    await list(CTX, { status: 'unpaid' });
    const where = findMany.mock.calls[0]?.[0].where;
    expect(where).toMatchObject({ status: 'unpaid', ...ISSUED_BILL_WHERE });
  });

  it('still finds a written-off document, which the bill rule leaves out', async () => {
    await list(CTX, { status: 'void' });
    const where = findMany.mock.calls[0]?.[0].where;
    expect(where?.status).toBe('void');
    expect(where).not.toHaveProperty('workflow');
  });

  it('tells a quote row from an invoice row, and says where the quote stands', async () => {
    const { items } = await list(CTX, {});
    expect(items.map((item) => [item.priceOffer, item.stageName])).toEqual([
      [false, 'Invoice'],
      [true, 'Accepted'],
    ]);
  });
});
