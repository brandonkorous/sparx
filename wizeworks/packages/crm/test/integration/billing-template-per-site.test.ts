// A letterhead belongs to ONE business (issue 777).
//
// `billing_document_templates` has had a `property_id` since
// `20261221000000_billing_documents_per_site`, and the service read it nowhere:
// every list was tenant-wide, every default was tenant-wide, and the migration's
// attempt to lift the tenant-wide UNIQUE misspelled the index name, so the
// database refused a second default anyway. A tenant running two unrelated
// businesses printed both their invoices on one business's paper.
//
// These are the assertions that could not have passed before, in order:
//
//   (1) the lazy seed lands in the SHARED tier, once for the whole account —
//       not once per site, each claiming to be a default;
//   (2) a site's own default and the shared default COEXIST. This is the one
//       the leftover index made impossible, and it fails until
//       `20270515000000_a_letterhead_belongs_to_one_business` is applied;
//   (3) a list scoped to a site shows that site's letterheads plus the shared
//       ones, and NEVER another business's;
//   (4) the render read resolves the document's OWN site first, then the shared
//       one — and a site whose own default is unpublished gets the built-in
//       renderer rather than the other business's paper;
//   (5) promoting a letterhead inside one business leaves every other business's
//       default exactly where it was.

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '@wizeworks/db';

import { billingTemplateService } from '../../src/services/index.js';
import { disposeTestContext, makeTestContext, type TestContext } from '../helpers.js';

/** A second site on the same account — the trade counter beside the studio.
 *  `properties` is FORCE RLS, so this goes through a tenant-scoped exec exactly
 *  as the fixture's own primary site does. */
async function addSite(tenantId: string, slug: string, name: string): Promise<string> {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`SET LOCAL app.tenant_id = '${tenantId}'`);
    const row = await tx.property.create({
      data: { tenantId, slug, name, isPrimary: false },
      select: { id: true },
    });
    return row.id;
  });
}

