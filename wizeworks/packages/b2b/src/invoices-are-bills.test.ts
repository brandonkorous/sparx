// THE WHOLESALE INVOICES LIST IS BILLS, NOT QUOTES.
//
// MEASURED 2026-10-06 on Gillett: Wholesale invoices listed his six invoices and
// then eight quotes, every one "Owed", $22,389.72 nobody owed him. One was a
// draft never sent; one was O'Malley's quote whose order he had rejected. The
// list asked only `companyId is not null`, and a quote is a billing document
// with a company and a balance too (sparx persona issue 094).
//
// The fake database below reads the clauses the real one would, so the test
// holds the query to the rows Gillett really has: an invoice on account, an
// invoice from the invoice editor, an accepted quote, a draft quote.

import { describe, expect, it, vi } from 'vitest';
import type * as Crm from '@wizeworks/crm';

interface Row {
  id: string;
  number: string;
  companyId: string | null;
  deletedAt: null;
  status: string;
  workflow: { slug: string };
  stage: { stageType: string };
}

const ROWS: Row[] = [
  {
    id: 'inv-9',
    number: 'INV-000009',
    companyId: 'slco',
    deletedAt: null,
    status: 'unpaid',
    workflow: { slug: 'net-terms-ar' },
    stage: { stageType: 'final' },
  },
  {
    id: 'inv-3',
    number: 'INV-000003',
    companyId: 'wasatch',
    deletedAt: null,
    status: 'unpaid',
    workflow: { slug: 'invoice' },
    stage: { stageType: 'open' },
  },
  {
    id: 'q-8',
    number: 'Q-000008',
    companyId: 'slco',
    deletedAt: null,
    status: 'unpaid',
    workflow: { slug: 'b2b-quotes' },
    stage: { stageType: 'committed' },
  },
  {
    id: 'q-11',
    number: 'Q-000011',
    companyId: 'wasatch',
    deletedAt: null,
    status: 'unpaid',
    workflow: { slug: 'b2b-quotes' },
    stage: { stageType: 'draft' },
  },
];

type Clause = Record<string, unknown>;

/** The handful of Prisma clauses these queries use, read as Postgres reads them. */
function matches(row: Row, where: Clause): boolean {
  for (const [key, value] of Object.entries(where)) {
    if (key === 'workflow' || key === 'stage') {
      const field = key === 'workflow' ? row.workflow.slug : row.stage.stageType;
      const inner = Object.values(value as Clause)[0] as Clause;
      if (Array.isArray(inner.notIn) && (inner.notIn as string[]).includes(field)) return false;
      if (Array.isArray(inner.in) && !(inner.in as string[]).includes(field)) return false;
      continue;
    }
    const actual = (row as unknown as Clause)[key];
    if (value !== null && typeof value === 'object') {
      const op = value as Clause;
      if ('not' in op && actual === op.not) return false;
      if (Array.isArray(op.in) && !op.in.includes(actual)) return false;
      if (Array.isArray(op.notIn) && op.notIn.includes(actual)) return false;
      continue;
    }
    if (actual !== value) return false;
  }
  return true;
}

const asDoc = (row: Row) => ({
  ...row,
  total: 1,
  balance: 1,
  overdueDays: 0,
  dueAt: null,
  paidAt: null,
  notes: null,
  metadata: {},
  createdAt: new Date(0),
  updatedAt: new Date(0),
  company: null,
  payments: [],
});

const billingDocument = {
  findMany: vi.fn(({ where }: { where: Clause }) =>
    Promise.resolve(ROWS.filter((row) => matches(row, where)).map(asDoc))
  ),
  count: vi.fn(({ where }: { where: Clause }) =>
    Promise.resolve(ROWS.filter((row) => matches(row, where)).length)
  ),
  findFirst: vi.fn(({ where }: { where: Clause }) => {
    const row = ROWS.find((candidate) => matches(candidate, where));
    return Promise.resolve(row ? { ...asDoc(row), balance: 10 } : null);
  }),
};

const recordPayment = vi.fn(() => Promise.resolve());

vi.mock('@wizeworks/db', () => ({
  withTenant: (_ctx: unknown, run: (tx: unknown) => unknown) =>
    run({ billingDocument, company: { updateMany: () => Promise.resolve() } }),
}));
vi.mock('@wizeworks/crm', async () => {
  // The real rules, so the test follows them if they change.
  const actual = await vi.importActual<typeof Crm>('@wizeworks/crm');
  return {
    ISSUED_BILL_WHERE: actual.ISSUED_BILL_WHERE,
    OWED_DOCUMENT_WHERE: actual.OWED_DOCUMENT_WHERE,
    b2bArService: {},
    billingPaymentService: { recordPayment },
  };
});
vi.mock('@wizeworks/api-core/errors', () => ({
  notFound: (message: string) => new Error(message),
  badRequest: (message: string) => new Error(message),
}));

const { listInvoices, getInvoice, markInvoicePaid } = await import('./invoices.js');

const ctx = { tenantId: 'gillett', userId: 'doty' } as never;

describe('Wholesale invoices', () => {
  it('lists the invoices and leaves the quotes out', async () => {
    const page = await listInvoices(ctx, { take: 50, skip: 0 });
    expect(page.items.map((item) => item.invoiceNumber).sort()).toEqual([
      'INV-000003',
      'INV-000009',
    ]);
    expect(page.total).toBe(2);
  });

  it('narrows to one account without letting its quotes back in', async () => {
    const page = await listInvoices(ctx, { account_id: 'slco', take: 50, skip: 0 });
    expect(page.items.map((item) => item.invoiceNumber)).toEqual(['INV-000009']);
  });

  it('will not open a quote as an invoice', async () => {
    await expect(getInvoice(ctx, 'q-8')).rejects.toThrow('Invoice not found');
  });

  it('will not mark a quote paid', async () => {
    recordPayment.mockClear();
    await expect(markInvoicePaid(ctx, 'q-11', { paidMethod: 'check' })).rejects.toThrow(
      'Invoice not found'
    );
    expect(recordPayment).not.toHaveBeenCalled();
  });
});
