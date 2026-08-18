// A brand-new segment has to contain the people it says it contains.
//
// The evaluator was entirely CUSTOMER-driven: when one person changed, re-check
// that person against every segment. Creating a segment changes no person, so
// nothing ran — the rule builder counted "24 of 24 match" while the rules were
// being typed, the owner pressed Create, and the list said "No members yet"
// under a screen promising that "anyone who matches is added automatically".
// Most of the built-in segments sat at zero for the same reason.
//
// These tests cover the SEGMENT-driven direction: cut one segment across every
// customer, on create and on a rule change.

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { customerService, segmentService } from '../../src/services/index.js';
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

describe('a segment fills itself', () => {
  let test: TestContext;

  beforeAll(async () => {
    test = await makeTestContext('owner');
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
    await disposeTestContext(test);
  });

  it('has the people in it that the builder counted, without waiting for them to change', async () => {
    const segment = await segmentService.create(test.ctx, {
      name: 'Everyone we know',
      slug: `everyone-${Date.now().toString(36)}`,
      kind: 'dynamic',
      rules: EVERYONE,
      propertyId: test.propertyId,
    });

    // What the consumer does on `crm.segment.created`. Called directly because
    // the bus is not running in an integration test — the subscription itself is
    // one line, the arithmetic underneath it is what can be wrong.
    await segmentService.recomputeFull(test.ctx, { segmentId: segment.id });

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
    await segmentService.recomputeFull(test.ctx, { segmentId: segment.id });
    expect(await segmentService.memberCount(test.ctx, segment.id)).toBeGreaterThan(0);

    // Nobody in this tenant has ordered, so narrowing to buyers should empty it.
    // A segment that keeps members who no longer match is worse than one that
    // never filled: the list looks maintained and quietly is not.
    await segmentService.update(test.ctx, segment.id, { rules: HAS_ORDERED });
    await segmentService.recomputeFull(test.ctx, { segmentId: segment.id });

    expect(await segmentService.memberCount(test.ctx, segment.id)).toBe(0);
  });
});
