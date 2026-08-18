// The support clock (docs/144 §7.3) — pure, no I/O, no `Date.now()`.
//
// A support promise a business cannot measure is a slogan. This is the
// arithmetic that turns "we reply to urgent requests within an hour" into an
// instant a list can color before the promise is missed, rather than a number
// in a report afterwards.
//
// EVERYTHING IS BUSINESS TIME. Sixty minutes on a desk open 9–5 means an email
// arriving at 4:45pm is due at 9:45 the next morning. Measuring that promise on
// a wall clock gets it wrong in the customer's favour every evening and then
// wrong in the business's favour every Monday, which is worse than either: the
// numbers stop meaning anything and people stop reading them.
//
// The counting is done in REAL elapsed milliseconds between UTC instants, not
// in local minute arithmetic. That is what makes the twice-yearly clock change
// come out right: a desk open 9–5 across a spring-forward boundary is open for
// seven real hours that day, and a promise measured in real time is kept or
// missed in real time.

import type { LocalCalendarParts } from '@wizeworks/time';
import { formatLocalDate, localCalendarParts, localWallToUtc, nextLocalDay } from '@wizeworks/time';

const MS_PER_MINUTE = 60_000;

/**
 * A runaway-loop backstop, not a business limit.
 *
 * A calendar with at least one weekly window always reaches an open day within
 * about ten weeks even with every holiday a policy can declare spent
 * consecutively, so reaching this means the calendar has no open time at all —
 * a configuration error worth failing loudly on rather than hanging a request.
 */
const MAX_DAYS_SCANNED = 3660;

export interface BusinessHourWindow {
  /** 0 = Sunday .. 6 = Saturday. */
  day: number;
  /** Minutes from local midnight, inclusive. */
  startMinute: number;
  /** Minutes from local midnight, EXCLUSIVE. May be 1440 — a desk open until
   *  midnight is a real thing, and 1439 quietly loses a minute a day. */
  endMinute: number;
}

export interface BusinessCalendar {
  /** IANA zone. Business hours are local by definition. */
  timezone: string;
  /**
   * The weekly pattern. EMPTY MEANS 24/7 — the honest reading of "this business
   * declared no hours" when the question is how fast they answer. Holidays
   * still apply to a 24/7 calendar: a business open around the clock can still
   * shut on Christmas Day, and the two facts are independent.
   */
  windows: BusinessHourWindow[];
  /** `YYYY-MM-DD` local dates the desk is shut, whatever the weekly pattern says. */
  holidays: string[];
}

/** One day's open time, as UTC instants. */
interface OpenSpan {
  start: number;
  end: number;
}

/**
 * The open spans on one local calendar day, sorted and clipped to real instants.
 *
 * Both boundaries go through `localWallToUtc`, so a day containing a DST
 * transition produces spans of the correct REAL length rather than the length
 * its local readings suggest.
 */
function spansOnDay(day: LocalCalendarParts, calendar: BusinessCalendar): OpenSpan[] {
  if (calendar.holidays.includes(formatLocalDate(day))) return [];

  // No declared pattern = open all day, every day (minus holidays, above).
  const windows =
    calendar.windows.length === 0
      ? [{ day: day.weekday, startMinute: 0, endMinute: 1440 }]
      : calendar.windows.filter((w) => w.day === day.weekday);

  return windows
    .map((w) => ({
      start: localWallToUtc(day.year, day.month1, day.day, w.startMinute, calendar.timezone),
      end: localWallToUtc(day.year, day.month1, day.day, w.endMinute, calendar.timezone),
    }))
    .filter((s) => s.end > s.start)
    .sort((a, b) => a.start - b.start);
}

/**
 * The instant `minutes` of OPEN time after `from`.
 *
 * If `from` falls outside business hours the clock starts when the desk next
 * opens — which is the reading a customer would recognise: a request sent at
 * 3am on Sunday is not already an hour late by 4am.
 *
 * `minutes <= 0` returns `from` unchanged rather than throwing. A zero-minute
 * promise is refused at the schema boundary, and a clock is not the place to
 * relitigate that.
 */
