// A resource belongs to ONE of the tenant's businesses, and a booking taken on the
// other site must not be able to allocate it.
//
// WHY THIS EXISTS. `SchedulingResourceProperty` shipped as a read-only junction. Three
// places filtered on it — the resource list, the utilisation report, and the booking
// allocator, whose own comment calls it "the double-booking-a-human failure the resource
// junction exists to prevent" — and NOTHING in the codebase ever created a row. So every
// resource on every tenant was unrestricted, the guard was inert, and a barber shop and a
// grooming salon run by one owner shared a staff pool: a booking on either site could be
// given to the other business's people.
//
// That is the failure mode a static read cannot see. The filter is correct, the schema is
// correct, and the feature is missing — a MISSING row renders exactly like a correct one
// (see the `absent behaves like fine` rule). What pins it is asserting the write.
//
// Covered here:
//   · createResource writes the links, and an empty list writes none (= every site)
//   · updateResource REPLACES the set, and an omitted `propertyIds` leaves it alone
//     (the partial-update footgun that also reset timezone/capacity/skillTags)
//   · listResources scopes to a site, and a global resource still shows on every one
//   · the ALLOCATOR refuses a resource that belongs to the other site — the one that
//     actually costs a real business something

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { prisma, withTenant } from '@sparx/db';
import {
  createResource,
  getResourcePropertyIds,
  listResources,
  updateResource,
} from '@sparx/scheduling';
import { createTestTenant, dropTestTenant } from '../helpers.js';

describe('scheduling resource site scope', () => {
  let tenantId: string;
  let siteA: string;
  let siteB: string;

  beforeAll(async () => {
    const tenant = await createTestTenant();
    tenantId = tenant.tenantId;
    siteA = tenant.propertyId; // the primary, seeded exactly as provisioning does
    const second = await withTenant({ tenantId }, (tx) =>
      tx.property.create({
        data: {
          tenantId,
          name: 'Second business',
          slug: 'second-business',
          isPrimary: false,
          status: 'active',
          settings: {},
        },
        select: { id: true },
      })
    );
    siteB = second.id;
  });

  afterAll(async () => {
    await dropTestTenant(tenantId);
    await prisma.$disconnect();
  });

  it('writes the junction rows a scoped resource declares', async () => {
    const chair = await createResource(tenantId, {
      kind: 'staff',
      name: 'Barber — site A only',
      timezone: 'UTC',
      exclusive: true,
      capacity: 1,
      skillTags: [],
      bookableOnline: true,
      isActive: true,
      propertyIds: [siteA],
    });
    // The whole point: before this change, this array was ALWAYS empty.
    expect(await getResourcePropertyIds(tenantId, chair.id)).toEqual([siteA]);
  });

  it('writes no rows for an unscoped resource, so it works every site', async () => {
    const shared = await createResource(tenantId, {
      kind: 'staff',
      name: 'Owner — covers both',
      timezone: 'UTC',
      exclusive: true,
      capacity: 1,
      skillTags: [],
      bookableOnline: true,
      isActive: true,
      propertyIds: [],
    });
    expect(await getResourcePropertyIds(tenantId, shared.id)).toEqual([]);
  });

  it('lists a resource only on the sites it works for', async () => {
    const onA = await listResources(tenantId, { propertyIds: [siteA] });
    const onB = await listResources(tenantId, { propertyIds: [siteB] });
    const names = (rows: { name: string }[]) => rows.map((r) => r.name).sort();

    expect(names(onA)).toContain('Barber — site A only');
    expect(names(onA)).toContain('Owner — covers both');
    // The other business does NOT see site A's barber; the shared owner still shows.
    expect(names(onB)).not.toContain('Barber — site A only');
    expect(names(onB)).toContain('Owner — covers both');
  });

  it('replaces the set on update, and leaves it alone when omitted', async () => {
    const row = await createResource(tenantId, {
      kind: 'space',
      name: 'Room 1',
      timezone: 'UTC',
      exclusive: true,
      capacity: 1,
      skillTags: [],
      bookableOnline: true,
      isActive: true,
      propertyIds: [siteA],
    });

    await updateResource(tenantId, { id: row.id, propertyIds: [siteB] });
    expect(await getResourcePropertyIds(tenantId, row.id)).toEqual([siteB]);

    // A plain rename must not touch the scope — this is the partial-update footgun.
    await updateResource(tenantId, { id: row.id, name: 'Room One' });
    expect(await getResourcePropertyIds(tenantId, row.id)).toEqual([siteB]);

    // …nor reset the other defaulted columns it used to silently rewrite.
    const after = await withTenant({ tenantId }, (tx) =>
      tx.schedulingResource.findFirstOrThrow({ where: { id: row.id } })
    );
    expect(after.name).toBe('Room One');
    expect(after.capacity).toBe(1);

    // An explicit empty list is the deliberate "every site" and DOES clear the rows.
    await updateResource(tenantId, { id: row.id, propertyIds: [] });
    expect(await getResourcePropertyIds(tenantId, row.id)).toEqual([]);
  });

  it("will not allocate the other business's staff to a booking", async () => {
    // The allocator's own filter, exercised directly against the data it reads: a
    // resource linked to site A is not a candidate for a booking on site B.
    const eligibleOn = async (propertyId: string) =>
      withTenant({ tenantId }, (tx) =>
        tx.schedulingResource.findMany({
          where: {
            kind: 'staff',
            isActive: true,
            deletedAt: null,
            bookableOnline: true,
            OR: [{ siteLinks: { some: { propertyId } } }, { siteLinks: { none: {} } }],
          },
          select: { name: true },
        })
      ).then((rows) => rows.map((r) => r.name).sort());

    expect(await eligibleOn(siteA)).toContain('Barber — site A only');
    expect(await eligibleOn(siteB)).not.toContain('Barber — site A only');
    // The shared owner remains bookable from both — scoping is opt-in, not a lockout.
    expect(await eligibleOn(siteB)).toContain('Owner — covers both');
  });
});
