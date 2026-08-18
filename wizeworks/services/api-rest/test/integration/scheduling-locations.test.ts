// Business locations — the CRUD that never existed, and the site scope behind it.
//
// WHY THIS EXISTS. `scheduling_locations` shipped with a seeded 'Main location', FKs
// from resources / services / bookings / availability exceptions, and a site junction
// (`scheduling_location_properties`) — and no CRUD anywhere in the platform. A tenant
// could not add a second premises, could not rename the one they had, and the junction
// had neither a writer nor a reader. Everything downstream referenced a place nobody
// could manage.
//
// The two behaviours worth pinning beyond plain CRUD:
//   · site scope — a place linked to one site is invisible to the other, while an
//     UNLINKED place serves both (one premises hosting two businesses is the ordinary
//     case, which is why this is a junction and not a column)
//   · the delete guard — deleting is REFUSED while bookings point at the place. The FK
//     is SET NULL, so a delete would succeed and silently strip the location off
//     completed appointments. `isActive:false` is the lossless retirement path.

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { prisma, withTenant } from '@wizeworks/db';
import {
  createLocation,
  deleteLocation,
  getLocation,
  listLocations,
  updateLocation,
  LocationInUseError,
  LocationNotFoundError,
} from '@wizeworks/scheduling';
import { createTestTenant, dropTestTenant } from '../helpers.js';

describe('scheduling locations', () => {
  let tenantId: string;
  let siteA: string;
  let siteB: string;

  beforeAll(async () => {
    const tenant = await createTestTenant();
    tenantId = tenant.tenantId;
    siteA = tenant.propertyId;
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

  it('creates a place with its address, zone and site scope', async () => {
    const created = await createLocation(tenantId, {
      name: 'High Street shop',
      address: { line1: '14 High Street', city: 'Visalia', region: 'CA', postalCode: '93291' },
      timezone: 'America/Los_Angeles',
      lat: 36.3302,
      lng: -119.2921,
      propertyIds: [siteA],
    });

    expect(created.name).toBe('High Street shop');
    expect(created.address.line1).toBe('14 High Street');
    expect(created.timezone).toBe('America/Los_Angeles');
    expect(created.lat).toBeCloseTo(36.3302);
    // The junction that had no writer before this existed.
    expect(created.propertyIds).toEqual([siteA]);
    expect(created.counts).toEqual({ resources: 0, services: 0, bookings: 0 });
  });

  it('refuses half a coordinate', async () => {
    await expect(createLocation(tenantId, { name: 'Half a pin', lat: 36.3302 })).rejects.toThrow(
      /both a latitude and a longitude/i
    );
  });

  it('hides a scoped place from the other business, and shows an unscoped one to both', async () => {
    await createLocation(tenantId, { name: 'Shared yard' }); // no links = every site

    const names = async (propertyId: string) =>
      (await listLocations(tenantId, { propertyIds: [propertyId] })).map((l) => l.name);

    expect(await names(siteA)).toContain('High Street shop');
    expect(await names(siteB)).not.toContain('High Street shop');
    // Unlinked = one premises hosting both businesses.
    expect(await names(siteA)).toContain('Shared yard');
    expect(await names(siteB)).toContain('Shared yard');
    // (A fixture tenant has no 'Main location' — that row is seeded by
    // `bootstrapSchedulingDefaults` on module activation, which `createTestTenant`
    // does not run. Nothing here depends on it.)
  });

  it('replaces the scope on update, and a rename leaves everything else alone', async () => {
    const created = await createLocation(tenantId, {
      name: 'Mobile unit',
      timezone: 'America/Denver',
      propertyIds: [siteA],
    });

    await updateLocation(tenantId, { id: created.id, propertyIds: [siteB] });
    expect((await getLocation(tenantId, created.id)).propertyIds).toEqual([siteB]);

    // The partial-update footgun: without the Update-schema overrides this rename
    // would reset the zone to UTC, re-activate the place and wipe the scope.
    await updateLocation(tenantId, { id: created.id, name: 'Mobile unit 2' });
    const after = await getLocation(tenantId, created.id);
    expect(after.name).toBe('Mobile unit 2');
    expect(after.timezone).toBe('America/Denver');
    expect(after.isActive).toBe(true);
    expect(after.propertyIds).toEqual([siteB]);

    // An explicit empty list is the deliberate "serves every site".
    await updateLocation(tenantId, { id: created.id, propertyIds: [] });
    expect((await getLocation(tenantId, created.id)).propertyIds).toEqual([]);
  });

  it('deletes a place nothing is booked at, and detaches what was filed there', async () => {
    const created = await createLocation(tenantId, { name: 'Spare room' });
    const resource = await withTenant({ tenantId }, (tx) =>
      tx.schedulingResource.create({
        data: { tenantId, kind: 'space', name: 'Spare room chair', locationId: created.id },
        select: { id: true },
      })
    );
    expect((await getLocation(tenantId, created.id)).counts.resources).toBe(1);

    await deleteLocation(tenantId, created.id);
    await expect(getLocation(tenantId, created.id)).rejects.toBeInstanceOf(LocationNotFoundError);

    // Configuration survives and simply becomes unassigned — the owner re-files it.
    const after = await withTenant({ tenantId }, (tx) =>
      tx.schedulingResource.findFirstOrThrow({ where: { id: resource.id } })
    );
    expect(after.locationId).toBeNull();
  });

  it('refuses to delete a place that bookings point at', async () => {
    const created = await createLocation(tenantId, { name: 'Booked room' });
    const service = await withTenant({ tenantId }, (tx) =>
      tx.schedulingService.create({
        data: { tenantId, name: 'Consult', durationMinutes: 30, locationId: created.id },
        select: { id: true },
      })
    );
    await withTenant({ tenantId }, (tx) =>
      tx.booking.create({
        data: {
          tenantId,
          serviceId: service.id,
          locationId: created.id,
          bookingType: 'appointment',
          status: 'confirmed',
          startAt: new Date('2026-09-01T15:00:00Z'),
          endAt: new Date('2026-09-01T15:30:00Z'),
        },
      })
    );

    // Deleting would succeed at the database (SET NULL) and quietly strip the place
    // off that booking's history. The service refuses instead and says what to do.
    await expect(deleteLocation(tenantId, created.id)).rejects.toBeInstanceOf(LocationInUseError);
    await expect(deleteLocation(tenantId, created.id)).rejects.toThrow(/switch it off/i);

    // …and the lossless path works.
    const off = await updateLocation(tenantId, { id: created.id, isActive: false });
    expect(off.isActive).toBe(false);
    expect(off.counts.bookings).toBe(1);
  });
});
