// Scheduling slice — resources, services (with resource-role requirements), and a
// generated booking lifecycle. Scheduling-gated; run after applyCustomers so each
// booking links a real customer (the cross-module story: a customer who also has
// orders/reviews shows up on the calendar).
//
// Bookings are generated from a generic template, NOT authored per pack: each
// entry gets a distinct (day, hour) slot — spaced ≥4h within a day — so the
// no-double-booking EXCLUDE constraint holds for any service duration. Resources
// are matched to each service's roles by skill, then by kind.

import { SAMPLE_BOOKING_SOURCE, SAMPLE_SETTINGS } from '../markers';

import type { SampleDataPack, SampleResource, SampleService } from '../types';
import type { ApplyCtx } from './context';

const MON_SAT = [1, 2, 3, 4, 5, 6];
const DEFAULT_WINDOW = { days: MON_SAT, startMin: 9 * 60, endMin: 17 * 60 };

// Generic booking lifecycle. Distinct (dayOffset, hour) per entry, ≥4h apart
// within a day, so no two bookings overlap on a shared resource.
interface BookingGen {
  status: string;
  dayOffset: number;
  hour: number;
}
const BOOKING_GENS: BookingGen[] = [
  { status: 'confirmed', dayOffset: 1, hour: 9 },
  { status: 'confirmed', dayOffset: 1, hour: 13 },
  { status: 'confirmed', dayOffset: 2, hour: 10 },
  { status: 'requested', dayOffset: 3, hour: 14 },
  { status: 'confirmed', dayOffset: 4, hour: 10 },
  { status: 'completed', dayOffset: -3, hour: 15 },
  { status: 'cancelled', dayOffset: -2, hour: 11 },
];

function attendeeStatusFor(status: string): string {
  switch (status) {
    case 'completed':
      return 'attended';
    case 'cancelled':
      return 'cancelled';
    default:
      return 'booked';
  }
}

function atUtc(now: number, dayOffset: number, hour: number): Date {
  const d = new Date(now);
  d.setUTCDate(d.getUTCDate() + dayOffset);
  d.setUTCHours(hour, 0, 0, 0);
  return d;
}

/** One thing a practice booking can be made against: a service the pack made,
 *  or one the business already had. */
interface Bookable {
  id: string;
  durationMinutes: number;
  bufferAfterMin: number;
  bookingType: string;
  capacity: number;
  propertyId: string | null;
  roles: { kind?: string; skill?: string }[];
}

/** One person or thing a practice booking can be allocated. */
interface Allocatable {
  id: string;
  kind: string;
  skills: string[];
}

/** The people a service's roles need: by skill, else by kind, else anyone. */
function allocate(service: Bookable, people: Allocatable[]): string[] {
  const ids: string[] = [];
  const roles = service.roles.length > 0 ? service.roles : [{ kind: 'staff' }];
  for (const role of roles) {
    const skill = 'skill' in role ? role.skill : undefined;
    const bySkill = skill ? people.find((p) => p.skills.includes(skill)) : undefined;
    const byKind = role.kind ? people.find((p) => p.kind === role.kind) : undefined;
    const match = bySkill ?? byKind ?? people[0];
    if (match && !ids.includes(match.id)) ids.push(match.id);
  }
  return ids;
}

/** A service's stored role requirements, read defensively: the installer, the
 *  console and the pack all write `{ kind, skillTags }`. */
function rolesOf(requirements: unknown): { kind?: string; skill?: string }[] {
  if (!Array.isArray(requirements)) return [];
  return requirements.map((raw: unknown) => {
    const r = (raw ?? {}) as { kind?: unknown; skillTags?: unknown };
    const tags: unknown[] = Array.isArray(r.skillTags) ? r.skillTags : [];
    const skill = tags.find((t): t is string => typeof t === 'string');
    return {
      ...(typeof r.kind === 'string' ? { kind: r.kind } : {}),
      ...(skill ? { skill } : {}),
    };
  });
}

/** Is everyone named free for this span? The same rule as the database's own
 *  `booking_resources_no_overlap`: an exclusive, live allocation that overlaps.
 *  A practice booking on the business's own people must never collide with a
 *  real one, or the whole load fails. */
