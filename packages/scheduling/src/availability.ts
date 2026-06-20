// Availability / slot computation (docs/79 §7.2). Split into a PURE core
// (`computeSlots`, fully deterministic + unit-tested) and a DB wrapper
// (`getAvailability`, loads the inputs under tenant RLS).
//
// Model: availability is computed per resource; a slot is offered only when every
// required role on the service has at least one resource simultaneously free for
// the full buffered span. The displayed booking is [start, start+duration]; the
// resource is occupied for [start-bufferBefore, start+duration+bufferAfter], which
// is exactly what the booking write-path allocates — so what we offer is what the
// DB-level no-overlap constraint will accept.

import { withTenant } from '@sparx/db';
import type { AvailabilityQuery } from '@sparx/scheduling-schemas';

import { ServiceNotFoundError } from './errors';
import {
  contains,
  eachLocalDay,
  localWallToUtc,
  mergeIntervals,
  subtractIntervals,
  type Interval,
} from './time';

const DAY_MS = 24 * 60 * 60 * 1000;
const MINUTE_MS = 60 * 1000;
const MAX_SLOTS = 2000; // safety cap on a single availability response

export interface ResourceAvailability {
  resourceId: string;
  timezone: string;
  windows: {
    dayOfWeek: number;
    startMinute: number;
    endMinute: number;
    validFrom: number | null; // epoch ms (local date start) or null
    validTo: number | null;
  }[];
  /** Already-busy intervals: existing allocations + closures + external calendar. */
  busy: Interval[];
}

export interface SlotComputationInput {
  fromUtc: number;
  toUtc: number;
  nowUtc: number;
  durationMs: number;
  bufferBeforeMs: number;
  bufferAfterMs: number;
  slotIntervalMs: number;
  minLeadMs: number;
  maxAdvanceMs: number;
  roles: { role: string; resources: ResourceAvailability[] }[];
}

export interface ComputedSlot {
  startAtUtc: number;
  endAtUtc: number;
  /** role → resource ids free for this slot (the write-path picks per strategy). */
  candidatesByRole: Record<string, string[]>;
}

/** Expand a resource's weekly windows into concrete free intervals over the range. */
export function resourceFreeIntervals(
  res: ResourceAvailability,
  fromUtc: number,
  toUtc: number
): Interval[] {
  const spans: Interval[] = [];
  for (const day of eachLocalDay(fromUtc, toUtc, res.timezone)) {
    for (const w of res.windows) {
      if (w.dayOfWeek !== day.weekday) continue;
      const dayStart = Date.UTC(day.year, day.month1 - 1, day.day);
      if (w.validFrom != null && dayStart < w.validFrom) continue;
      if (w.validTo != null && dayStart > w.validTo) continue;
      const start = localWallToUtc(day.year, day.month1, day.day, w.startMinute, res.timezone);
      const end = localWallToUtc(day.year, day.month1, day.day, w.endMinute, res.timezone);
      if (end <= start) continue;
      const clampedStart = Math.max(start, fromUtc);
      const clampedEnd = Math.min(end, toUtc);
      if (clampedEnd > clampedStart) spans.push({ start: clampedStart, end: clampedEnd });
    }
  }
  return subtractIntervals(mergeIntervals(spans), res.busy);
}

/** PURE: produce the offered slots. No DB, no clock — `nowUtc` is passed in. */
export function computeSlots(input: SlotComputationInput): ComputedSlot[] {
  const {
    fromUtc,
    toUtc,
    nowUtc,
    durationMs,
    bufferBeforeMs,
    bufferAfterMs,
    slotIntervalMs,
    minLeadMs,
    maxAdvanceMs,
    roles,
  } = input;

  const effFrom = Math.max(fromUtc, nowUtc + minLeadMs);
  const effTo = Math.min(toUtc, nowUtc + maxAdvanceMs);
  if (effTo <= effFrom || roles.length === 0 || slotIntervalMs <= 0) return [];

  // Precompute each resource's free intervals once.
  const freeByResource = new Map<string, Interval[]>();
  for (const r of roles) {
    for (const res of r.resources) {
      if (!freeByResource.has(res.resourceId)) {
        freeByResource.set(res.resourceId, resourceFreeIntervals(res, effFrom, effTo));
      }
    }
  }

  const slots: ComputedSlot[] = [];
  const firstStart = Math.ceil(effFrom / slotIntervalMs) * slotIntervalMs;
  for (
    let t = firstStart;
    t + durationMs <= effTo && slots.length < MAX_SLOTS;
    t += slotIntervalMs
  ) {
    const occupied: Interval = { start: t - bufferBeforeMs, end: t + durationMs + bufferAfterMs };
    const candidatesByRole: Record<string, string[]> = {};
    let everyRoleCovered = true;
    for (const r of roles) {
      const free = r.resources.filter((res) =>
        (freeByResource.get(res.resourceId) ?? []).some((iv) => contains(iv, occupied))
      );
      if (free.length === 0) {
        everyRoleCovered = false;
        break;
      }
      candidatesByRole[r.role] = free.map((res) => res.resourceId);
    }
    if (everyRoleCovered) {
      slots.push({ startAtUtc: t, endAtUtc: t + durationMs, candidatesByRole });
    }
  }
  return slots;
}

