// ONE SERVICE MENU, AND "REMOVE PRACTICE DATA" NEVER TAKES A REAL BOOKING.
//
// Persona issue 085. A salon that picked the Beauty & salon trade and the Salon
// (Editorial) design opened Bookings to eighteen services, four of them twice,
// Balayage at two prices, and ten people for a two-chair salon: the design
// installed its example menu, then the practice pack added its own on top.
//
// Underneath that was a worse rule. A booking was practice data when its SERVICE
// was, so Clear deleted every booking on a practice service, a real client's
// included, and a practice stylist on a real booking made the whole Remove fail.
//
// What this proves:
//   - a business with a menu gets its practice bookings on that menu, and no
//     second one; none of them lands on a person already booked;
//   - a reload books onto the same menu instead of bringing another;
//   - Remove takes the practice bookings, old and new, and keeps any practice
//     service or person a real booking uses, and the real booking itself;
//   - the count shown before Remove is what Remove takes.

import crypto from 'node:crypto';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  clearSampleData,
  loadSampleData,
  prisma,
  resolveSamplePack,
  sampleDataStatus,
  withTenant,
} from '@wizeworks/db';

import { seedPrimaryProperty } from '../helpers.js';

const MODULES = ['crm', 'scheduling'];
const HOUR = 60 * 60_000;

async function makeTenant(prefix: string): Promise<string> {
  const slug = `${prefix}-${crypto.randomBytes(4).toString('hex')}`;
  const tenant = await prisma.tenant.create({
    data: {
      slug,
      name: slug,
      email: `${slug}@sparx.test`,
      plan: 'starter',
      status: 'active',
      settings: { modules: { crm: { enabled: true }, scheduling: { enabled: true } } },
    },
  });
  await seedPrimaryProperty(tenant.id, `Test ${slug}`);
  await withTenant({ tenantId: tenant.id }, (tx) =>
    tx.user.create({
      data: {
        tenantId: tenant.id,
        email: `owner-${slug}@sparx.test`,
        name: 'Owner',
        role: 'owner',
      },
    })
  );
  return tenant.id;
}

/** A real client, booked for real on a service with a person. */
async function bookForReal(
  tenantId: string,
  serviceId: string,
  resourceId: string,
  startAt: Date
): Promise<string> {
  return withTenant({ tenantId }, async (tx) => {
    const customer = await tx.customer.create({
      data: { tenantId, email: `real-${crypto.randomBytes(3).toString('hex')}@client.test` },
      select: { id: true },
    });
    const endAt = new Date(startAt.getTime() + HOUR);
    const booking = await tx.booking.create({
      data: {
        tenantId,
        serviceId,
        bookingType: 'appointment',
        status: 'confirmed',
        startAt,
        endAt,
        customerId: customer.id,
        source: 'dashboard',
        resources: {
          create: [
            {
              tenantId,
              resourceId,
              role: 'staff',
              startAt,
              endAt,
              exclusive: true,
              status: 'confirmed',
            },
          ],
        },
      },
      select: { id: true },
    });
    return booking.id;
  });
}

/** The first practice slot: tomorrow at 09:00 UTC (BOOKING_GENS[0]). */
function firstPracticeSlot(): Date {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + 1);
  d.setUTCHours(9, 0, 0, 0);
  return d;
}

