// associationService — the relationship graph (docs/144 §6).
//
// The commitments here are the ones that make associations safe to add to a
// platform that already has foreign keys everywhere, and none of them are
// visible from a function signature:
//
//   • THE LEGACY COLUMN STAYS CORRECT. `deals.customer_id` is read by the order
//     consumer, the segment projection, four reports and the storefront. Making
//     an association primary WRITES that column; removing the primary CLEARS it
//     or hands it to a successor. Drift between the two is the failure this
//     whole design exists to prevent, so most of this file is about it.
//   • LINKS READ FROM BOTH ENDS, with the label flipped to its inverse — one
//     row, two readings.
//   • Creating a deal RECORDS the relationship its FK already implies, so the
//     graph is not blank for every deal made before someone opened the panel.
//   • Merging two customers MOVES their relationships, collapsing duplicates.

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { prisma } from '@sparx/db';
import {
  associationService,
  b2bAccountService,
  customerService,
  dealService,
  pipelineService,
} from '../../src/services/index.js';
import { disposeTestContext, makeTestContext, type TestContext } from '../helpers.js';

/** Read a deal's legacy FK columns straight from the row, under the tenant. */
async function dealColumns(
  tenantId: string,
  dealId: string
): Promise<{ customerId: string | null; b2bAccountId: string | null }> {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`SET LOCAL app.tenant_id = '${tenantId}'`);
    const row = await tx.deal.findUniqueOrThrow({
      where: { id: dealId },
      select: { customerId: true, b2bAccountId: true },
    });
    return row;
  });
}

