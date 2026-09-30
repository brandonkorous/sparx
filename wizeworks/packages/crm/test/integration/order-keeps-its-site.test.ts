// A sale keeps the site it was made for (issue 878).
//
// A business can run several sites under one account. Every screen that reports
// per site — "How your pages do", a site's own takings, the order list a member
// with access to one site may read — selects on `orders.property_id`. An order
// that carries none is in no site's figures, and no screen says a sale went
// missing; the totals are simply smaller than the truth.
//
// `billing_documents.property_id` is NOT NULL, so a quote always knows which
// site it was written for. The conversion holds that document in its hand and
// used to create the order without it. Measured on 2026-09-30: 106 of 106
// billing documents on the platform carried a site, and the one order made from
// one carried nothing.
//
// The fixture puts the quote on a SECOND site deliberately. A conversion that
// forgot the field entirely and a conversion that quietly reached for the
// tenant's primary site are both wrong, and against a single-site fixture they
// both look right. [[feedback_a_test_that_cannot_go_red]]

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { prisma } from '@wizeworks/db';

import {
  billingDocumentConversionService,
  billingDocumentService,
  billingDocumentStageService,
  billingLineService,
  customerService,
  documentLineTypeService,
  documentWorkflowService,
  orderService,
} from '../../src/services/index.js';
import { disposeTestContext, makeTestContext, type TestContext } from '../helpers.js';

describe('an order keeps the site it was sold on', () => {
  let test: TestContext;
  let customerId: string;
  let secondSiteId: string;
  let quoteWorkflowId: string;
  let approvedStageId: string;

  beforeAll(async () => {
    test = await makeTestContext('owner');
    await documentWorkflowService.bootstrapDefaultWorkflows(test.ctx);
    await documentLineTypeService.bootstrapDefaultLineTypes(test.ctx);

    // The second site. Written through raw prisma the same way the fixture's
    // primary is, because `properties` is FORCE RLS.
    secondSiteId = await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(`SET LOCAL app.tenant_id = '${test.ctx.tenantId}'`);
      const row = await tx.property.create({
        data: {
          tenantId: test.ctx.tenantId,
          slug: 'second',
          name: 'The other shop',
          isPrimary: false,
        },
        select: { id: true },
      });
      return row.id;
    });

    const customer = await customerService.create(test.ctx, {
      type: 'retail',
      email: 'quote@site.test',
      firstName: 'Quote',
      lastName: 'Buyer',
    });
    customerId = customer.id;

    const workflows = await documentWorkflowService.list(test.ctx);
    const sr = workflows.find((w) => w.slug === 'service-repair');
    if (!sr) throw new Error('default workflows not seeded');
    quoteWorkflowId = sr.id;
    const approved = sr.stages.find((s) => s.stageType === 'committed');
    if (!approved) throw new Error('service-repair has no customer-approved stage');
    approvedStageId = approved.id;
  });

  afterAll(async () => {
    await disposeTestContext(test);
  });

  it('a quote turned into an order lands on the site the quote was written for', async () => {
    const quote = await billingDocumentService.create(test.ctx, {
      workflowId: quoteWorkflowId,
      customerId,
      propertyId: secondSiteId,
      taxRate: 0,
    });
    expect(quote.propertyId).toBe(secondSiteId);

    await billingLineService.addLine(test.ctx, quote.id, {
      lineTypeKey: 'fee',
      description: 'Two afternoons of alterations',
      quantity: 1,
      unitPrice: 120,
    });
    await billingDocumentStageService.advance(test.ctx, quote.id, { stageId: approvedStageId });

    const { order } = await billingDocumentConversionService.convertToOrder(test.ctx, quote.id);

    // Not `toBeTruthy()`: the primary site is also truthy, and reaching for it
    // would put this sale in the wrong shop's takings rather than in none.
    expect(order.propertyId).toBe(secondSiteId);
    expect(order.propertyId).not.toBe(test.propertyId);
  });

  it('the sale is then visible to a member who may only reach that site', async () => {
    const quote = await billingDocumentService.create(test.ctx, {
      workflowId: quoteWorkflowId,
      customerId,
      propertyId: secondSiteId,
      taxRate: 0,
    });
    await billingLineService.addLine(test.ctx, quote.id, {
      lineTypeKey: 'fee',
      description: 'A second alteration',
      quantity: 1,
      unitPrice: 40,
    });
    await billingDocumentStageService.advance(test.ctx, quote.id, { stageId: approvedStageId });
    const { order } = await billingDocumentConversionService.convertToOrder(test.ctx, quote.id);

    // The order list a restricted member reads is `propertyId IN (granted)`,
    // which no null-property row can satisfy. This is the consequence the
    // missing field actually had: an assistant given the shop that made the
    // sale could not see the sale. The query is written out rather than called
    // through the service so the test states the rule it is protecting.
    const reachable = await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(`SET LOCAL app.tenant_id = '${test.ctx.tenantId}'`);
      return tx.order.findMany({
        where: { propertyId: { in: [secondSiteId] } },
        select: { id: true },
      });
    });
    expect(reachable.map((row) => row.id)).toContain(order.id);
  });

  // The contract every other caller leans on, `orderService.create` itself.
  //
  // A subscription renewal is the one order nobody is present for: a worker
  // mints it months after the signup, from the subscription row alone, and
  // passes that row's site straight through. These two lock the behaviour it
  // depends on at both ends, because the plausible wrong version is not
  // "forgets the field" but "helpfully falls back to the primary site", and
  // that one would file a renewal against a shop that never took it.
  it('stores the site it is given, rather than the tenant primary', async () => {
    const order = await orderService.create(test.ctx, {
      customerId,
      propertyId: secondSiteId,
      items: [{ sku: 'SUB-1', name: 'A monthly box', quantity: 1, unitPrice: 29 }],
    });
    expect(order.propertyId).toBe(secondSiteId);
    expect(order.propertyId).not.toBe(test.propertyId);
  });

  it('stores no site when none is given, rather than guessing one', async () => {
    const order = await orderService.create(test.ctx, {
      customerId,
      items: [{ sku: 'SUB-2', name: 'A monthly box', quantity: 1, unitPrice: 29 }],
    });
    expect(order.propertyId).toBeNull();
  });
});