interface ResourceRequirement {
  role: string;
  kind: string;
  skillTags?: string[];
  count?: number;
}

/** DB-backed availability for a service over a date range, under tenant RLS. */
export async function getAvailability(
  tenantId: string,
  query: AvailabilityQuery,
  nowUtc: number
): Promise<ComputedSlot[]> {
  const fromUtc = Date.parse(query.from);
  const toUtc = Date.parse(query.to);

  return withTenant({ tenantId }, async (tx) => {
    const service = await tx.schedulingService.findFirst({
      where: { id: query.serviceId, deletedAt: null },
    });
    if (!service) throw new ServiceNotFoundError(query.serviceId);

    const requirements = (service.resourceRequirements as unknown as ResourceRequirement[]) ?? [];
    // A service with no explicit roles needs at least a notional one so it can be
    // staffed; default to a single "any staff" role.
    const roleSpecs: ResourceRequirement[] =
      requirements.length > 0 ? requirements : [{ role: 'staff', kind: 'staff' }];

    const locationId = query.locationId ?? service.locationId ?? undefined;

    const roles: SlotComputationInput['roles'] = [];
    for (const req of roleSpecs) {
      const resources = await tx.schedulingResource.findMany({
        where: {
          kind: req.kind,
          isActive: true,
          bookableOnline: true,
          deletedAt: null,
          ...(req.skillTags?.length ? { skillTags: { hasEvery: req.skillTags } } : {}),
          ...(locationId ? { locationId } : {}),
          ...(query.resourceId ? { id: query.resourceId } : {}),
          // Reservations: the resource (table) must fit the party.
          ...(query.partySize
            ? {
                AND: [
                  { OR: [{ capacityMin: null }, { capacityMin: { lte: query.partySize } }] },
                  { OR: [{ capacityMax: null }, { capacityMax: { gte: query.partySize } }] },
                ],
              }
            : {}),
        },
        select: { id: true, timezone: true },
      });
      if (resources.length === 0) {
        return []; // a role no resource can fill → nothing is bookable
      }

      const resourceAvail: ResourceAvailability[] = [];
      for (const res of resources) {
        const [windows, allocations, exceptions, busyBlocks] = await Promise.all([
          tx.availabilityWindow.findMany({ where: { resourceId: res.id } }),
          tx.bookingResource.findMany({
            where: {
              resourceId: res.id,
              status: { notIn: ['cancelled', 'no_show'] },
              startAt: { lt: new Date(toUtc) },
              endAt: { gt: new Date(fromUtc) },
            },
            select: { startAt: true, endAt: true },
          }),
          tx.availabilityException.findMany({
            where: {
              kind: { in: ['closed', 'blackout'] },
              startAt: { lt: new Date(toUtc) },
              endAt: { gt: new Date(fromUtc) },
              OR: [{ resourceId: res.id }, { resourceId: null }],
            },
            select: { startAt: true, endAt: true },
          }),
          tx.externalBusyBlock.findMany({
            where: {
              resourceId: res.id,
              startAt: { lt: new Date(toUtc) },
              endAt: { gt: new Date(fromUtc) },
            },
            select: { startAt: true, endAt: true },
          }),
        ]);
        const busy: Interval[] = [...allocations, ...exceptions, ...busyBlocks].map((b) => ({
          start: b.startAt.getTime(),
          end: b.endAt.getTime(),
        }));
        resourceAvail.push({
          resourceId: res.id,
          timezone: res.timezone,
          windows: windows.map((w) => ({
            dayOfWeek: w.dayOfWeek,
            startMinute: w.startMinute,
            endMinute: w.endMinute,
            validFrom: w.validFrom ? w.validFrom.getTime() : null,
            validTo: w.validTo ? w.validTo.getTime() : null,
          })),
          busy,
        });
      }
      roles.push({ role: req.role, resources: resourceAvail });
    }

    return computeSlots({
      fromUtc,
      toUtc,
      nowUtc,
      durationMs: service.durationMinutes * MINUTE_MS,
      bufferBeforeMs: service.bufferBeforeMin * MINUTE_MS,
      bufferAfterMs: service.bufferAfterMin * MINUTE_MS,
      slotIntervalMs: service.slotIntervalMin * MINUTE_MS,
      minLeadMs: service.minLeadMinutes * MINUTE_MS,
      maxAdvanceMs: service.maxAdvanceDays * DAY_MS,
      roles,
    });
  });
}
