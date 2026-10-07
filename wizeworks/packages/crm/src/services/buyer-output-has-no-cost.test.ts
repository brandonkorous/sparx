import { createHash } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * WHAT A LINE COST YOU NEVER REACHES THE BUYER (sparx persona issue 086).
 *
 * A quote now keeps a cost on every line so the business sees its margin while
 * it prices. That figure is the business's own: a buyer who reads it knows the
 * exact profit on every part. This drives every document a buyer can receive
 * (the printed copy, live and frozen, the email that carries it, and the
 * signing page) with lines that DO carry a cost, a margin and a markup rule's
 * name, and fails if any of them comes out the other side.
 */

import type { BillingDocument, BillingDocumentLine, DocumentStage } from '@wizeworks/db';
import { buildSnapshotPayload } from './billing-snapshot';

const DOC = '6e1f4a0c-7d0b-4c55-8a4e-3b9f6f0c2a11';
const ACCOUNT = '8aa59a36-acc9-455f-b0ba-41c0b66292b9';
const TOKEN = 'signing-token-for-the-test';

// The staff-only figures on the line: cost $412.50, margin 31.25%, markup
// 45.45%, priced by the rule "Parts plus 45".
const COST_CENTS = 41_250;
const MARKERS = ['41250', '41,250', '412.5', '31.25', '45.45', 'Parts plus 45'];
const KEYS = [
  '"costCents"',
  '"appliedMarkup"',
  '"marginPct"',
  '"markupPct"',
  '"explicitCostCents"',
];

const stage = {
  id: 'stage-quoted',
  name: 'Quoted',
  customerLabel: 'Quoted',
  stageType: 'open',
} as unknown as DocumentStage;

const lines = [
  {
    id: 'line-1',
    lineTypeId: 'type-part',
    productId: null,
    variantId: null,
    technicianUserId: null,
    description: 'Bosch Remanufactured Fuel Injector (0986435621)',
    quantity: 1,
    unitPrice: 600,
    costCents: COST_CENTS,
    appliedMarkup: {
      ruleId: null,
      ruleName: 'Parts plus 45',
      method: 'percentage',
      value: 0.4545,
      costSource: 'manual',
      costBasisValueCents: COST_CENTS,
      computedPriceCents: 60_000,
      marginPct: 31.25,
      markupPct: 45.45,
      computedAt: '2026-10-02T17:00:00.000Z',
    },
    taxable: true,
    discountAmount: 0,
    taxAmount: 0,
    lineSubtotal: 600,
    lineTotal: 600,
    coreCharge: null,
    sortOrder: 0,
  },
] as unknown as BillingDocumentLine[];

const doc = {
  id: DOC,
  number: 'Q-000031',
  currency: 'USD',
  taxRate: 0,
  status: 'open',
  notes: null,
  validUntil: new Date('2026-10-31T12:00:00Z'),
  dueAt: null,
  metadata: {},
  subtotal: 600,
  discountTotal: 0,
  taxTotal: 0,
  shippingTotal: 0,
  surchargeTotal: 0,
  coreChargeTotal: 0,
  total: 600,
  depositTotal: 0,
  amountPaid: 0,
  balance: 600,
  customerId: null,
  companyId: ACCOUNT,
  propertyId: null,
  billTo: { name: 'Wasatch Front Utility Contractors', email: 'ap@wasatch.test' },
  shipTo: null,
  issuedBy: { siteName: 'Gillett Diesel' },
  finalizedAt: null,
  createdAt: new Date('2026-10-02T17:00:00Z'),
  deletedAt: null,
  stageId: stage.id,
} as unknown as BillingDocument;

const fullDoc = {
  ...doc,
  stage,
  workflow: { slug: 'b2b-quotes' },
  lines,
  payments: [],
  customer: null,
  property: { name: 'Gillett Diesel' },
};

