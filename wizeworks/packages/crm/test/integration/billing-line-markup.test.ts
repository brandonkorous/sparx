// Invoicing (docs/87 §5 / docs/48) — pricing a billing-document line BY MARKUP,
// the exact service path the dashboard line grid drives. Proves end-to-end against
// a real RLS-scoped DB that:
//   (1) a markup line priced by a saved, document-applicable RULE resolves the
//       rule's cost→price math and snapshots it (reproducible after cost drift),
//   (2) an AD-HOC markup (no saved rule) prices + snapshots with a null ruleId,
//   (3) a pass_through line marks up over its cost, or passes through AT cost when
//       no markup is given,
//   (4) editing a markup line re-prices it from the new cost, and
//   (5) a catalog-only rule is refused on a document line.
//
// The cost→price arithmetic is the same pure `applyMarkupRule` the catalog + quote
// paths use; this asserts the billing-line glue (resolveAndPriceLine → snapshot →
// line totals) is wired through addLine/updateLine.

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { prisma } from '@wizeworks/db';

import {
  billingDocumentService,
  billingLineService,
  customerService,
  documentLineTypeService,
  documentWorkflowService,
} from '../../src/services/index.js';
import { disposeTestContext, makeTestContext, type TestContext } from '../helpers.js';

interface LineMarkupSnapshot {
  ruleId: string | null;
  ruleName: string | null;
  marginPct: number;
}

/** Create a markup_rules row (FORCE-RLS) scoped to the tenant. */
async function createMarkupRule(
  tenantId: string,
  data: { name: string; method: string; value: number; appliesTo: 'catalog' | 'document' | 'both' }
): Promise<string> {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`SET LOCAL app.tenant_id = '${tenantId}'`);
    const rule = await tx.markupRule.create({
      data: {
        tenantId,
        name: data.name,
        method: data.method,
        value: data.value,
        appliesTo: data.appliesTo,
      },
      select: { id: true },
    });
    return rule.id;
  });
}

describe('billing line markup', () => {
  let test: TestContext;
  let customerId: string;
  let invoiceWorkflowId: string;
  let documentRuleId: string; // appliesTo 'both' — a 50% parts markup
  let catalogOnlyRuleId: string; // appliesTo 'catalog' — must be refused on a doc line

  beforeAll(async () => {
    test = await makeTestContext('owner');
    await documentWorkflowService.bootstrapDefaultWorkflows(test.ctx);
    await documentLineTypeService.bootstrapDefaultLineTypes(test.ctx);

    const customer = await customerService.create(test.ctx, {
      type: 'retail',
      email: 'markup@billing.test',
      firstName: 'Mark',
      lastName: 'Up',
    });
    customerId = customer.id;

    const workflows = await documentWorkflowService.list(test.ctx);
    const invoice = workflows.find((w) => w.slug === 'invoice');
    if (!invoice) throw new Error('default invoice workflow not seeded');
    invoiceWorkflowId = invoice.id;

    documentRuleId = await createMarkupRule(test.tenant.tenantId, {
      name: 'Standard parts 50%',
      method: 'percentage',
      value: 0.5, // fractions: 0.5 = 50% markup over cost
      appliesTo: 'both',
    });
    catalogOnlyRuleId = await createMarkupRule(test.tenant.tenantId, {
      name: 'Catalog only',
      method: 'percentage',
      value: 0.25,
      appliesTo: 'catalog',
    });
  });

  afterAll(async () => {
    await disposeTestContext(test);
  });

  function newInvoice() {
    return billingDocumentService.create(test.ctx, {
      workflowId: invoiceWorkflowId,
      customerId,
      taxRate: 0,
    });
  }

  it('prices a markup line by a saved rule and snapshots it', async () => {
    const doc = await newInvoice();
    const updated = await billingLineService.addLine(test.ctx, doc.id, {
      lineTypeKey: 'part',
      description: 'Brake pad',
      quantity: 2,
      explicitCostCents: 4000, // $40 cost
      markup: { kind: 'rule', ruleId: documentRuleId },
    });
    const line = updated.lines[0]!;
    expect(Number(line.unitPrice)).toBe(60); // 40 × 1.5
    expect(line.costCents).toBe(4000);
    const snap = line.appliedMarkup as unknown as LineMarkupSnapshot | null;
    expect(snap?.ruleId).toBe(documentRuleId);
    expect(snap?.ruleName).toBe('Standard parts 50%');
    expect(Number(updated.subtotal)).toBe(120); // 60 × 2
  });

  it('prices an ad-hoc markup line with a null ruleId', async () => {
    const doc = await newInvoice();
    const updated = await billingLineService.addLine(test.ctx, doc.id, {
      lineTypeKey: 'part',
      description: 'One-off part',
      quantity: 1,
      explicitCostCents: 1000, // $10
      markup: { kind: 'adhoc', method: 'percentage', value: 1 }, // 100% markup
    });
    const line = updated.lines[0]!;
    expect(Number(line.unitPrice)).toBe(20); // 10 × 2
    const snap = line.appliedMarkup as unknown as LineMarkupSnapshot | null;
    expect(snap?.ruleId).toBeNull();
  });

  it('marks up a pass_through line, and passes through at cost without a markup', async () => {
    const doc = await newInvoice();
    let updated = await billingLineService.addLine(test.ctx, doc.id, {
      lineTypeKey: 'sublet',
      description: 'Outside machining',
      quantity: 1,
      explicitCostCents: 20000, // $200
      markup: { kind: 'adhoc', method: 'percentage', value: 0.2 }, // 20%
    });
    const marked = updated.lines.find((l) => l.description === 'Outside machining')!;
    expect(Number(marked.unitPrice)).toBe(240); // 200 × 1.2

    updated = await billingLineService.addLine(test.ctx, doc.id, {
      lineTypeKey: 'sublet',
      description: 'Freight pass-through',
      quantity: 1,
      explicitCostCents: 5000, // $50, no markup → at cost
    });
    const passed = updated.lines.find((l) => l.description === 'Freight pass-through')!;
    expect(Number(passed.unitPrice)).toBe(50);
    expect(passed.appliedMarkup).toBeNull();
  });

  it('re-prices a markup line from the new cost on edit', async () => {
    const doc = await newInvoice();
    const added = await billingLineService.addLine(test.ctx, doc.id, {
      lineTypeKey: 'part',
      description: 'Filter',
      quantity: 1,
      explicitCostCents: 1000, // $10
      markup: { kind: 'rule', ruleId: documentRuleId },
    });
    const lineId = added.lines[0]!.id;
    expect(Number(added.lines[0]!.unitPrice)).toBe(15); // 10 × 1.5

    const edited = await billingLineService.updateLine(test.ctx, lineId, {
      explicitCostCents: 2000, // $20
      markup: { kind: 'rule', ruleId: documentRuleId },
    });
    const line = edited.lines.find((l) => l.id === lineId)!;
    expect(Number(line.unitPrice)).toBe(30); // 20 × 1.5
    expect(line.costCents).toBe(2000);
  });

  it('refuses a catalog-only rule on a document line', async () => {
    const doc = await newInvoice();
    await expect(
      billingLineService.addLine(test.ctx, doc.id, {
        lineTypeKey: 'part',
        description: 'Bad rule',
        quantity: 1,
        explicitCostCents: 1000,
        markup: { kind: 'rule', ruleId: catalogOnlyRuleId },
      })
    ).rejects.toThrow(/catalog-only/i);
  });
});
