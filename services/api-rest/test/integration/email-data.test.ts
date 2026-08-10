// resolveSilicaEmailData against the real DB (docs/91 §3, docs/120). Proves the
// dispatch-time resolver hydrates the nested DataSources the send reads — entity-scoped
// sources keyed by the send's `entityRefs`, line-item collections, and `*Url` tokens —
// for the real `invoicing-overdue` default template.
//
// The ad-hoc fixtures below are authored as legacy sparx trees and CONVERTED
// (`emailTreeToSilica`), which is deliberate: it exercises the conversion against the
// real database on the way in, so a converted email's bindings are proven to still
// resolve — not just to have the right node shape.

import crypto from 'node:crypto';

import { prisma, withTenant } from '@sparx/db';
import {
  emailTreeToSilica,
  getDefaultEmailTemplate,
  type BuilderNode,
} from '@sparx/builder-schemas';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { resolveSilicaEmailData, applyEntitySnapshot } from '../../src/lib/email-data.js';
import { createTestTenant, dropTestTenant, type TestTenant } from '../helpers.js';

/** A legacy tree fixture, as the send now sees it: converted to a silica document. */
const asDoc = (tree: BuilderNode) => emailTreeToSilica(tree, '', null);

describe('resolveSilicaEmailData — invoice template', () => {
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
          // Every document has an issuing site (docs/131 §3.6) — the fixture's
          // primary, seeded by createTestTenant exactly as provisioning does.
          propertyId: fixture.propertyId,
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
    const data = await resolveSilicaEmailData(
      { tenantId: fixture.tenantId },
      tpl.doc,
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
        // Canonical `{{site.*}}` + the legacy `{{tenant.*}}` alias in the SAME tree —
        // the resolver hydrates identity under both roots (docs/52 §7 back-compat).
        { id: 'h', type: 'Heading', props: { text: 'Welcome to {{site.name}}' } },
        { id: 'h2', type: 'Heading', props: { text: 'Visit {{tenant.siteUrl}}' } },
        { id: 'p', type: 'Text', props: { text: 'Hi {{customer.firstName ?? "there"}}' } },
      ],
    };
    const data = await resolveSilicaEmailData({ tenantId: fixture.tenantId }, asDoc(tree), {
      email: 'ar@buyer.test',
      customerId,
    });
    expect((data.customer as Record<string, unknown>).firstName).toBe('Sam');
    // Both roots resolve to the same identity; `url` is canonical, `siteUrl` an alias.
    expect(String((data.site as Record<string, unknown>).name)).toContain('Test test-');
    expect(String((data.tenant as Record<string, unknown>).name)).toContain('Test test-');
    expect((data.site as Record<string, unknown>).url).toBe(
      (data.tenant as Record<string, unknown>).siteUrl
    );
  });

  it('resolves {{site.name}}/{{tenant.name}} to the active Property.name, never the tenant or brand businessName (docs/49)', async () => {
    // A multi-site tenant authoring a specific site. The customer-facing name is the
    // SITE's `Property.name` ('Override Site') — NOT the tenant's org name and NOT
    // the brand_override businessName (kept here only to prove the name no longer
    // comes from it).
    const propertyId = await withTenant({ tenantId: fixture.tenantId }, (tx) =>
      tx.property
        .create({
          data: {
            tenantId: fixture.tenantId,
            slug: `site-${crypto.randomBytes(3).toString('hex')}`,
            name: 'Override Site',
            isPrimary: false,
            brandOverride: { businessName: 'Driftwood Supply Co.' },
          },
          select: { id: true },
        })
        .then((p) => p.id)
    );
    const tree = {
      id: 'root',
      type: 'Section',
      props: {},
      children: [
        { id: 'h', type: 'Heading', props: { text: 'Welcome to {{site.name}}' } },
        { id: 'h2', type: 'Heading', props: { text: 'From {{tenant.name}}' } },
      ],
    };

    // With the site's propertyId, the site's Property.name wins under BOTH the
    // canonical `site` root and the legacy `tenant` alias — body copy reads the site
    // name, matching the per-site wordmark/footer chrome (and the canvas/preview).
    const scoped = await resolveSilicaEmailData(
      { tenantId: fixture.tenantId },
      asDoc(tree),
      { email: 'ar@buyer.test' },
      [],
      propertyId
    );
    expect(String((scoped.site as Record<string, unknown>).name)).toBe('Override Site');
    expect(String((scoped.tenant as Record<string, unknown>).name)).toBe('Override Site');

    // Without a propertyId and no primary property in this bare fixture, the resolver
    // returns no site name and falls through to the defensive org-name guard. In
    // PRODUCTION a primary property always exists (seeded at provisioning), so this
    // tail is unreachable there — it only guards a never-blank token.
    const unscoped = await resolveSilicaEmailData({ tenantId: fixture.tenantId }, asDoc(tree), {
      email: 'ar@buyer.test',
    });
    expect(String((unscoped.tenant as Record<string, unknown>).name)).toContain('Test test-');
  });

  it('only loads the sources the email references (no order/cart for an invoice email)', async () => {
    const tpl = getDefaultEmailTemplate('invoicing-overdue')!;
    const data = await resolveSilicaEmailData({ tenantId: fixture.tenantId }, tpl.doc, {
      email: 'ar@buyer.test',
      customerId,
      billingDocumentId,
    });
    expect(data.order).toBeUndefined();
    expect(data.cart).toBeUndefined();
    expect(data.company).toBeUndefined();
  });

  it('applyEntitySnapshot fills a scalar token when the live entity is gone', () => {
    // Empty live data (e.g. a deleted invoice) → the flat trigger-time snapshot
    // supplies the scalar fallback.
    const data = applyEntitySnapshot({}, { 'invoice.number': 'INV-OLD', 'invoice.balance': 999 });
    expect((data.invoice as Record<string, unknown>).number).toBe('INV-OLD');
    expect((data.invoice as Record<string, unknown>).balance).toBe(999);
  });
});
