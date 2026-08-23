// WHY a resource cannot take a span — and it is never only "somebody took it".
//
// Three different things stop a booking, and they have three different remedies:
//
//   busy    the resource already has something there  → pick another time
//   closed  a closure covers the date                 → pick another WEEK, or lift the closure
//   hours   nobody works then                         → book inside the hours, or change them
//
// For a long time all three came back as SlotUnavailableError, so a salon shut
// for its summer week was told "that time was taken while you were filling this
// in" (issue 150) — and the third was not checked at all, so the console booked
// straight through a lunch break the same person's website refuses (issue 149).
//
// The window check is deliberately the SAME shape the read path uses: the
// buffered span must sit inside one free interval of `resourceFreeIntervals`
// (availability.ts `computeSlots` uses `contains(iv, occupied)` on the same
// intervals). That is what makes the console and the customer's booking page
// agree about when a business is open, which is the whole point.

import type { TxClient } from '@wizeworks/db';

import {
  buildResourceOverrides,
  resourceFreeIntervals,
  type ResourceAvailability,
} from './availability';
import {
  ClosedForDateError,
  OutsideWorkingHoursError,
  SlotUnavailableError,
  type SchedulingError,
} from './errors';
import { contains, eachLocalDay, localWallToUtc, overlaps, type Interval } from './time';

const DAY_MS = 24 * 60 * 60 * 1000;
const RELEASED = ['cancelled', 'no_show'] as const;

/** Why one resource is unavailable for a span. */
export type BlockReason =
  | { kind: 'busy' }
  | { kind: 'closed'; label: string | null; start: Date; end: Date }
  | { kind: 'hours'; resourceName: string; timezone: string; open: Interval[] };

interface Candidate {
  id: string;
  name: string;
  timezone: string;
}

/** The local day `at` falls on, as a UTC interval. */
function localDayOf(at: number, timezone: string): Interval {
  const [day] = eachLocalDay(at, at + 1, timezone);
  if (!day) return { start: at, end: at + DAY_MS };
  return {
    start: localWallToUtc(day.year, day.month1, day.day, 0, timezone),
    end: localWallToUtc(day.year, day.month1, day.day, 24 * 60, timezone),
  };
}

/**
 * Resources whose working hours do not cover `span`.
 *
 * A resource with NO windows at all is skipped rather than treated as shut. It
 * has not answered the question of when it works, and an absent answer must not
 * be rendered as a "closed" one — a tenant who never opened the hours screen
 * would otherwise find every booking refused overnight.
 */
async function outsideHours(
  tx: TxClient,
  candidates: Candidate[],
  span: Interval
): Promise<Map<string, BlockReason>> {
  const out = new Map<string, BlockReason>();
  const ids = candidates.map((c) => c.id);
  const [windows, customHours] = await Promise.all([
    tx.availabilityWindow.findMany({ where: { resourceId: { in: ids } } }),
    tx.availabilityException.findMany({
      where: {
        kind: 'custom_hours',
        startAt: { lt: new Date(span.end + DAY_MS) },
        endAt: { gt: new Date(span.start - DAY_MS) },
        OR: [{ resourceId: { in: ids } }, { resourceId: null }],
      },
      select: { resourceId: true, startAt: true, endAt: true, meta: true },
    }),
  ]);

  for (const candidate of candidates) {
    const mine = windows.filter((w) => w.resourceId === candidate.id);
    if (mine.length === 0) continue;
    const availability: ResourceAvailability = {
      resourceId: candidate.id,
      timezone: candidate.timezone,
      windows: mine.map((w) => ({
        dayOfWeek: w.dayOfWeek,
        startMinute: w.startMinute,
        endMinute: w.endMinute,
        validFrom: w.validFrom ? w.validFrom.getTime() : null,
        validTo: w.validTo ? w.validTo.getTime() : null,
      })),
      busy: [],
      overrides: buildResourceOverrides(
        customHours.filter((c) => c.resourceId === null || c.resourceId === candidate.id)
      ),
    };
    // A day either side, so a window is never clipped by the query range itself.
    const free = resourceFreeIntervals(availability, span.start - DAY_MS, span.end + DAY_MS);
    if (free.some((interval) => contains(interval, span))) continue;
    const today = localDayOf(span.start, candidate.timezone);
    out.set(candidate.id, {
      kind: 'hours',
      resourceName: candidate.name,
      timezone: candidate.timezone,
      open: free.filter((interval) => overlaps(interval, today)),
    });
  }
  return out;
}

/**
 * Every candidate that cannot take `span`, with the reason.
 *
 * Order matters: a closure is a fact about the whole date and beats a clash, and
 * a clash is a fact about this instant and beats "not working then" — a resource
 * that is both off duty and booked is more usefully reported as booked.
 */