export function addBusinessMinutes(from: Date, minutes: number, calendar: BusinessCalendar): Date {
  if (minutes <= 0) return new Date(from.getTime());

  let remainingMs = minutes * MS_PER_MINUTE;
  const cursor = from.getTime();
  let day = localCalendarParts(cursor, calendar.timezone);

  for (let scanned = 0; scanned < MAX_DAYS_SCANNED; scanned++) {
    for (const span of spansOnDay(day, calendar)) {
      // Windows that finished before the clock started contribute nothing.
      if (span.end <= cursor) continue;
      const opensAt = Math.max(span.start, cursor);
      const availableMs = span.end - opensAt;
      if (availableMs >= remainingMs) return new Date(opensAt + remainingMs);
      remainingMs -= availableMs;
    }
    day = nextLocalDay(day);
  }

  throw new Error(
    `This schedule has no open hours to count against — check the policy's business hours and holidays (timezone ${calendar.timezone}).`
  );
}

/**
 * Open minutes elapsed between two instants. The inverse question to the one
 * above, and the one a report asks: how long did we actually take?
 *
 * Returns whole minutes, rounded down, and 0 when `to` is at or before `from`.
 */
export function businessMinutesBetween(from: Date, to: Date, calendar: BusinessCalendar): number {
  const start = from.getTime();
  const end = to.getTime();
  if (end <= start) return 0;

  let openMs = 0;
  let day = localCalendarParts(start, calendar.timezone);
  const lastDay = localCalendarParts(end, calendar.timezone);
  const lastKey = formatLocalDate(lastDay);

  for (let scanned = 0; scanned < MAX_DAYS_SCANNED; scanned++) {
    for (const span of spansOnDay(day, calendar)) {
      const overlapStart = Math.max(span.start, start);
      const overlapEnd = Math.min(span.end, end);
      if (overlapEnd > overlapStart) openMs += overlapEnd - overlapStart;
    }
    // Stop AFTER processing the day `to` falls on — a span that opened on the
    // previous local day can still run into it, so the check has to come last.
    if (formatLocalDate(day) === lastKey) break;
    day = nextLocalDay(day);
  }

  return Math.floor(openMs / MS_PER_MINUTE);
}

/** Is the desk open at this instant? Drives the honest empty state on a queue —
 *  "nothing is overdue, and we are closed right now" reads very differently
 *  from "nothing is overdue". */
export function isOpenAt(instant: Date, calendar: BusinessCalendar): boolean {
  const at = instant.getTime();
  const today = localCalendarParts(at, calendar.timezone);
  // Yesterday too: a window running to midnight ends at the boundary, and one
  // that spans it is stored as two windows, so only the current local day and
  // the one before it can contain this instant.
  for (const day of [previousLocalDay(today), today]) {
    for (const span of spansOnDay(day, calendar)) {
      if (span.start <= at && at < span.end) return true;
    }
  }
  return false;
}

function previousLocalDay(parts: LocalCalendarParts): LocalCalendarParts {
  const d = new Date(Date.UTC(parts.year, parts.month1 - 1, parts.day) - 86_400_000);
  return {
    year: d.getUTCFullYear(),
    month1: d.getUTCMonth() + 1,
    day: d.getUTCDate(),
    weekday: d.getUTCDay(),
  };
}

// ─────────────────────────────────────────────────────────────────────────
// Applying a policy to one request
// ─────────────────────────────────────────────────────────────────────────

export interface SlaTarget {
  priority: string;
  firstResponseMinutes: number | null;
  resolutionMinutes: number | null;
}

export interface SlaPolicyShape {
  timezone: string;
  windows: BusinessHourWindow[];
  holidays: string[];
  /** The point in the budget where a request goes amber. */
  warnAtPercent: number;
  targets: SlaTarget[];
}

