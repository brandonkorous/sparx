// An order is found by the name of the trade account it belongs to.
//
// MEASURED 2026-10-04 on Gillett Diesel Service: typing "Wasatch" found Wasatch
// Front Utility Contractors, LLC, its invoices, quotes and contacts, and none of
// its orders. The order's search document now carries the account's name.
//
// These run against real Postgres: they write the rows a quote, an invoice and a
// checkout write, and build the document the indexer would send, so the
// relations the projection reads are the real ones.

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import crypto from 'node:crypto';
import { prisma, withTenant } from '@wizeworks/db';
import {
  listOrderIdsForAccount,
  listOrderIdsForBillingDocument,
  projectCustomer,
  projectOrder,
} from '@wizeworks/commerce';

const WASATCH = 'Wasatch Front Utility Contractors, LLC';
const RED_ROCK = 'Red Rock Hotshot Trucking';

let tenantId = '';
const acct = { wasatch: '', redRock: '', closed: '' };
const ord = { plain: '', quoted: '', invoiced: '', closedQuote: '', walkIn: '', retail: '' };
let reneeId = '';
const docs = { quote: '', invoice: '', loose: '' };

async function companyOf(orderId: string) {
  const { document } = await projectOrder({ tenantId }, orderId);
  return { company: document?.company, account: document?.b2b_account_id };
}

beforeAll(async () => {
  const slug = `ordacct-${crypto.randomBytes(4).toString('hex')}`;
  const tenant = await prisma.tenant.create({
    data: {
      slug,
      name: `Order accounts ${slug}`,
      email: `${slug}@sparx.test`,
      plan: 'starter',
      status: 'active',
      settings: {},
    },
  });
  tenantId = tenant.id;

  await withTenant({ tenantId }, async (tx) => {
    const account = (companyName: string, deletedAt: Date | null = null) =>
      tx.company.create({ data: { tenantId, companyName, deletedAt }, select: { id: true } });
    acct.wasatch = (await account(WASATCH)).id;
    acct.redRock = (await account(RED_ROCK)).id;
    acct.closed = (await account('Closed Down Haulage', new Date())).id;

    const person = (firstName: string, extra: { companyId?: string; companyName?: string } = {}) =>
      tx.customer.create({
        data: {
          tenantId,
          firstName,
          lastName: 'Buyer',
          email: `${firstName}@example.test`,
          ...extra,
        },
        select: { id: true },
      });
    // Priced by Wasatch today.
    const renee = (await person('Renee', { companyId: acct.wasatch })).id;
    reneeId = renee;
    const walkIn = (await person('Walk', { companyName: 'Sole Trader' })).id;
    const retail = (await person('Retail')).id;

    const site = await tx.property.create({
      data: { tenantId, slug: 'main', name: 'Main' },
      select: { id: true },
    });
    const workflow = await tx.documentWorkflow.create({
      data: { tenantId, name: 'Quotes', slug: 'quotes' },
      select: { id: true },
    });
    const stage = await tx.documentStage.create({
      data: {
        tenantId,
        workflowId: workflow.id,
        name: 'Draft',
        customerLabel: 'Draft',
        sortOrder: 0,
      },
      select: { id: true },
    });
    const document = (companyId: string) =>
      tx.billingDocument.create({
        data: {
          tenantId,
          propertyId: site.id,
          workflowId: workflow.id,
          stageId: stage.id,
          customerId: renee,
          companyId,
        },
        select: { id: true },
      });

    let n = 0;
    const placed = async (customerId: string, convertedFromDocumentId?: string) =>
      (
        await tx.order.create({
          data: {
            tenantId,
            customerId,
            orderNumber: `O-${String(++n).padStart(6, '0')}`,
            placedAt: new Date(),
            ...(convertedFromDocumentId ? { convertedFromDocumentId } : {}),
          },
          select: { id: true },
        })
      ).id;

    ord.plain = await placed(renee);
    // Quoted to Red Rock before Renée was priced by Wasatch.
    docs.quote = (await document(acct.redRock)).id;
    ord.quoted = await placed(renee, docs.quote);
    // Invoiced to Red Rock, never quoted.
    ord.invoiced = await placed(renee);
    docs.invoice = (await document(acct.redRock)).id;
    await tx.billingDocument.update({
      where: { id: docs.invoice },
      data: { orderId: ord.invoiced },
    });
    // A quote nobody has turned into an order yet.
    docs.loose = (await document(acct.wasatch)).id;
    // Quoted to an account that has since been removed.
    ord.closedQuote = await placed(renee, (await document(acct.closed)).id);
    ord.walkIn = await placed(walkIn);
    ord.retail = await placed(retail);
  });
});

afterAll(async () => {
  if (tenantId) {
    // Orders hold their buyers and documents hold their site, both RESTRICT, so
    // they go first.
    await withTenant({ tenantId }, async (tx) => {
      await tx.order.deleteMany({});
      await tx.billingDocument.deleteMany({});
    });
    await prisma.tenant.delete({ where: { id: tenantId } });
  }
  await prisma.$disconnect();
});

describe('the account an order is found by', () => {
  it('is the buyer’s pricing account when nothing else is on record', async () => {
    expect(await companyOf(ord.plain)).toEqual({ company: WASATCH, account: acct.wasatch });
  });

  it('is the account it was quoted to', async () => {
    expect(await companyOf(ord.quoted)).toEqual({ company: RED_ROCK, account: acct.redRock });
  });

  it('is the account it was invoiced to', async () => {
    expect(await companyOf(ord.invoiced)).toEqual({ company: RED_ROCK, account: acct.redRock });
  });

  it('names no account that was removed', async () => {
    expect(await companyOf(ord.closedQuote)).toEqual({ company: undefined, account: acct.closed });
  });

  it('is the typed employer for a buyer on no account', async () => {
    expect(await companyOf(ord.walkIn)).toEqual({ company: 'Sole Trader', account: undefined });
  });

  it('is absent for a retail buyer', async () => {
    expect(await companyOf(ord.retail)).toEqual({ company: undefined, account: undefined });
  });
});

describe('the orders an account change re-reads', () => {
  it('is every order quoted to, invoiced to, or bought by somebody priced by it', async () => {
    const wasatch = await listOrderIdsForAccount({ tenantId }, acct.wasatch);
    expect([...wasatch].sort()).toEqual(
      [ord.plain, ord.quoted, ord.invoiced, ord.closedQuote].sort()
    );
    const redRock = await listOrderIdsForAccount({ tenantId }, acct.redRock);
    expect([...redRock].sort()).toEqual([ord.quoted, ord.invoiced].sort());
  });
});

describe('a buyer priced by an account and on none of its lists', () => {
  // The Prisma client's computed `customer.company` (the typed employer) shadows
  // the relation, so a projection that JOINED the pricing account read nothing
  // and found this buyer by the account's name only through a contact row.
  it('is found by that account’s name', async () => {
    const { document } = await projectCustomer({ tenantId }, reneeId);
    expect(document?.company).toBe(WASATCH);
  });
});

describe('the orders a quote or invoice change re-reads', () => {
  it('is the order a quote became', async () => {
    expect(await listOrderIdsForBillingDocument({ tenantId }, docs.quote)).toEqual([ord.quoted]);
  });

  it('is the order an invoice bills', async () => {
    expect(await listOrderIdsForBillingDocument({ tenantId }, docs.invoice)).toEqual([
      ord.invoiced,
    ]);
  });

  it('is nothing for a document on no order', async () => {
    expect(await listOrderIdsForBillingDocument({ tenantId }, docs.loose)).toEqual([]);
  });
});
