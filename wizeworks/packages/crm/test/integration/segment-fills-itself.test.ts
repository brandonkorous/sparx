// A brand-new segment has to contain the people it says it contains.
//
// The evaluator was entirely CUSTOMER-driven: when one person changed, re-check
// that person against every segment. Creating a segment changes no person, so
// nothing ran — the rule builder counted "24 of 24 match" while the rules were
// being typed, the owner pressed Create, and the list said "No members yet"
// under a screen promising that "anyone who matches is added automatically".
// Most of the built-in segments sat at zero for the same reason.
//
// A SEGMENT-driven pass was added for it, and it was dead on arrival: the
// consumer subscribed on the platform bus, the service published on the CRM bus,
// and the bridge between them carried a hand-kept allowlist that named
// `crm.segment.*` as the long tail nothing consumes locally. The pass never ran
// once in production. The first version of THIS FILE is why nobody noticed — it
// called `recomputeFull` by hand and said so: "the subscription itself is one
// line, the arithmetic underneath it is what can be wrong." The one line was the
// wrong thing. So the first test now goes through the bus, exactly as pressing
// Create does, and would fail the moment the bridge stops carrying the event.

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { customerService, segmentService } from '../../src/services/index.js';
import {
  registerCrmConsumers,
  resetDedupeForTesting,
  resetPlatformBusForTesting,
  type PlatformEventBus,
} from '../../src/index.js';
import { prisma } from '@wizeworks/db';
import { disposeTestContext, makeTestContext, type TestContext } from '../helpers.js';

/** A second business under the same tenant — the case site scoping exists for. */
async function makeSecondSite(tenantId: string, name: string): Promise<string> {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`SET LOCAL app.tenant_id = '${tenantId}'`);
    const site = await tx.property.create({
      data: {
        tenantId,
        name,
        slug: `${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${Date.now().toString(36)}`,
        isPrimary: false,
      },
    });
    return site.id;
  });
}

/** Everyone with at least one order — a rule that is true of somebody and false
 *  of somebody else, so a wrong answer cannot pass by accident. */
const HAS_ORDERED = {
  kind: 'and' as const,
  children: [
    { kind: 'predicate' as const, field: 'customer.orderCount', op: 'gte' as const, value: 1 },
  ],
};

const EVERYONE = {
  kind: 'and' as const,
  children: [
    { kind: 'predicate' as const, field: 'customer.orderCount', op: 'gte' as const, value: 0 },
  ],
};

/** What the built-in "New Customers" group means, and what it could not say
 *  until `daysSinceCreated` existed: added recently, bought or not. */
const JOINED_RECENTLY = {
  kind: 'predicate' as const,
  field: 'customer.daysSinceCreated',
  op: 'lte' as const,
  value: 30,
};