describe('associationService', () => {
  let test: TestContext;
  let dealId: string;
  let signerId: string;
  let userId: string;
  let payerId: string;

  beforeAll(async () => {
    test = await makeTestContext('owner');
    await associationService.ensureBuiltinLabels(test.ctx);

    const pipeline = await pipelineService.bootstrapDefaultPipeline(test.ctx);
    const stageId = pipeline.stages[0]!.id;

    const people = await Promise.all(
      [
        { firstName: 'Rae', lastName: 'Sandoval', email: 'rae@northwind.test' },
        { firstName: 'Tom', lastName: 'Beckett', email: 'tom@northwind.test' },
        { firstName: 'Ada', lastName: 'Quill', email: 'ada@northwind.test' },
      ].map((person) => customerService.create(test.ctx, { type: 'b2b', ...person }))
    );
    signerId = people[0]!.id;
    userId = people[1]!.id;
    payerId = people[2]!.id;

    const deal = await dealService.create(test.ctx, {
      pipelineId: pipeline.id,
      stageId,
      title: 'Northwind — fleet rollout',
      customerId: signerId,
      value: 48_000,
    });
    dealId = deal.id;
  });

  afterAll(async () => {
    await disposeTestContext(test);
  });

  beforeEach(() => {
    test.publisher.clear();
  });

  it('creating a deal records the relationship its customer column already implies', async () => {
    // Without this the graph would be right for deals made through the panel and
    // blank for every one made by the order consumer, an import or a form.
    const links = await associationService.listFor(test.ctx, {
      objectKey: 'deal',
      recordId: dealId,
    });
    expect(links).toHaveLength(1);
    expect(links[0]?.isPrimary).toBe(true);
    expect(links[0]?.other?.recordId).toBe(signerId);
    expect(links[0]?.other?.title).toBe('Rae Sandoval');
  });

  it('relates more people to one deal — the case a single column cannot hold', async () => {
    await associationService.create(test.ctx, {
      fromType: 'deal',
      fromId: dealId,
      toType: 'contact',
      toId: userId,
      labelKey: 'end_user',
    });
    await associationService.create(test.ctx, {
      fromType: 'deal',
      fromId: dealId,
      toType: 'contact',
      toId: payerId,
      labelKey: 'billing_contact',
    });

    const links = await associationService.listFor(test.ctx, {
      objectKey: 'deal',
      recordId: dealId,
    });
    expect(links).toHaveLength(3);
    expect(links.map((link) => link.other?.title).sort()).toEqual([
      'Ada Quill',
      'Rae Sandoval',
      'Tom Beckett',
    ]);
    expect(test.publisher.events.map((event) => event.topic)).toContain('crm.association.added');
  });

  it('reads the same link from the other end, worded the other way round', async () => {
    const fromContact = await associationService.listFor(test.ctx, {
      objectKey: 'contact',
      recordId: payerId,
    });
    expect(fromContact).toHaveLength(1);
    expect(fromContact[0]?.reversed).toBe(true);
    // "Handles the invoice" from the deal; from the person it is the deals they
    // handle the invoice for.
    expect(fromContact[0]?.label).toBe('Deals they handle the invoice for');
    expect(fromContact[0]?.other?.title).toBe('Northwind — fleet rollout');
  });

  it('the same two records can be linked twice under different labels', async () => {
    // Someone who both decides and pays is genuinely two relationships.
    await associationService.create(test.ctx, {
      fromType: 'deal',
      fromId: dealId,
      toType: 'contact',
      toId: payerId,
      labelKey: 'decision_maker',
    });
    const links = await associationService.listFor(test.ctx, {
      objectKey: 'deal',
      recordId: dealId,
      labelKey: 'decision_maker',
    });
    expect(links).toHaveLength(1);
  });

  it('refuses the same pair under the SAME label, in words a person can act on', async () => {
    await expect(
      associationService.create(test.ctx, {
        fromType: 'deal',
        fromId: dealId,
        toType: 'contact',
        toId: payerId,
        labelKey: 'decision_maker',
      })
    ).rejects.toThrow(/already linked/i);
  });

  it('refuses a link to a record that does not exist', async () => {
    await expect(
      associationService.create(test.ctx, {
        fromType: 'deal',
        fromId: dealId,
        toType: 'contact',
        toId: '00000000-0000-4000-8000-000000000000',
      })
    ).rejects.toThrow();
  });

  it('refuses a relationship type the business has not set up', async () => {
    await expect(
      associationService.create(test.ctx, {
        fromType: 'deal',
        fromId: dealId,
        toType: 'contact',
        toId: userId,
        labelKey: 'chief_wizard',
      })
    ).rejects.toThrow(/not one you have set up/i);
  });

  it('making one primary REWRITES the deal customer column and demotes the old one', async () => {
    const links = await associationService.listFor(test.ctx, {
      objectKey: 'deal',
      recordId: dealId,
      toType: 'contact',
    });
    const endUser = links.find((link) => link.labelKey === 'end_user')!;

    await associationService.makePrimary(test.ctx, endUser.id);

    // The whole point: the graph and the column cannot disagree.
    const columns = await dealColumns(test.ctx.tenantId, dealId);
    expect(columns.customerId).toBe(userId);

    const after = await associationService.listFor(test.ctx, {
      objectKey: 'deal',
      recordId: dealId,
      toType: 'contact',
    });
    expect(after.filter((link) => link.isPrimary)).toHaveLength(1);
    expect(after.find((link) => link.isPrimary)?.other?.recordId).toBe(userId);
  });

  it('removing the primary hands the column to a successor rather than orphaning it', async () => {
    const links = await associationService.listFor(test.ctx, {
      objectKey: 'deal',
      recordId: dealId,
      toType: 'contact',
    });
    const primary = links.find((link) => link.isPrimary)!;

    await associationService.remove(test.ctx, primary.id);

    const columns = await dealColumns(test.ctx.tenantId, dealId);
    // Not null, and not the removed one: a deal that still has contacts should
    // still name one.
    expect(columns.customerId).not.toBeNull();
    expect(columns.customerId).not.toBe(userId);

    const after = await associationService.listFor(test.ctx, {
      objectKey: 'deal',
      recordId: dealId,
      toType: 'contact',
    });
    expect(after.find((link) => link.isPrimary)?.other?.recordId).toBe(columns.customerId);
  });

  it('removing the LAST one clears the column rather than leaving it pointing nowhere', async () => {
    const solo = await customerService.create(test.ctx, {
      type: 'retail',
      email: 'solo@northwind.test',
    });
    const pipeline = await pipelineService.bootstrapDefaultPipeline(test.ctx);
    const deal = await dealService.create(test.ctx, {
      pipelineId: pipeline.id,
      stageId: pipeline.stages[0]!.id,
      title: 'One-contact deal',
      customerId: solo.id,
    });

    const links = await associationService.listFor(test.ctx, {
      objectKey: 'deal',
      recordId: deal.id,
    });
    await associationService.remove(test.ctx, links[0]!.id);

    const columns = await dealColumns(test.ctx.tenantId, deal.id);
    expect(columns.customerId).toBeNull();
  });

  it('repointing the deal customer column moves the primary with it', async () => {
    const pipeline = await pipelineService.bootstrapDefaultPipeline(test.ctx);
    const deal = await dealService.create(test.ctx, {
      pipelineId: pipeline.id,
      stageId: pipeline.stages[0]!.id,
      title: 'Repointed deal',
      customerId: signerId,
    });

    await dealService.update(test.ctx, deal.id, { customerId: payerId });

    const links = await associationService.listFor(test.ctx, {
      objectKey: 'deal',
      recordId: deal.id,
      toType: 'contact',
    });
    const primary = links.find((link) => link.isPrimary);
    expect(primary?.other?.recordId).toBe(payerId);
  });

  it('links a company to a deal and mirrors onto its own column', async () => {
    const account = await b2bAccountService.create(test.ctx, { companyName: 'Northwind Ltd' });
    const pipeline = await pipelineService.bootstrapDefaultPipeline(test.ctx);
    const deal = await dealService.create(test.ctx, {
      pipelineId: pipeline.id,
      stageId: pipeline.stages[0]!.id,
      title: 'Company deal',
    });

    const link = await associationService.create(test.ctx, {
      fromType: 'deal',
      fromId: deal.id,
      toType: 'company',
      toId: account.id,
      isPrimary: true,
    });
    expect(link.isPrimary).toBe(true);

    const columns = await dealColumns(test.ctx.tenantId, deal.id);
    expect(columns.b2bAccountId).toBe(account.id);
  });

  it('refuses to relate a record to itself', async () => {
    await expect(
      associationService.create(test.ctx, {
        fromType: 'contact',
        fromId: signerId,
        toType: 'contact',
        toId: signerId,
      })
    ).rejects.toThrow();
  });
});