async function freeFor(
  tx: ApplyCtx['tx'],
  resourceIds: string[],
  start: Date,
  end: Date
): Promise<boolean> {
  if (resourceIds.length === 0) return true;
  const clash = await tx.bookingResource.count({
    where: {
      resourceId: { in: resourceIds },
      exclusive: true,
      status: { notIn: ['cancelled', 'no_show'] },
      startAt: { lt: end },
      endAt: { gt: start },
    },
  });
  return clash === 0;
}

// ── One menu (persona issue 085) ─────────────────────────────────────────────
//
// A salon that picked the Beauty & salon trade and the Salon (Editorial) design
// opened Bookings to eighteen services, four of them twice, Balayage at two
// prices, and ten people for a two-chair salon. The design had installed its
// example menu and people, and then this pack added its own on top.
//
// So the pack brings services and people only to a business that has none. One
// that already has a menu, the design's example one or its own, gets its practice
// bookings on THAT menu, with those people. Each practice booking carries its own
// mark (`source = 'sample'`), because on a real service there is no practice
// service to find it by; practice-bookings.ts is how Clear uses it.

/** The menu the business already has, if any. */
async function existingMenu(ctx: ApplyCtx): Promise<Bookable[]> {
  const rows = await ctx.tx.schedulingService.findMany({
    where: { tenantId: ctx.tenantId, deletedAt: null },
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      durationMinutes: true,
      bufferAfterMin: true,
      bookingType: true,
      capacity: true,
      propertyId: true,
      resourceRequirements: true,
    },
  });
  return rows.map((row) => ({
    id: row.id,
    durationMinutes: row.durationMinutes,
    bufferAfterMin: row.bufferAfterMin,
    bookingType: row.bookingType,
    capacity: row.capacity,
    propertyId: row.propertyId,
    roles: rolesOf(row.resourceRequirements),
  }));
}

/** The people and equipment the business already has, if any. */
async function existingPeople(ctx: ApplyCtx): Promise<Allocatable[]> {
  const rows = await ctx.tx.schedulingResource.findMany({
    where: { tenantId: ctx.tenantId, deletedAt: null },
    orderBy: { createdAt: 'asc' },
    select: { id: true, kind: true, skillTags: true },
  });
  return rows.map((row) => ({ id: row.id, kind: row.kind, skills: row.skillTags }));
}

/** The pack's people, made and marked as practice data. */
async function createPackPeople(
  ctx: ApplyCtx,
  resources: SampleResource[]
): Promise<Allocatable[]> {
  const { tx, tenantId } = ctx;
  const made: Allocatable[] = [];
  for (const r of resources) {
    const row = await tx.schedulingResource.create({
      data: {
        tenantId,
        kind: r.kind,
        name: r.name,
        timezone: 'UTC',
        skillTags: r.skills ?? [],
        capacityMin: r.capacityMin ?? null,
        capacityMax: r.capacityMax ?? null,
        settings: SAMPLE_SETTINGS,
      },
      select: { id: true },
    });
    ctx.resourceIdByKey.set(r.key, row.id);
    ctx.counts.resources += 1;
    const windows =
      r.windows ??
      DEFAULT_WINDOW.days.map((day) => ({
        day,
        startMin: DEFAULT_WINDOW.startMin,
        endMin: DEFAULT_WINDOW.endMin,
      }));
    await tx.availabilityWindow.createMany({
      data: windows.map((w) => ({
        tenantId,
        resourceId: row.id,
        dayOfWeek: w.day,
        startMinute: w.startMin,
        endMinute: w.endMin,
      })),
    });
    made.push({ id: row.id, kind: r.kind, skills: r.skills ?? [] });
  }
  return made;
}