describe('a segment fills itself', () => {
  let test: TestContext;
  let bus: PlatformEventBus;
  let teardown: () => void;

  beforeAll(async () => {
    // Order matters: makeTestContext installs the RecordingPublisher, then the
    // consumer bootstrap wraps THAT with the CRM→platform bridge. Registering
    // first would leave the bridge wrapping a publisher nothing publishes to.
    test = await makeTestContext('owner');
    bus = resetPlatformBusForTesting();
    resetDedupeForTesting();
    const registration = registerCrmConsumers({ bus });
    teardown = () => registration.unregister();

    await customerService.create(test.ctx, {
      firstName: 'Ines',
      lastName: 'Delacroix',
      email: 'ines@kestrel.io',
      propertyId: test.propertyId,
    });
    await customerService.create(test.ctx, {
      firstName: 'Tomas',
      lastName: 'Berg',
      email: 'tomas@kestrel.io',
      propertyId: test.propertyId,
    });
  });

  afterAll(async () => {
    teardown();
    await disposeTestContext(test);
  });

  it('has the people in it that the builder counted, without anyone touching a customer', async () => {
    const segment = await segmentService.create(test.ctx, {
      name: 'Everyone we know',
      slug: `everyone-${Date.now().toString(36)}`,
      kind: 'dynamic',
      rules: EVERYONE,
      propertyId: test.propertyId,
    });
    // Nothing else. `create` publishes, the bridge carries it, the consumer fills
    // the group — the whole path an owner pressing Create actually travels.
    await bus.drain();

    const count = await segmentService.memberCount(test.ctx, segment.id);
    const previewed = await segmentService.previewCount(test.ctx, {
      rule: EVERYONE,
      propertyId: test.propertyId,
    });

    // The number the owner was shown while building it is the number they get.
    expect(count).toBe(previewed.matches);
    expect(count).toBeGreaterThan(0);
  });

  // The preview and the membership have to be counting the same people. A
  // segment draws from one site plus the tenant-wide contacts; the preview used
  // to scan the whole tenant, so on a tenant running two businesses it promised
  // people who could never join — and quietly described the other business's
  // customers while doing it.
  it('previews only the people the segment could actually contain', async () => {
    const otherSite = await makeSecondSite(test.tenant.tenantId, 'Rivera Fabrication');
    await customerService.create(test.ctx, {
      firstName: 'Sofia',
      lastName: 'Rivera',
      email: 'sofia@riverafab.test',
      propertyId: otherSite,
    });

    const here = await segmentService.previewCount(test.ctx, {
      rule: EVERYONE,
      propertyId: test.propertyId,
    });
    const everywhere = await segmentService.previewCount(test.ctx, { rule: EVERYONE });

    // Sofia is on the other site: counted tenant-wide, never in this preview.
    expect(everywhere.total).toBe(here.total + 1);
  });

  it('drops the people who stop matching when the rules are narrowed', async () => {
    const segment = await segmentService.create(test.ctx, {
      name: 'Buyers',
      slug: `buyers-${Date.now().toString(36)}`,
      kind: 'dynamic',
      rules: EVERYONE,
      propertyId: test.propertyId,
    });
    await bus.drain();
    expect(await segmentService.memberCount(test.ctx, segment.id)).toBeGreaterThan(0);

    // Nobody in this tenant has ordered, so narrowing to buyers should empty it.
    // A segment that keeps members who no longer match is worse than one that
    // never filled: the list looks maintained and quietly is not.
    await segmentService.update(test.ctx, segment.id, { rules: HAS_ORDERED });
    await bus.drain();

    expect(await segmentService.memberCount(test.ctx, segment.id)).toBe(0);
  });

  // The other direction: the group exists and a person arrives. Only
  // `crm.customer.updated` was watched, so somebody freshly ADDED belonged to
  // nothing until an unrelated edit touched them — which is what an imported
  // mailing list is: twenty-five arrivals and no edits.
  it('takes in a person who is added after it, without anyone editing them', async () => {
    const segment = await segmentService.create(test.ctx, {
      name: 'Everyone, standing',
      slug: `standing-${Date.now().toString(36)}`,
      kind: 'dynamic',
      rules: EVERYONE,
      propertyId: test.propertyId,
    });
    await bus.drain();
    const before = await segmentService.memberCount(test.ctx, segment.id);

    await customerService.create(test.ctx, {
      firstName: 'Marguerite',
      lastName: 'Adeyemi',
      email: 'marguerite@kestrel.io',
      propertyId: test.propertyId,
    });
    await bus.drain();

    expect(await segmentService.memberCount(test.ctx, segment.id)).toBe(before + 1);
  });

  // "New Customers" has to mean the people who have just arrived, which is
  // what its description always said and what its rule never did: it read order
  // recency, so a shop that had imported its mailing list yesterday found the
  // two buyers in there and none of the twenty-three others.
  it('counts somebody who has just been added and never bought', async () => {
    const segment = await segmentService.create(test.ctx, {
      name: 'Just joined',
      slug: `just-joined-${Date.now().toString(36)}`,
      kind: 'dynamic',
      rules: JOINED_RECENTLY,
      propertyId: test.propertyId,
    });
    await bus.drain();

    const members = await segmentService.members(test.ctx, segment.id, { limit: 100 });
    const emails = members.map((m) => m.customer.email);

    expect(emails).toContain('ines@kestrel.io');
    // Nobody in this tenant has ordered, so an order-recency rule would find
    // none of them. That is the whole distinction.
    expect(await segmentService.memberCount(test.ctx, segment.id)).toBeGreaterThan(0);
  });

  // A WHOLE-TENANT recompute must not touch a hand-picked list.
  //
  // `recomputeFull()` with no segmentId re-cuts every group at once — the
  // nightly CronJob and the list's "Update all" button both call it that way.
  // A hand-picked list's membership is not derivable from rules, so if the
  // evaluator's `kind: 'dynamic'` filter ever slipped, every one of them would
  // be emptied nightly and nothing would error. Absence would look exactly like
  // correctness, which is why this is asserted rather than assumed.
  it('leaves a hand-picked list alone when every group is re-cut at once', async () => {
    const picked = await segmentService.create(test.ctx, {
      name: 'People Devi likes',
      slug: `picked-${Date.now().toString(36)}`,
      kind: 'static',
      // Rules a hand-picked list never consults. Nobody in this tenant has
      // ordered, so re-cutting on them would match nobody and remove everybody.
      rules: HAS_ORDERED,
      propertyId: test.propertyId,
    });

    const roster = await customerService.list(test.ctx, { propertyId: test.propertyId });
    await segmentService.addMembers(test.ctx, picked.id, {
      customerIds: roster.items.map((c) => c.id),
    });

    const before = await segmentService.memberCount(test.ctx, picked.id);
    expect(before).toBeGreaterThan(0);

    await segmentService.recomputeFull(test.ctx);

    expect(await segmentService.memberCount(test.ctx, picked.id)).toBe(before);
  });

  // Renaming is not a rule change, and paying for a full re-cut on one would be
  // the kind of cost nobody sees until a list is large. `rulesChanged: false`
  // carries that, and the consumer honours it.
  it('leaves the group alone when only the name changes', async () => {
    const segment = await segmentService.create(test.ctx, {
      name: 'Regulars',
      slug: `regulars-${Date.now().toString(36)}`,
      kind: 'dynamic',
      rules: EVERYONE,
      propertyId: test.propertyId,
    });
    await bus.drain();
    const before = await segmentService.memberCount(test.ctx, segment.id);

    await segmentService.update(test.ctx, segment.id, { name: 'The regulars' });
    await bus.drain();

    expect(await segmentService.memberCount(test.ctx, segment.id)).toBe(before);
  });
});