export interface SlaDueDates {
  firstResponseDueAt: Date | null;
  firstResponseWarnAt: Date | null;
  resolutionDueAt: Date | null;
  resolutionWarnAt: Date | null;
}

/** No policy, or no target for this priority: every date is null. A request
 *  nobody promised anything about is a normal thing, not an error, and must not
 *  render as overdue. */
const NO_DATES: SlaDueDates = {
  firstResponseDueAt: null,
  firstResponseWarnAt: null,
  resolutionDueAt: null,
  resolutionWarnAt: null,
};

/**
 * The four instants a request is measured against, from the policy that applies
 * to its priority.
 *
 * Computed ONCE, at creation (and again if the priority changes, because the
 * promise attached to an urgent request is not the one attached to a low one).
 * Never recomputed on read: a policy edited in March must not silently move
 * what was promised in February.
 */
export function computeDueDates(
  openedAt: Date,
  priority: string,
  policy: SlaPolicyShape | null
): SlaDueDates {
  if (!policy) return NO_DATES;
  const target = policy.targets.find((t) => t.priority === priority);
  if (!target) return NO_DATES;

  const calendar: BusinessCalendar = {
    timezone: policy.timezone,
    windows: policy.windows,
    holidays: policy.holidays,
  };

  // The warn mark is a fraction of the BUDGET, not of the elapsed wall clock —
  // which is the whole reason it is computed here and stored, rather than
  // derived later from the due date.
  const warn = (minutes: number): number =>
    Math.max(1, Math.floor((minutes * policy.warnAtPercent) / 100));

  const first = target.firstResponseMinutes;
  const resolution = target.resolutionMinutes;

  return {
    firstResponseDueAt: first ? addBusinessMinutes(openedAt, first, calendar) : null,
    firstResponseWarnAt: first ? addBusinessMinutes(openedAt, warn(first), calendar) : null,
    resolutionDueAt: resolution ? addBusinessMinutes(openedAt, resolution, calendar) : null,
    resolutionWarnAt: resolution ? addBusinessMinutes(openedAt, warn(resolution), calendar) : null,
  };
}

// ─────────────────────────────────────────────────────────────────────────
// Reading the clock on a request that already exists
// ─────────────────────────────────────────────────────────────────────────

/**
 * What a list should SAY about one request's clock.
 *
 * `none` — nothing was promised. `met` — answered inside the promise.
 * `ok` — running, with time in hand. `warning` — past the warn mark.
 * `breached` — the promise was missed.
 *
 * These map straight onto color (RULE #4): breached is danger, warning is
 * amber, met is success, ok is neutral. A support queue where the state is
 * carried by the color can be read across a room; one where it is carried by
 * a word has to be read a row at a time.
 */
export type SlaState = 'none' | 'ok' | 'warning' | 'breached' | 'met';

export interface SlaClockView {
  state: SlaState;
  dueAt: Date | null;
  /** Real minutes until the promise is missed; negative once it has been.
   *  Null when nothing was promised or the promise is already settled. */
  minutesRemaining: number | null;
}

/** The state of ONE promise: `settledAt` is when it was kept (first responded,
 *  or resolved), if it has been. */
export function readClock(
  now: Date,
  dueAt: Date | null,
  warnAt: Date | null,
  settledAt: Date | null
): SlaClockView {
  if (!dueAt) return { state: 'none', dueAt: null, minutesRemaining: null };
  // Kept — including kept LATE. A request answered after its due time was still
  // answered, and showing it as permanently breached on the queue would bury
  // the ones still waiting. The breach is recorded on the row for reporting.
  if (settledAt) return { state: 'met', dueAt, minutesRemaining: null };

  const remaining = Math.round((dueAt.getTime() - now.getTime()) / MS_PER_MINUTE);
  if (now >= dueAt) return { state: 'breached', dueAt, minutesRemaining: remaining };
  if (warnAt && now >= warnAt) return { state: 'warning', dueAt, minutesRemaining: remaining };
  return { state: 'ok', dueAt, minutesRemaining: remaining };
}
