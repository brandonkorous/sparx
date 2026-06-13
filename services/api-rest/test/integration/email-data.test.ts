// resolveEmailData against the real DB (docs/91 §3). Proves the dispatch-time
// resolver hydrates the nested DataSources the Builder email renderer reads —
// entity-scoped sources keyed by the send's `entityRefs`, line-item collections,
// and `*Url` tokens — for the real `invoicing-overdue` default template tree.

import crypto from 'node:crypto';

import { prisma, withTenant } from '@sparx/db';
import { getDefaultEmailTemplate } from '@sparx/builder-schemas';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { resolveEmailData, applyEntitySnapshot } from '../../src/lib/email-data.js';
import { createTestTenant, dropTestTenant, type TestTenant } from '../helpers.js';

describe('resolveEmailData — invoice template', () => {
  let fixture: TestTenant;
  let customerId: string;
  let billingDocumentId: string;

  beforeAll(async () => {
    fixture = await createTestTenant();
    const ctx = { tenantId: fixture.tenantId };
    await withTenant(ctx, async (tx) => {
      const customer = await tx.customer.create({
        data: { tenantId: ctx.tenantId, type: 'retail', email: 'ar@buyer.test', firstName: 'Sam' },
        select: { id: true },
      });
      customerId = customer.id;
      const workflow = await tx.documentWorkflow.create({
        data: {
          tenantId: ctx.tenantId,
          name: 'Invoices',
          slug: `inv-${crypto.randomBytes(3).toString('hex')}`,
          sortOrder: 0,
          stages: {
            create: [
              {
                tenantId: ctx.tenantId,
                name: 'Invoice',
                customerLabel: 'Invoice',
                stageType: 'final',
                sortOrder: 0,
              },
            ],
          },
        },
        include: { stages: true },
      });
      const doc = await tx.billingDocument.create({
        data: {
          tenantId: ctx.tenantId,
          workflowId: workflow.id,
          stageId: workflow.stages[0]!.id,
          customerId,
          number: 'INV-77',
          currency: 'USD',
          subtotal: 1200,
          total: 1200,
          balance: 1200,
          status: 'overdue',
          // 12 days past due.
          dueAt: new Date(Date.now() - 12 * 86_400_000),
          finalizedAt: new Date(),
          lines: {
            create: [
              {
                tenantId: ctx.tenantId,
                description: 'Diagnostic labor',
                quantity: 2,
                unitPrice: 300,
                lineTotal: 600,
                sortOrder: 0,
              },
              {
                tenantId: ctx.tenantId,
                description: 'Replacement injector',
                quantity: 1,
                unitPrice: 600,
                lineTotal: 600,
                sortOrder: 1,
              },
            ],
          },
        },
        select: { id: true },
      });
      billingDocumentId = doc.id;
    });
  });

  afterAll(async () => {
    await dropTestTenant(fixture.tenantId);
    await prisma.$disconnect();
  });

  it('hydrates the invoice (number, balance, computed overdue days, items, payUrl)', async () => {
    const tpl = getDefaultEmailTemplate('invoicing-overdue')!;
    const data = await resolveEmailData(
      { tenantId: fixture.tenantId },
      tpl.tree,
      { email: 'ar@buyer.test', customerId, billingDocumentId },
      [tpl.subject, tpl.preheader]
    );

    const invoice = data.invoice as Record<string, unknown>;
    expect(invoice.number).toBe('INV-77');
    expect(invoice.balance).toBe('$1,200.00');
    expect(invoice.overdueDays).toBe('12');
    // payUrl resolves to a real route (retail invoice → account portal).
    expect(String(invoice.payUrl)).toContain('/account');
    // Line items carry the columns the line_item_table renders.
    const items = invoice.items as Record<string, unknown>[];
    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({
      description: 'Diagnostic labor',
      quantity: '2',
      lineTotal: '$600.00',
    });
  });

  it('hydrates customer + tenant when a tree references those tokens', async () => {
    // A small tree binding customer + tenant tokens (the welcome/marketing shape).
    const tree = {
      id: 'root',
      type: 'Section',
      props: {},
      children: [
        { id: 'h', type: 'Heading', props: { text: 'Welcome to {{tenant.name}}' } },
        { id: 'p', type: 'Text', props: { text: 'Hi {{customer.firstName ?? "there"}}' } },
      ],
    };
    const data = await resolveEmailData({ tenantId: fixture.tenantId }, tree, {
      email: 'ar@buyer.test',
      customerId,
    });
    expect((data.customer as Record<string, unknown>).firstName).toBe('Sam');
    expect(String((data.tenant as Record<string, unknown>).name)).toContain('Test test-');
  });

  it('only loads the sources the tree references (no order/cart for an invoice email)', async () => {
    const tpl = getDefaultEmailTemplate('invoicing-overdue')!;
    const data = await resolveEmailData({ tenantId: fixture.tenantId }, tpl.tree, {
      email: 'ar@buyer.test',
      customerId,
      billingDocumentId,
    });
    expect(data.order).toBeUndefined();
    expect(data.cart).toBeUndefined();
    expect(data.b2bAccount).toBeUndefined();
  });

  it('applyEntitySnapshot fills a scalar token when the live entity is gone', () => {
    // Empty live data (e.g. a deleted invoice) → the flat trigger-time snapshot
    // supplies the scalar fallback.
    const data = applyEntitySnapshot({}, { 'invoice.number': 'INV-OLD', 'invoice.balance': 999 });
    expect((data.invoice as Record<string, unknown>).number).toBe('INV-OLD');
    expect((data.invoice as Record<string, unknown>).balance).toBe(999);
  });
});