describe('practice bookings on a business that has its own menu', () => {
  let tenantId: string;
  let serviceId: string;
  let resourceId: string;
  let realBookingId: string;

  beforeAll(async () => {
    tenantId = await makeTenant('one-menu');
    ({ serviceId, resourceId } = await withTenant({ tenantId }, async (tx) => {
      const service = await tx.schedulingService.create({
        data: {
          tenantId,
          name: 'Signature cut',
          bookingType: 'appointment',
          durationMinutes: 60,
          priceCents: 9000,
          resourceRequirements: [{ kind: 'staff' }],
        },
        select: { id: true },
      });
      const resource = await tx.schedulingResource.create({
        data: { tenantId, kind: 'staff', name: 'Jess', timezone: 'UTC' },
        select: { id: true },
      });
      return { serviceId: service.id, resourceId: resource.id };
    }));
    // Jess is already booked at the moment the first practice booking wants her.
    realBookingId = await bookForReal(tenantId, serviceId, resourceId, firstPracticeSlot());
  });

  afterAll(async () => {
    await prisma.tenant.delete({ where: { id: tenantId } });
  });

  it('books onto that menu, brings no second one, and double-books nobody', async () => {
    const pack = resolveSamplePack('salon');
    expect(pack?.scheduling?.services.length).toBeGreaterThan(0);
    await loadSampleData({ tenantId }, pack!, MODULES);

    const { services, people, practice, atFirstSlot } = await withTenant(
      { tenantId },
      async (tx) => ({
        services: await tx.schedulingService.count(),
        people: await tx.schedulingResource.count(),
        practice: await tx.booking.findMany({
          where: { source: 'sample' },
          select: { serviceId: true },
        }),
        atFirstSlot: await tx.booking.count({ where: { startAt: firstPracticeSlot() } }),
      })
    );
    expect(services).toBe(1);
    expect(people).toBe(1);
    expect(practice.length).toBeGreaterThan(0);
    expect(practice.every((b) => b.serviceId === serviceId)).toBe(true);
    // The practice booking that wanted Jess at 09:00 stood down.
    expect(atFirstSlot).toBe(1);

    const status = await sampleDataStatus({ tenantId }, 'salon', MODULES);
    expect(status.counts.services).toBe(0);
    expect(status.counts.resources).toBe(0);
    expect(status.counts.bookings).toBe(practice.length);
  });

  it('Remove takes the practice bookings and leaves her menu, her person and her client', async () => {
    const removed = await clearSampleData({ tenantId });
    const left = await withTenant({ tenantId }, async (tx) => ({
      services: await tx.schedulingService.count(),
      people: await tx.schedulingResource.count(),
      bookings: await tx.booking.findMany({ select: { id: true } }),
    }));
    expect(removed.services).toBe(0);
    expect(left.services).toBe(1);
    expect(left.people).toBe(1);
    expect(left.bookings.map((b) => b.id)).toEqual([realBookingId]);
  });
});

describe('practice data on a business with no menu', () => {
  let tenantId: string;

  beforeAll(async () => {
    tenantId = await makeTenant('pack-menu');
  });

  afterAll(async () => {
    await prisma.tenant.delete({ where: { id: tenantId } });
  });

  it('a reload books onto the same menu, and Remove keeps what a real client uses', async () => {
    const pack = resolveSamplePack('salon')!;
    const first = await loadSampleData({ tenantId }, pack, MODULES);
    expect(first.services).toBe(pack.scheduling!.services.length);

    // Reloading brings no second menu.
    await loadSampleData({ tenantId }, pack, MODULES);
    const menu = await withTenant({ tenantId }, (tx) =>
      tx.schedulingService.findMany({ orderBy: { createdAt: 'asc' }, select: { id: true } })
    );
    expect(menu).toHaveLength(pack.scheduling!.services.length);

    // A practice booking written before bookings carried their own mark: found
    // by its practice customer.
    await withTenant({ tenantId }, async (tx) => {
      const one = await tx.booking.findFirst({ where: { source: 'sample' }, select: { id: true } });
      await tx.booking.update({ where: { id: one!.id }, data: { source: 'dashboard' } });
    });

    // The owner keeps one practice service and books a real client on it, with
    // a practice stylist, three weeks out where nothing else sits.
    const kept = menu[0]!.id;
    const stylist = await withTenant({ tenantId }, (tx) =>
      tx.schedulingResource.findFirst({ orderBy: { createdAt: 'asc' }, select: { id: true } })
    );
    const inThreeWeeks = new Date(Date.now() + 21 * 24 * HOUR);
    const real = await bookForReal(tenantId, kept, stylist!.id, inThreeWeeks);

    const before = await sampleDataStatus({ tenantId }, 'salon', MODULES);
    const removed = await clearSampleData({ tenantId });
    expect(removed.services).toBe(before.counts.services);
    expect(removed.services).toBe(pack.scheduling!.services.length - 1);

    const left = await withTenant({ tenantId }, async (tx) => ({
      services: await tx.schedulingService.findMany({ select: { id: true } }),
      people: await tx.schedulingResource.findMany({ select: { id: true } }),
      bookings: await tx.booking.findMany({ select: { id: true } }),
    }));
    expect(left.services.map((s) => s.id)).toEqual([kept]);
    expect(left.people.map((p) => p.id)).toEqual([stylist!.id]);
    expect(left.bookings.map((b) => b.id)).toEqual([real]);
  });
});