describe('print templates belong to one business', () => {
  let test: TestContext;
  let studio: string;
  let trade: string;

  beforeAll(async () => {
    test = await makeTestContext('owner');
    studio = test.propertyId;
    trade = await addSite(test.tenant.tenantId, 'trade', 'Trade counter');
  });

  afterAll(async () => {
    await disposeTestContext(test);
  });

  beforeEach(() => {
    test.publisher.clear();
  });

  it('seeds one shared letterhead for the whole account, not one per site', async () => {
    const fromStudio = await billingTemplateService.listOrSeed(test.ctx, { propertyId: studio });
    expect(fromStudio).toHaveLength(1);
    expect(fromStudio[0]!.propertyId).toBeNull();
    expect(fromStudio[0]!.propertyName).toBeNull();
    expect(fromStudio[0]!.isDefault).toBe(true);

    // Opening the second business must not mint a second "Default". Seven sites
    // would otherwise produce seven, every one of them claiming to be in force.
    const fromTrade = await billingTemplateService.listOrSeed(test.ctx, { propertyId: trade });
    expect(fromTrade).toHaveLength(1);
    expect(fromTrade[0]!.id).toBe(fromStudio[0]!.id);
  });

  it('gives a business its own default without standing down the shared one', async () => {
    const shared = (await billingTemplateService.listOrSeed(test.ctx)).find((t) => t.isDefault)!;

    // First letterhead in the trade tier — default for that business by virtue
    // of being the only one there.
    const tradeLetterhead = await billingTemplateService.create(test.ctx, {
      name: 'Trade counter letterhead',
      propertyId: trade,
    });
    expect(tradeLetterhead.isDefault).toBe(true);
    expect(tradeLetterhead.propertyId).toBe(trade);
    expect(tradeLetterhead.propertyName).toBe('Trade counter');

    // TWO defaults at once, which the tenant-wide UNIQUE index made impossible.
    const sharedAfter = await billingTemplateService.get(test.ctx, shared.id);
    expect(sharedAfter.isDefault).toBe(true);

    const everywhere = await billingTemplateService.listOrSeed(test.ctx);
    expect(everywhere.filter((t) => t.isDefault)).toHaveLength(2);
  });

  it('shows a business its own letterheads and the shared ones, never another business’s', async () => {
    const fromTrade = await billingTemplateService.listOrSeed(test.ctx, { propertyId: trade });
    // Its own letterhead plus the shared one, in whichever order the list comes
    // back. Compared as a SET on purpose: Array.sort() stringifies, a uuid is
    // hex, and every hex string sorts before the word "null", so sorting these
    // two can never put the shared row first.
    expect(new Set(fromTrade.map((t) => t.propertyId))).toEqual(new Set([null, trade]));
    expect(fromTrade).toHaveLength(2);

    // The studio has none of its own yet, so it sees only the shared one — and
    // in particular not the trade counter's.
    const fromStudio = await billingTemplateService.listOrSeed(test.ctx, { propertyId: studio });
    expect(fromStudio).toHaveLength(1);
    expect(fromStudio[0]!.propertyId).toBeNull();
    expect(fromStudio.some((t) => t.propertyId === trade)).toBe(false);
  });

  it("prints a document on its own business's paper, falling back to the shared one", async () => {
    const all = await billingTemplateService.listOrSeed(test.ctx);
    const shared = all.find((t) => t.propertyId === null)!;
    const tradeLetterhead = all.find((t) => t.propertyId === trade)!;

    // Nothing is published yet: the built-in code renderer is in force for both.
    expect(await billingTemplateService.getActivePublishedTree(test.ctx, studio)).toBeNull();
    expect(await billingTemplateService.getActivePublishedTree(test.ctx, trade)).toBeNull();

    await billingTemplateService.publish(test.ctx, shared.id);

    // The studio has no letterhead of its own, so it wears the shared one.
    const studioTree = await billingTemplateService.getActivePublishedTree(test.ctx, studio);
    expect(studioTree?.name).toBe(shared.name);

    // The trade counter HAS one of its own and it is not published. The answer
    // is the built-in renderer, NOT the studio's paper: falling through here is
    // precisely how the wrong business's name reaches a demand for money.
    expect(await billingTemplateService.getActivePublishedTree(test.ctx, trade)).toBeNull();

    await billingTemplateService.publish(test.ctx, tradeLetterhead.id);
    const tradeTree = await billingTemplateService.getActivePublishedTree(test.ctx, trade);
    expect(tradeTree?.name).toBe('Trade counter letterhead');

    // And the studio is unmoved by any of it.
    const studioAgain = await billingTemplateService.getActivePublishedTree(test.ctx, studio);
    expect(studioAgain?.name).toBe(shared.name);
  });

  it('promotes within one business without touching another', async () => {
    const second = await billingTemplateService.create(test.ctx, {
      name: 'Trade counter, seasonal',
      propertyId: trade,
    });
    expect(second.isDefault).toBe(false);

    const promoted = await billingTemplateService.setDefault(test.ctx, second.id);
    expect(promoted.isDefault).toBe(true);

    const inTrade = (
      await billingTemplateService.listOrSeed(test.ctx, { propertyId: trade })
    ).filter((t) => t.propertyId === trade && t.isDefault);
    expect(inTrade).toHaveLength(1);
    expect(inTrade[0]!.id).toBe(second.id);

    // The shared default is still the shared default.
    const shared = (await billingTemplateService.listOrSeed(test.ctx)).find(
      (t) => t.propertyId === null
    )!;
    expect(shared.isDefault).toBe(true);
  });

  it('moves a letterhead to another business and stands down what was there', async () => {
    const spare = await billingTemplateService.create(test.ctx, {
      name: 'Studio letterhead',
      propertyId: studio,
    });
    expect(spare.isDefault).toBe(true);

    // Moving the studio's default onto the trade counter takes the trade
    // counter's default with it, rather than colliding on the unique index.
    const moved = await billingTemplateService.update(test.ctx, spare.id, { propertyId: trade });
    expect(moved.propertyId).toBe(trade);
    expect(moved.propertyName).toBe('Trade counter');

    const inTrade = (
      await billingTemplateService.listOrSeed(test.ctx, { propertyId: trade })
    ).filter((t) => t.propertyId === trade && t.isDefault);
    expect(inTrade).toHaveLength(1);
    expect(inTrade[0]!.id).toBe(spare.id);

    // The studio is left with none of its own, which is honest: it falls back to
    // the shared letterhead until someone picks one.
    const inStudio = (
      await billingTemplateService.listOrSeed(test.ctx, { propertyId: studio })
    ).filter((t) => t.propertyId === studio);
    expect(inStudio).toHaveLength(0);
  });
});
