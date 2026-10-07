// Which bookings, services and people are practice data, for Clear and for the
// count Clear is described by (persona issue 085).
//
// A booking was practice data when its SERVICE was, and Clear deleted every
// booking on a practice service. That was wrong both ways:
//
//   - Too much. A salon that kept a practice service and booked a real client on
//     it lost that client's appointment to "Remove practice data". And a practice
//     stylist assigned to a real booking made the whole Remove fail, because a
//     person cannot be deleted while a booking still names them.
//   - Too little, once practice bookings use the business's own menu instead of
//     adding a second one: a practice booking on a real service has no practice
//     service to be found by.
//
// So a booking is practice data by its OWN mark: `source = 'sample'`, which every
// practice booking carries from now on, or a practice customer, which every one
// made before carried (the seeder only ever books its own sample personas, so no
// backfill is needed). A practice service or person goes only when nothing real
// still points at it; one a real booking, series or waiting list uses is the
// owner's now, and stays.

import type { Prisma } from '@prisma/client';

import { SAMPLE_BOOKING_SOURCE } from '../markers';

const sampleMeta = { path: ['sample'], equals: true };

/** The bookings a practice load made. */
export async function practiceBookingWhere(
  tx: Prisma.TransactionClient,
  tenantId: string
): Promise<Prisma.BookingWhereInput> {
  const customers = await tx.customer.findMany({
    where: { tenantId, metadata: sampleMeta },
    select: { id: true },
  });
  const ids = customers.map((c) => c.id);
  return {
    tenantId,
    OR: [
      { source: SAMPLE_BOOKING_SOURCE },
      ...(ids.length > 0 ? [{ customerId: { in: ids } }] : []),
    ],
  };
}

/** Practice services nothing real is booked on. `practice` is the booking
 *  filter above, so a count taken before Clear agrees with what Clear removes. */
export function removableServiceWhere(
  tenantId: string,
  practice: Prisma.BookingWhereInput
): Prisma.SchedulingServiceWhereInput {
  return {
    tenantId,
    settings: sampleMeta,
    bookings: { none: { NOT: practice } },
    bookingSeries: { none: {} },
    waitlist: { none: {} },
    meetingLinks: { none: {} },
  };
}

/** Practice people and equipment no real booking has allocated. */
export function removableResourceWhere(
  tenantId: string,
  practice: Prisma.BookingWhereInput
): Prisma.SchedulingResourceWhereInput {
  return {
    tenantId,
    settings: sampleMeta,
    bookingResources: { none: { booking: { NOT: practice } } },
  };
}

// ── The design's booking rules and places (issue 920) ─────────────────────────
//
// A design installs its booking content only as practice data (issue 098): its
// places, its rules, its people and its services. The people and services carry
// the practice mark; rules and places have no column to hold one, so "Remove
// practice data" left them, and Halo & Hem kept an example "Standard booking"
// rule that nothing used, beside her own.
//
// They are found by the install record instead. It keeps the id of every rule
// and place the design used, including ones it REUSED by name, such as the
// business's own "Main location". Only a row created after the install began
// was made by the design, so only those count, and only while nothing real uses
// them: a rule the owner put her own service on is hers now.

/** The rules and places practice data brought with a design. */
export interface DesignExamples {
  ruleIds: string[];
  placeIds: string[];
}

function idsIn(map: unknown): string[] {
  if (!map || typeof map !== 'object') return [];
  return Object.values(map as Record<string, unknown>).filter(
    (id): id is string => typeof id === 'string'
  );
}

export async function designExamples(
  tx: Prisma.TransactionClient,
  tenantId: string
): Promise<DesignExamples> {
  const installs = await tx.tenantBlueprintInstall.findMany({
    where: { tenantId, sampleData: true },
    select: { createdAt: true, result: true },
  });
  const ruleIds: string[] = [];
  const placeIds: string[] = [];
  for (const install of installs) {
    const result = install.result as { scheduling?: { policies?: unknown; locations?: unknown } };
    const rules = idsIn(result.scheduling?.policies);
    const places = idsIn(result.scheduling?.locations);
    const madeAfter = { gte: install.createdAt };
    if (rules.length > 0) {
      const made = await tx.bookingPolicy.findMany({
        where: { tenantId, id: { in: rules }, createdAt: madeAfter },
        select: { id: true },
      });
      ruleIds.push(...made.map((row) => row.id));
    }
    if (places.length > 0) {
      const made = await tx.businessLocation.findMany({
        where: { tenantId, id: { in: places }, createdAt: madeAfter },
        select: { id: true },
      });
      placeIds.push(...made.map((row) => row.id));
    }
  }
  return { ruleIds, placeIds };
}

/** A design's example rules that nothing real will still use once practice
 *  data is gone. */
export function removableRuleWhere(
  tenantId: string,
  examples: DesignExamples,
  practice: Prisma.BookingWhereInput
): Prisma.BookingPolicyWhereInput {
  return {
    tenantId,
    id: { in: examples.ruleIds },
    services: { none: { NOT: removableServiceWhere(tenantId, practice) } },
    bookings: { none: { NOT: practice } },
  };
}

/** A design's example places that nothing real will still use. A closure the
 *  owner added to one makes it hers. */
export function removablePlaceWhere(
  tenantId: string,
  examples: DesignExamples,
  practice: Prisma.BookingWhereInput
): Prisma.BusinessLocationWhereInput {
  return {
    tenantId,
    id: { in: examples.placeIds },
    services: { none: { NOT: removableServiceWhere(tenantId, practice) } },
    resources: { none: { NOT: removableResourceWhere(tenantId, practice) } },
    bookings: { none: { NOT: practice } },
    exceptions: { none: {} },
  };
}
