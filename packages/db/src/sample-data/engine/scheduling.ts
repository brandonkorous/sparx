// Scheduling slice — resources, services (with resource-role requirements), and a
// generated booking lifecycle. Scheduling-gated; run after applyCustomers so each
// booking links a real customer (the cross-module story: a customer who also has
// orders/reviews shows up on the calendar).
//
// Bookings are generated from a generic template, NOT authored per pack: each
// entry gets a distinct (day, hour) slot — spaced ≥4h within a day — so the
// no-double-booking EXCLUDE constraint holds for any service duration. Resources
// are matched to each service's roles by skill, then by kind.

import { SAMPLE_SETTINGS } from '../markers';

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

/** Resolve a service's roles to resource keys (by skill, else by kind). */
function resolveResourceKeys(service: SampleService, resources: SampleResource[]): string[] {
  const keys: string[] = [];
  for (const role of service.resourceRoles ?? []) {
    const bySkill = role.skill
      ? resources.find((r) => (r.skills ?? []).includes(role.skill!))
      : undefined;
    const byKind = role.kind ? resources.find((r) => r.kind === role.kind) : undefined;
    const match = bySkill ?? byKind ?? resources[0];
    if (match && !keys.includes(match.key)) keys.push(match.key);
  }
  return keys;
}

export async function applyScheduling(ctx: ApplyCtx, pack: SampleDataPack): Promise<void> {
  if (!ctx.isOn('scheduling') || !pack.scheduling) return;
  const { tx, tenantId } = ctx;
  const { services, resources } = pack.scheduling;

  // Resources + weekly availability windows.
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
  }

  // Services + their resource-role requirements.
  const serviceMeta = new Map<
    string,
    {
      id: string;
      durationMinutes: number;
      bufferAfterMin: number;
      bookingType: string;
      capacity: number;
    }
  >();
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
        resourceRequirements: requirements,
        settings: SAMPLE_SETTINGS,
      },
      select: { id: true },
    });
    serviceMeta.set(s.key, {
      id: row.id,
      durationMinutes: s.durationMinutes,
      bufferAfterMin,
      bookingType,
      capacity,
    });
    ctx.serviceIdByKey.set(s.key, row.id);
  }

  // Bookings — generated, each linking a persona-customer + the service's resources.
  const personaKeys = pack.personas.map((p) => p.key);
  const customerIds = personaKeys
    .map((k) => ctx.customerIdByPersona.get(k))
    .filter((id): id is string => Boolean(id));
  if (customerIds.length === 0 || services.length === 0) return;

  for (let i = 0; i < BOOKING_GENS.length; i++) {
    const gen = BOOKING_GENS[i]!;
    const service = services[i % services.length]!;
    const meta = serviceMeta.get(service.key);
    const customerId = customerIds[i % customerIds.length]!;
    if (!meta) continue;
    const startAt = atUtc(ctx.now, gen.dayOffset, gen.hour);
    const endAt = new Date(startAt.getTime() + meta.durationMinutes * 60_000);
    const spanEnd = new Date(endAt.getTime() + meta.bufferAfterMin * 60_000);
    const aStatus = attendeeStatusFor(gen.status);
    const resourceKeys = resolveResourceKeys(service, resources);
    const isClass = meta.bookingType === 'class';
    const partySize = meta.bookingType === 'reservation' ? 3 : 1;
    const extraAttendees = isClass ? 5 : 0;

    await tx.booking.create({
      data: {
        tenantId,
        serviceId: meta.id,
        bookingType: meta.bookingType,
        status: gen.status,
        startAt,
        endAt,
        timezone: 'UTC',
        capacity: meta.capacity,
        partySize,
        customerId,
        source: 'dashboard',
        ...(gen.status === 'confirmed' || gen.status === 'completed'
          ? { confirmedAt: new Date(ctx.now) }
          : {}),
        ...(gen.status === 'completed' ? { completedAt: endAt } : {}),
        ...(gen.status === 'cancelled' ? { cancelledAt: new Date(ctx.now) } : {}),
        resources: {
          create: resourceKeys
            .map((key) => ctx.resourceIdByKey.get(key))
            .filter((id): id is string => Boolean(id))
            .map((resourceId) => ({
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
