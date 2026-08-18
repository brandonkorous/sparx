// A design brings its OWN premises, and two businesses on one tenant stay apart.
//
// WHY THIS EXISTS. Until a blueprint could declare `scheduling.locations`, the
// installer filed every template's chairs, rooms and staff against the tenant's
// activation-seeded 'Main location'. On a single-premises business that is right. On
// a tenant running two — a barber shop on one site, a grooming salon on the other —
// it put both businesses' people and services at the SAME place, and a place is what
// the diary, the availability engine and the utilisation report group by.
//
// What is pinned here:
//   · a declared location is created, SCOPED to the installed site, and everything
//     that names no location files against it
//   · installing the same design onto a second site RECONCILES by name rather than
//     minting a duplicate premises
//   · two different designs on two sites get two different places
//   · a blueprint that declares NO location still works — everything falls back to
//     the seeded 'Main location' (the old behaviour, unchanged)

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyBaseLogger } from 'fastify';
import { prisma, withTenant } from '@wizeworks/db';
import type { Blueprint } from '@wizeworks/blueprints';
import { createTestTenant, dropTestTenant } from '../helpers.js';
import { installBlueprint } from '../../src/lib/blueprint-installer.js';

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

/** The smallest scheduling blueprint: one place, one person filed there, one service.
 *  `requiresModules` is a consistency hint, not an install gate — the slice runs
 *  because the fixture tenant has the module enabled below. */
const design = (key: string, place: string | null, person: string) =>
  ({
    key,
    version: '1.0.0',
    name: key,
    summary: 'Scheduling location fixture.',
    vertical: 'services',
    requiresModules: ['scheduling'],
    brand: {
      businessName: key,
      colors: { primary: '#123456' },
      fonts: { heading: 'Inter', body: 'Inter' },
    },
    // REQUIRED by BlueprintSchema and read unguarded by the theme slice. This
    // fixture bypasses validation (`as unknown as Blueprint`), so it has to supply
    // everything the CODE reads, not merely what this test cares about.
    theme: {
      name: `${key} theme`,
      basePresetKey: 'sparx',
      presentation: {},
      apply: false,
    },
    // Every collection the installer + baseline walk unguarded. A fixture that
    // skips validation must supply the whole shape, not just the part under test.
    assets: [],
    contentTypes: [],
    authors: [],
    content: [],
    commerce: { categories: [], collections: [], products: [] },
    emails: [],
    sequences: [],
    pages: [],
    scheduling: {
      ...(place ? { locations: [{ handle: 'premises', name: place, timezone: 'UTC' }] } : {}),
      policies: [],
      resources: [
        {
          handle: 'lead',
          name: person,
          kind: 'staff',
          skillTags: [],
          capacity: 1,
          timezone: 'UTC',
          bookableOnline: true,
          windows: [],
        },
      ],
      services: [
        {
          handle: 'main',
          name: `${key} service`,
          bookingType: 'appointment',
          durationMinutes: 30,
          bufferBeforeMin: 0,
          bufferAfterMin: 0,
          priceCents: 0,
          currency: 'usd',
          capacity: 1,
          slotIntervalMin: 15,
          minLeadMinutes: 0,
          maxAdvanceDays: 365,
          assignmentStrategy: 'any_available',
          resourceRequirements: [],
          bookableOnline: true,
          requiresApproval: false,
        },
      ],
    },
  }) as unknown as Blueprint;

describe('blueprint scheduling — a design brings its own premises', () => {
  let tenantId: string;
  let siteA: string;
  let siteB: string;

  beforeAll(async () => {
    const tenant = await createTestTenant();
    tenantId = tenant.tenantId;
    siteA = tenant.propertyId;
    // A bare boolean silently disables the slice — it has to be `{ enabled: true }`.
    await prisma.tenant.update({
      where: { id: tenantId },
      data: { settings: { modules: { scheduling: { enabled: true } } } },
    });
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

  const placeOf = async (name: string) =>
    withTenant({ tenantId }, (tx) =>
      tx.businessLocation.findFirst({
        where: { tenantId, name },
        select: { id: true, siteLinks: { select: { propertyId: true } } },
      })
    );

  it('creates the declared place, scoped to the site it was installed on', async () => {
    const { result } = await installBlueprint(
      { tenantId, propertyId: siteA, userId: null, logger },
      design('barber-fixture', 'Fade Room', 'Marcus')
    );

    expect(result.scheduling?.locations).toHaveProperty('premises');

    const place = await placeOf('Fade Room');
    expect(place).not.toBeNull();
    // Scoped, so the other business's diary never offers it.
    expect(place?.siteLinks.map((l) => l.propertyId)).toEqual([siteA]);

    // The person files against it without naming a handle — the design's first
    // declared location is the default.
    const person = await withTenant({ tenantId }, (tx) =>
      tx.schedulingResource.findFirstOrThrow({ where: { tenantId, name: 'Marcus' } })
    );
    expect(person.locationId).toBe(place?.id);

    const service = await withTenant({ tenantId }, (tx) =>
      tx.schedulingService.findFirstOrThrow({
        where: { tenantId, name: 'barber-fixture service' },
      })
    );
    expect(service.locationId).toBe(place?.id);
  });

  it('gives a DIFFERENT design on the other site its own place', async () => {
    await installBlueprint(
      { tenantId, propertyId: siteB, userId: null, logger },
      design('groom-fixture', 'The Grooming Room', 'Sam')
    );

    const barber = await placeOf('Fade Room');
    const groomer = await placeOf('The Grooming Room');
    expect(groomer).not.toBeNull();
    expect(groomer?.id).not.toBe(barber?.id);
    expect(groomer?.siteLinks.map((l) => l.propertyId)).toEqual([siteB]);

    // Two businesses, two places — which is the whole point.
    const all = await withTenant({ tenantId }, (tx) =>
      tx.businessLocation.findMany({ where: { tenantId }, select: { name: true } })
    );
    expect(all.map((l) => l.name).sort()).toEqual(['Fade Room', 'The Grooming Room']);
  });

  it('reconciles by name when the same design lands on a second site', async () => {
    await installBlueprint(
      { tenantId, propertyId: siteB, userId: null, logger },
      design('barber-fixture', 'Fade Room', 'Marcus')
    );

    // One row, not two — the owner does not get a duplicate premises to clean up.
    const rows = await withTenant({ tenantId }, (tx) =>
      tx.businessLocation.findMany({ where: { tenantId, name: 'Fade Room' }, select: { id: true } })
    );
    expect(rows).toHaveLength(1);

    // …and it WIDENS onto the second site rather than moving: it was already scoped,
    // so both businesses that installed this design can serve from it.
    const place = await placeOf('Fade Room');
    expect(place?.siteLinks.map((l) => l.propertyId).sort()).toEqual([siteA, siteB].sort());
  });

  it('falls back to the seeded place when a design declares none', async () => {
    // The old behaviour, unchanged — a single-premises business is unaffected.
    await withTenant({ tenantId }, (tx) =>
      tx.businessLocation.create({ data: { tenantId, name: 'Main location', timezone: 'UTC' } })
    );

    await installBlueprint(
      { tenantId, propertyId: siteA, userId: null, logger },
      design('placeless-fixture', null, 'Alex')
    );

    const seeded = await placeOf('Main location');
    const person = await withTenant({ tenantId }, (tx) =>
      tx.schedulingResource.findFirstOrThrow({ where: { tenantId, name: 'Alex' } })
    );
    expect(person.locationId).toBe(seeded?.id);
    // The seeded place had no links, so it stays global — never narrowed.
    expect(seeded?.siteLinks).toHaveLength(0);
  });
});
