// THE SALON DESIGN AND THE SALON PRACTICE DATA MAKE ONE MENU, AND BOTH COME OUT.
//
// Persona issue 085, end to end with the real catalog design. Halo & Hem picked
// the Beauty & salon trade and the Salon (Editorial) design and opened Bookings
// to eighteen services, four of them twice and Balayage at two prices, and ten
// people for a two-chair salon. Clearing the samples then left the design's
// stylists behind, and the screen offered two of them to her clients.
//
// The design installs its booking menu only as practice data (issue 098), so it
// now carries the practice mark; the pack books onto it instead of adding its
// own; and "Remove practice data" takes the lot, the design's booking rules and
// place included (issue 920). A rule the business already had, which the design
// reused by name, is the business's and stays.

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyBaseLogger } from 'fastify';

import {
  clearSampleData,
  loadSampleData,
  prisma,
  resolveSamplePack,
  sampleDataStatus,
  withTenant,
} from '@wizeworks/db';

import { createTestTenant, dropTestTenant } from '../helpers.js';
import { installBlueprint } from '../../src/lib/blueprint-installer.js';
import { resolveBlueprintManifest } from '../../src/lib/marketplace/resolve.js';

const noop = (): void => undefined;
const logger = {
  debug: noop,
  info: noop,
  warn: noop,
  error: noop,
  fatal: noop,
  trace: noop,
  child: () => logger,
} as unknown as FastifyBaseLogger;

const MODULES = ['crm', 'scheduling'];
const sampleMeta = { path: ['sample'], equals: true };

describe('the Salon (Editorial) design with salon practice data', () => {
  let tenantId: string;
  let propertyId: string;

  beforeAll(async () => {
    const tenant = await createTestTenant();
    tenantId = tenant.tenantId;
    propertyId = tenant.propertyId;
    await prisma.tenant.update({
      where: { id: tenantId },
      data: { settings: { modules: { crm: { enabled: true }, scheduling: { enabled: true } } } },
    });
  });

  afterAll(async () => {
    await dropTestTenant(tenantId);
    await prisma.$disconnect();
  });

  it('opens Bookings to one menu, the design’s, and Remove takes all of it', async () => {
    const design = await resolveBlueprintManifest(tenantId, 'sparx-salon-editorial');
    expect(design, 'the salon design is in the catalog').not.toBeNull();
    const menu = design!.scheduling!.services.length;
    const people = design!.scheduling!.resources.length;
    const rules = design!.scheduling!.policies;
    expect(rules.length).toBeGreaterThan(1);
    // The business already has a rule by the name of the design's first one, so
    // the design reuses it instead of making its own.
    const theirs = await withTenant({ tenantId }, (tx) =>
      tx.bookingPolicy.create({
        data: { tenantId, name: rules[0]!.name, depositType: 'none' },
        select: { id: true },
      })
    );

    await installBlueprint({ tenantId, propertyId, userId: null, logger }, design!, {
      sampleData: true,
    });
    await loadSampleData({ tenantId }, resolveSamplePack('salon')!, MODULES);

    const loaded = await withTenant({ tenantId }, async (tx) => ({
      services: await tx.schedulingService.findMany({ select: { id: true, settings: true } }),
      people: await tx.schedulingResource.count(),
      marked: await tx.schedulingResource.count({ where: { settings: sampleMeta } }),
      bookings: await tx.booking.findMany({
        where: { source: 'sample' },
        select: { serviceId: true },
      }),
    }));
    // One menu: the design's seven, not the design's plus the pack's.
    expect(loaded.services).toHaveLength(menu);
    expect(loaded.people).toBe(people);
    expect(loaded.marked).toBe(people);
    const ids = new Set(loaded.services.map((s) => s.id));
    expect(loaded.bookings.length).toBeGreaterThan(0);
    expect(loaded.bookings.every((b) => ids.has(b.serviceId))).toBe(true);

    // What the screen promises before Remove is what Remove takes.
    const promised = await sampleDataStatus({ tenantId }, 'salon', MODULES);
    expect(promised.counts.bookingRules).toBe(rules.length - 1);
    expect(promised.counts.places).toBe(design!.scheduling!.locations?.length ?? 0);

    await clearSampleData({ tenantId });
    const left = await withTenant({ tenantId }, async (tx) => ({
      services: await tx.schedulingService.count(),
      people: await tx.schedulingResource.count(),
      bookings: await tx.booking.count(),
      rules: (await tx.bookingPolicy.findMany({ select: { id: true } })).map((r) => r.id),
      places: await tx.businessLocation.count(),
    }));
    expect(left).toEqual({ services: 0, people: 0, bookings: 0, rules: [theirs.id], places: 0 });
  });
});