/** The pack's services, made and marked as practice data. */
async function createPackMenu(ctx: ApplyCtx, services: SampleService[]): Promise<Bookable[]> {
  const { tx, tenantId } = ctx;
  const made: Bookable[] = [];
  for (const s of services) {
    const bookingType = s.bookingType ?? 'appointment';
    const capacity = s.capacity ?? 1;
    const bufferAfterMin = s.bufferAfterMin ?? 0;
    const requirements = (s.resourceRoles ?? []).map((role) => ({
      role: role.role,
      kind: role.kind ?? 'staff',
      ...(role.skill ? { skillTags: [role.skill] } : {}),
    }));
    const row = await tx.schedulingService.create({
      data: {
        tenantId,
        bookingType,
        name: s.name,
        description: s.description ?? null,
        durationMinutes: s.durationMinutes,
        bufferAfterMin,
        priceCents: s.priceCents ?? 0,
        capacity,
        slotIntervalMin: s.slotIntervalMin ?? 15,
        requiresApproval: s.requiresApproval ?? false,
        assignmentStrategy: s.assignmentStrategy ?? 'any_available',
        resourceRequirements: requirements,
        settings: SAMPLE_SETTINGS,
      },
      select: { id: true },
    });
    ctx.serviceIdByKey.set(s.key, row.id);
    ctx.counts.services += 1;
    made.push({
      id: row.id,
      durationMinutes: s.durationMinutes,
      bufferAfterMin,
      bookingType,
      capacity,
      propertyId: null,
      roles: rolesOf(requirements),
    });
  }
  return made;
}

export async function applyScheduling(ctx: ApplyCtx, pack: SampleDataPack): Promise<void> {
  if (!ctx.isOn('scheduling') || !pack.scheduling) return;
  const { tx, tenantId } = ctx;

  const ownPeople = await existingPeople(ctx);
  const people =
    ownPeople.length > 0 ? ownPeople : await createPackPeople(ctx, pack.scheduling.resources);
  const ownMenu = await existingMenu(ctx);
  const menu = ownMenu.length > 0 ? ownMenu : await createPackMenu(ctx, pack.scheduling.services);

  // Bookings — generated, each linking a persona-customer + the service's people.
  const customerIds = pack.personas
    .map((p) => ctx.customerIdByPersona.get(p.key))
    .filter((id): id is string => Boolean(id));
  if (customerIds.length === 0 || menu.length === 0) return;

  for (let i = 0; i < BOOKING_GENS.length; i++) {
    const gen = BOOKING_GENS[i]!;
    const service = menu[i % menu.length]!;
    const customerId = customerIds[i % customerIds.length]!;
    const startAt = atUtc(ctx.now, gen.dayOffset, gen.hour);
    const endAt = new Date(startAt.getTime() + service.durationMinutes * 60_000);
    const spanEnd = new Date(endAt.getTime() + service.bufferAfterMin * 60_000);
    const aStatus = attendeeStatusFor(gen.status);
    const resourceIds = allocate(service, people);
    // Someone real is already booked then: leave this one out rather than
    // double-book them or fail the load.
    if (!(await freeFor(tx, resourceIds, startAt, spanEnd))) continue;
    const isClass = service.bookingType === 'class';
    const partySize = service.bookingType === 'reservation' ? 3 : 1;
    const extraAttendees = isClass ? 5 : 0;

    await tx.booking.create({
      data: {
        tenantId,
        propertyId: service.propertyId,
        serviceId: service.id,
        bookingType: service.bookingType,
        status: gen.status,
        startAt,
        endAt,
        timezone: 'UTC',
        capacity: service.capacity,
        partySize,
        customerId,
        source: SAMPLE_BOOKING_SOURCE,
        ...(gen.status === 'confirmed' || gen.status === 'completed'
          ? { confirmedAt: new Date(ctx.now) }
          : {}),
        ...(gen.status === 'completed' ? { completedAt: endAt } : {}),
        ...(gen.status === 'cancelled' ? { cancelledAt: new Date(ctx.now) } : {}),
        resources: {
          create: resourceIds.map((resourceId) => ({
            tenantId,
            resourceId,
            role: 'resource',
            startAt,
            endAt: spanEnd,
            exclusive: true,
            status: gen.status,
          })),
        },
        attendees: {
          create: [
            { tenantId, customerId, partySize, status: aStatus },
            ...Array.from({ length: extraAttendees }, () => ({
              tenantId,
              guestName: 'Class guest',
              partySize: 1,
              status: aStatus,
            })),
          ],
        },
      },
    });
    ctx.counts.bookings += 1;
  }
}