export async function blockedResources(
  tx: TxClient,
  candidates: Candidate[],
  span: Interval,
  opts: { ignoreBookingId?: string } = {}
): Promise<Map<string, BlockReason>> {
  if (candidates.length === 0) return new Map();
  const ids = candidates.map((c) => c.id);
  const [allocations, busyBlocks, closures, hours] = await Promise.all([
    tx.bookingResource.findMany({
      where: {
        resourceId: { in: ids },
        status: { notIn: [...RELEASED] },
        startAt: { lt: new Date(span.end) },
        endAt: { gt: new Date(span.start) },
        // A booking being MOVED must not be reported as clashing with itself.
        ...(opts.ignoreBookingId ? { bookingId: { not: opts.ignoreBookingId } } : {}),
      },
      select: { resourceId: true },
    }),
    tx.externalBusyBlock.findMany({
      where: {
        resourceId: { in: ids },
        startAt: { lt: new Date(span.end) },
        endAt: { gt: new Date(span.start) },
      },
      select: { resourceId: true },
    }),
    tx.availabilityException.findMany({
      where: {
        kind: { in: ['closed', 'blackout'] },
        startAt: { lt: new Date(span.end) },
        endAt: { gt: new Date(span.start) },
        OR: [{ resourceId: { in: ids } }, { resourceId: null }],
      },
      select: { resourceId: true, reason: true, startAt: true, endAt: true },
    }),
    outsideHours(tx, candidates, span),
  ]);

  const blocked = new Map<string, BlockReason>(hours);
  for (const allocation of allocations) blocked.set(allocation.resourceId, { kind: 'busy' });
  for (const block of busyBlocks) blocked.set(block.resourceId, { kind: 'busy' });
  for (const closure of closures) {
    const reason: BlockReason = {
      kind: 'closed',
      label: closure.reason,
      start: closure.startAt,
      end: closure.endAt,
    };
    // A tenant/location-wide closure (no resourceId) shuts every candidate.
    if (closure.resourceId === null) for (const id of ids) blocked.set(id, reason);
    else blocked.set(closure.resourceId, reason);
  }
  return blocked;
}

function dayText(at: number | Date, timezone: string): string {
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: timezone,
  }).format(at);
}

function clockText(at: number, timezone: string): string {
  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: timezone,
  }).format(at);
}

function hoursText(open: Interval[], timezone: string): string {
  return open
    .map((i) => `${clockText(i.start, timezone)} to ${clockText(i.end, timezone)}`)
    .join(' and ');
}

function closedText(reason: Extract<BlockReason, { kind: 'closed' }>, timezone: string): string {
  const named = reason.label ? `"${reason.label}"` : 'a closure';
  const from = dayText(reason.start, timezone);
  // The stored end is the last INSTANT of the closure, so a week shut through
  // Saturday ends at 23:59:59 that night; stepping back a second names the day
  // an owner would name rather than the small hours of the day after.
  const to = dayText(new Date(reason.end.getTime() - 1000), timezone);
  return `Nothing can be booked then: ${named} runs from ${from} to ${to}.`;
}

/**
 * The sentence for a request nobody could take.
 *
 * A closure is a fact about the date and outranks everything; being off duty
 * outranks nothing, so it is only the answer when it is the ONLY answer. Where
 * the reasons are mixed — one chair busy, the other off — "taken" is the closer
 * truth, and it is also the one the operator can act on.
 */
export function blockedError(
  reasons: BlockReason[],
  span: Interval,
  fallbackTimezone: string
): SchedulingError {
  const closed = reasons.find((r) => r.kind === 'closed');
  if (closed) return new ClosedForDateError(closedText(closed, fallbackTimezone));

  const hours = reasons.filter((r) => r.kind === 'hours');
  const first = hours[0];
  if (!first || hours.length !== reasons.length) return new SlotUnavailableError();

  const when = dayText(span.start, first.timezone);
  const clock = clockText(span.start, first.timezone);

  // More than one candidate was ruled out, so nobody was singled out either: an
  // operator who pinned nobody did not ask about Dara, and naming her reads as an
  // answer to a question that was not put. Their hours differ, so there is no one
  // set to quote back — the day and the time are what they have in common.
  if (hours.length > 1) {
    const anyOpen = hours.some((h) => h.open.length > 0);
    return new OutsideWorkingHoursError(
      anyOpen ? `No one is working at ${clock} on ${when}.` : `No one is working on ${when}.`
    );
  }

  if (first.open.length === 0) {
    return new OutsideWorkingHoursError(`${first.resourceName} is not working on ${when}.`);
  }
  return new OutsideWorkingHoursError(
    `${first.resourceName} is not working at ${clock} on ${when}. The hours that day are ${hoursText(first.open, first.timezone)}.`
  );
}