const tx = {
  billingDocument: { findUnique: vi.fn(() => Promise.resolve(fullDoc)) },
  billingDocumentLineType: {
    findMany: vi.fn(() =>
      Promise.resolve([{ id: 'type-part', label: 'Part', pricingMode: 'flat' }])
    ),
  },
  billingDocumentSnapshot: {
    findUnique: vi.fn(() =>
      Promise.resolve({
        id: 'snap-1',
        documentNumber: 'Q-000031',
        createdAt: new Date('2026-10-02T18:00:00Z'),
        snapshot: buildSnapshotPayload(doc, lines, stage),
      })
    ),
  },
  billingDocumentSignature: {
    findFirst: vi.fn(() =>
      Promise.resolve({
        id: 'sig-1',
        tokenHash: createHash('sha256').update(TOKEN).digest('hex'),
        status: 'signed',
        signerName: 'Renee Castaneda',
        signerEmail: 'ap@wasatch.test',
        expiresAt: new Date('2026-10-30T00:00:00Z'),
        viewedAt: new Date('2026-10-02T18:00:00Z'),
        signedAt: new Date('2026-10-02T18:05:00Z'),
        declineReason: null,
        document: fullDoc,
      })
    ),
  },
  company: { findUnique: vi.fn(() => Promise.resolve(null)) },
  customer: { findUnique: vi.fn(() => Promise.resolve(null)) },
  property: { findUnique: vi.fn(() => Promise.resolve(null)) },
  tenant: { findUnique: vi.fn(() => Promise.resolve({ name: 'Gillett Diesel' })) },
  // The printed issue date is read on the business's clock (issue 145).
  tenantBusiness: { findUnique: vi.fn(() => Promise.resolve(null)) },
};

vi.mock('@wizeworks/db', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  withTenant: (_ctx: unknown, fn: (t: unknown) => unknown) => Promise.resolve(fn(tx)),
}));
vi.mock('@wizeworks/db/site-origin', () => ({
  resolveSiteOrigin: vi.fn(() => Promise.resolve('https://gillett.test')),
  siteUrl: (origin: string, path: string) => `${origin}${path}`,
}));
vi.mock('./billing-document-stage-service', () => ({
  dueDateFromTerms: vi.fn(() => Promise.resolve(null)),
}));

const { buildRenderData, buildRenderDataFromSnapshot } = await import('./billing-render-service');
const { renderBillingDocumentHtml } = await import('./billing-document-html');
const { billingDocumentEmail } = await import('./billing-document-mail');
const { viewByToken } = await import('./signature-service');

const CTX = { tenantId: '5944fe23-be83-4ce5-aafc-ef56b8594508' };

/** Every staff-only figure or field name found in what a buyer receives. */
function leaks(output: unknown): string[] {
  const text = typeof output === 'string' ? output : JSON.stringify(output);
  return [...MARKERS, ...KEYS].filter((marker) => text.includes(marker));
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('a buyer never receives what a line cost', () => {
  it('in the printed document', async () => {
    const data = await buildRenderData(CTX, DOC);
    // The line itself is there, so this is not passing on an empty document.
    expect(JSON.stringify(data)).toContain('Bosch Remanufactured Fuel Injector');
    expect(leaks(data)).toEqual([]);
    expect(leaks(renderBillingDocumentHtml(data))).toEqual([]);
  });

  it('in a frozen copy, whose stored record does carry the cost', async () => {
    // The snapshot keeps the cost for the business's own records; the copy
    // printed from it must not.
    expect(leaks(buildSnapshotPayload(doc, lines, stage)).length).toBeGreaterThan(0);
    const data = await buildRenderDataFromSnapshot(CTX, 'snap-1');
    expect(JSON.stringify(data)).toContain('Bosch Remanufactured Fuel Injector');
    expect(leaks(data)).toEqual([]);
    expect(leaks(renderBillingDocumentHtml(data))).toEqual([]);
  });

  it('in the email that carries the quote or invoice', async () => {
    const email = await billingDocumentEmail(CTX, DOC);
    expect(JSON.stringify(email.props)).toContain('Bosch Remanufactured Fuel Injector');
    expect(leaks(email)).toEqual([]);
  });

  it('on the page where they sign it', async () => {
    const view = await viewByToken(CTX, TOKEN);
    expect(JSON.stringify(view)).toContain('Bosch Remanufactured Fuel Injector');
    expect(leaks(view)).toEqual([]);
  });
});