describe('association labels', () => {
  let test: TestContext;

  beforeAll(async () => {
    test = await makeTestContext('owner');
  });

  afterAll(async () => {
    await disposeTestContext(test);
  });

  it('listLabels seeds the relationships sparx ships, for a tenant that never saw activation', async () => {
    const labels = await associationService.listLabels(test.ctx);
    expect(labels.length).toBeGreaterThan(0);
    const signs = labels.find(
      (label) =>
        label.fromType === 'deal' && label.toType === 'contact' && label.key === 'decision_maker'
    );
    // Plain words, both directions.
    expect(signs?.label).toBe('Signs it off');
    expect(signs?.inverseLabel).toBe('Deals they sign off');
  });

  it('re-seeding never undoes a rename', async () => {
    const labels = await associationService.listLabels(test.ctx, { fromType: 'company' });
    const employee = labels.find((label) => label.key === 'employee')!;
    await associationService.updateLabel(test.ctx, employee.id, { label: 'On the team' });

    await associationService.ensureBuiltinLabels(test.ctx);

    const after = await associationService.listLabels(test.ctx, { fromType: 'company' });
    expect(after.find((label) => label.key === 'employee')?.label).toBe('On the team');
  });

  it('deleting a relationship type keeps the LINKS, unlabelled', async () => {
    const person = await customerService.create(test.ctx, {
      type: 'retail',
      email: 'lin@labels.test',
    });
    const account = await b2bAccountService.create(test.ctx, { companyName: 'Labels Ltd' });

    await associationService.create(test.ctx, {
      fromType: 'company',
      fromId: account.id,
      toType: 'contact',
      toId: person.id,
      labelKey: 'employee',
    });

    const labels = await associationService.listLabels(test.ctx, { fromType: 'company' });
    const employee = labels.find((label) => label.key === 'employee')!;
    const unlabelled = await associationService.deleteLabel(test.ctx, employee.id);
    expect(unlabelled).toBe(1);

    // The fact that they are related survives; only the word for it went.
    const links = await associationService.listFor(test.ctx, {
      objectKey: 'company',
      recordId: account.id,
    });
    expect(links).toHaveLength(1);
    expect(links[0]?.labelKey).toBeNull();
    expect(links[0]?.label).toBe('Related');
  });
});

describe('merging customers moves their relationships', () => {
  let test: TestContext;

  beforeAll(async () => {
    test = await makeTestContext('owner');
    await associationService.ensureBuiltinLabels(test.ctx);
  });

  afterAll(async () => {
    await disposeTestContext(test);
  });

  it('moves links off the duplicate, and collapses one the primary already had', async () => {
    const keep = await customerService.create(test.ctx, {
      type: 'retail',
      email: 'dave@kelly.test',
      firstName: 'Dave',
      lastName: 'Kelly',
    });
    const dupe = await customerService.create(test.ctx, {
      type: 'retail',
      email: 'd.kelly@kelly.test',
      firstName: 'Dave',
      lastName: 'Kelly',
    });
    const employer = await b2bAccountService.create(test.ctx, { companyName: 'Kelly Plant Hire' });
    const other = await b2bAccountService.create(test.ctx, { companyName: 'Second Job Ltd' });

    // Both are linked to the same employer — exactly how a duplicate gets
    // noticed — plus the duplicate has one the primary does not.
    await associationService.create(test.ctx, {
      fromType: 'company',
      fromId: employer.id,
      toType: 'contact',
      toId: keep.id,
      labelKey: 'employee',
    });
    await associationService.create(test.ctx, {
      fromType: 'company',
      fromId: employer.id,
      toType: 'contact',
      toId: dupe.id,
      labelKey: 'employee',
    });
    await associationService.create(test.ctx, {
      fromType: 'company',
      fromId: other.id,
      toType: 'contact',
      toId: dupe.id,
      labelKey: 'employee',
    });

    await customerService.merge(test.ctx, {
      primaryCustomerId: keep.id,
      duplicateCustomerIds: [dupe.id],
    });

    const links = await associationService.listFor(test.ctx, {
      objectKey: 'contact',
      recordId: keep.id,
    });
    // Two, not three: the duplicated employer link collapsed rather than
    // becoming a second copy of the same fact.
    expect(links).toHaveLength(2);
    expect(links.map((link) => link.other?.title).sort()).toEqual([
      'Kelly Plant Hire',
      'Second Job Ltd',
    ]);

    const orphaned = await associationService.listFor(test.ctx, {
      objectKey: 'contact',
      recordId: dupe.id,
    });
    expect(orphaned).toHaveLength(0);
  });
});
