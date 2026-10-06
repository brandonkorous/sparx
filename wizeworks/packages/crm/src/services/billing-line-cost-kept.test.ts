import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * AN EDITED LINE KEEPS THE COST ALREADY ON IT (sparx persona issue 086).
 *
 * The line row lets a price be typed straight over, and that save sends the new
 * price and nothing about cost. Re-pricing then started from "no cost", so a
 * flat line lost the cost typed for it and a quote's margin vanished the moment
 * somebody adjusted a price, which is exactly when margin is being watched.
 */

const LINE = '2c4e6a80-1b3d-4f5a-8c7e-9d0f1a2b3c4d';
const DOC = '6e1f4a0c-7d0b-4c55-8a4e-3b9f6f0c2a11';
const FLAT = '9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d';
const INJECTOR = '0b8f2c1e-4d3a-4f5b-9c6d-7e8f9a0b1c2d';
const OTHER_PART = '1c9f3d2e-5e4b-4a6c-8d7e-8f9a0b1c2d3e';

let existing: Record<string, unknown>;
const update = vi.fn((_args: { data: Record<string, unknown> }) => Promise.resolve({}));
const variantCosts = new Map<string, number | null>();

const tx = {
  billingDocumentLine: {
    findUnique: vi.fn(() => Promise.resolve(existing)),
    update,
  },
  billingDocument: {
    findUnique: vi.fn(() =>
      Promise.resolve({ id: DOC, deletedAt: null, taxRate: 0, stage: { locksEditing: false } })
    ),
    findUniqueOrThrow: vi.fn(() => Promise.resolve({ id: DOC, lines: [] })),
  },
  billingDocumentLineType: {
    findUnique: vi.fn(() =>
      Promise.resolve({ id: FLAT, pricingMode: 'flat', defaultTaxable: true })
    ),
  },
  productVariant: {
    findFirst: vi.fn((args: { where: { id?: string } }) => {
      const id = args.where.id ?? '';
      return Promise.resolve(
        variantCosts.has(id)
          ? { costCents: variantCosts.get(id), priceCents: 60_000, coreChargeCents: null }
          : null
      );
    }),
  },
};

vi.mock('@wizeworks/db', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  withTenant: (_ctx: unknown, fn: (t: unknown) => unknown) => Promise.resolve(fn(tx)),
}));
vi.mock('../audit', () => ({ writeAuditLog: vi.fn(() => Promise.resolve()) }));
vi.mock('./billing-document-service', () => ({ recomputeTotals: vi.fn(() => Promise.resolve()) }));

const { updateLine } = await import('./billing-line-service');

const CTX = { tenantId: '5944fe23-be83-4ce5-aafc-ef56b8594508', userId: 'u-doty' };

function savedCost(): unknown {
  const call = update.mock.calls.at(-1);
  return call?.[0].data.costCents;
}

beforeEach(() => {
  vi.clearAllMocks();
  variantCosts.clear();
  variantCosts.set(INJECTOR, 41_250);
  variantCosts.set(OTHER_PART, 30_000);
  existing = {
    id: LINE,
    documentId: DOC,
    lineTypeId: FLAT,
    variantId: null,
    productId: null,
    quantity: 1,
    unitPrice: 180,
    discountAmount: 0,
    taxable: true,
    costCents: 9_500,
    appliedMarkup: null,
  };
});

describe('updateLine keeps the cost', () => {
  it('when only the price is changed from the row', async () => {
    await updateLine(CTX, LINE, { unitPrice: 200 });
    expect(savedCost()).toBe(9_500);
  });

  it('takes a cost the edit does send', async () => {
    await updateLine(CTX, LINE, { unitPrice: 200, explicitCostCents: 11_000 });
    expect(savedCost()).toBe(11_000);
  });

  it('clears it when the edit sends null and the line names no part', async () => {
    await updateLine(CTX, LINE, { unitPrice: 200, explicitCostCents: null });
    expect(savedCost()).toBeNull();
  });

  it('follows a different part when the edit names one', async () => {
    existing = { ...existing, variantId: INJECTOR, costCents: 41_250 };
    await updateLine(CTX, LINE, { unitPrice: 450, variantId: OTHER_PART });
    expect(savedCost()).toBe(30_000);
  });
});
