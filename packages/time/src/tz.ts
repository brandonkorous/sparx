// Timezone-correct wall-clock math, on the platform's own Intl tz database.
//
// WHY THIS IS A SHARED PACKAGE AND NOT A HELPER IN ONE MODULE. Two unrelated
// promises in this platform are stated in LOCAL time and stored as UTC
// instants: when a resource is bookable (docs/79), and when a support desk is
// open to answer you (docs/144 §7.3). Both have to survive daylight saving,
// and getting that subtly wrong is invisible until twice a year. It lived in
// `@sparx/scheduling` while there was one consumer; the second one arriving is
// what makes copying it the wrong move — a duplicated hour-offset bug fixed in
// one copy is still a bug.
//
// NO DATE LIBRARY, DELIBERATELY. The tz database ships with the runtime and is
// updated with it; a vendored copy inside a dependency goes stale exactly when
// a government changes its DST rules.
//
// Nothing here reads the clock. Every function takes explicit instants, so
// callers are deterministic and their tests do not need a frozen clock.

const MS_PER_DAY = 86_400_000;

export interface LocalCalendarParts {
  year: number;
  /** 1-12, so it reads like a date rather than like a Date. */
  month1: number;
  day: number;
  /** 0 = Sunday .. 6 = Saturday. */
  weekday: number;
}

/**
 * The offset in ms to ADD to a UTC instant to get the wall-clock reading in
 * `tz`.
 *
 * Derived by asking Intl to format the instant in that zone and reading the
 * result back as if it were UTC — which is the only way to get a zone offset
 * out of the platform database without shipping a second copy of it.
 */
export function tzOffsetMs(utcMs: number, tz: string): number {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  const parts = dtf.formatToParts(new Date(utcMs));
  const get = (t: string): number => Number(parts.find((p) => p.type === t)?.value);
  let hour = get('hour');
  if (hour === 24) hour = 0; // some engines emit 24 for midnight
  const asIfUtc = Date.UTC(
    get('year'),
    get('month') - 1,
    get('day'),
    hour,
    get('minute'),
    get('second')
  );
  return asIfUtc - utcMs;
}

/**
 * Convert a local wall time (calendar Y/M/D + minutes from local midnight in
 * `tz`) to the UTC epoch ms.
 *
 * Two-pass offset resolution: the naive reading picks an offset, and the
 * instant that offset implies is re-checked, which is what makes the day of a
 * DST change come out right rather than an hour off for everything after the
 * transition. The ~1 ambiguous (clocks back) or nonexistent (clocks forward)
 * hour at the transition itself resolves to one consistent side; both callers
 * are stating an OPENING TIME, where an hour of ambiguity once a year is
 * immaterial and inventing a policy for it would be false precision.
 */
export function localWallToUtc(
  year: number,
  month1: number,
  day: number,
  minuteOfDay: number,
  tz: string
): number {
  const naiveUtc = Date.UTC(year, month1 - 1, day, Math.floor(minuteOfDay / 60), minuteOfDay % 60);
  const off1 = tzOffsetMs(naiveUtc, tz);
  const guess = naiveUtc - off1;
  const off2 = tzOffsetMs(guess, tz);
  return naiveUtc - off2;
}

/** The calendar Y/M/D + weekday of a UTC instant, read in `tz`. */
export function localCalendarParts(utcMs: number, tz: string): LocalCalendarParts {
  const local = new Date(utcMs + tzOffsetMs(utcMs, tz));
  return {
    year: local.getUTCFullYear(),
    month1: local.getUTCMonth() + 1,
    day: local.getUTCDate(),
    weekday: local.getUTCDay(),
  };
}

/**
 * How many minutes past local midnight a UTC instant reads as in `tz`.
 *
 * Seconds are DISCARDED rather than rounded. Every window in this platform is
 * expressed in whole minutes, and rounding up would place an instant one minute
 * inside a window it is actually before.
 */
export function localMinuteOfDay(utcMs: number, tz: string): number {
  const local = new Date(utcMs + tzOffsetMs(utcMs, tz));
  return local.getUTCHours() * 60 + local.getUTCMinutes();
}

/**
 * Iterate the calendar days spanned by `[fromUtc, toUtc]` as read in `tz`.
 *
 * Used to expand a weekly pattern over a query range. The guard is a
 * runaway-loop backstop, not a business limit — a range wide enough to hit it
 * is a caller bug.
 */
export function eachLocalDay(fromUtc: number, toUtc: number, tz: string): LocalCalendarParts[] {
  const out: LocalCalendarParts[] = [];
  const start = localCalendarParts(fromUtc, tz);
  let cursor = Date.UTC(start.year, start.month1 - 1, start.day);
  const endParts = localCalendarParts(toUtc, tz);
  const endUtcDay = Date.UTC(endParts.year, endParts.month1 - 1, endParts.day);
  let guard = 0;
  while (cursor <= endUtcDay && guard++ < 1000) {
    const d = new Date(cursor);
    out.push({
      year: d.getUTCFullYear(),
      month1: d.getUTCMonth() + 1,
      day: d.getUTCDate(),
      weekday: d.getUTCDay(),
    });
    cursor += MS_PER_DAY;
  }
  return out;
}

/** Step one calendar day forward from a local date, handling month and year
 *  ends. Pure calendar arithmetic — no zone involved, because "the next day" is
 *  the same question everywhere. */
export function nextLocalDay(parts: LocalCalendarParts): LocalCalendarParts {
  const d = new Date(Date.UTC(parts.year, parts.month1 - 1, parts.day) + MS_PER_DAY);
  return {
    year: d.getUTCFullYear(),
    month1: d.getUTCMonth() + 1,
    day: d.getUTCDate(),
    weekday: d.getUTCDay(),
  };
}

/** `YYYY-MM-DD` for a local date. The form holidays and date-only columns take,
 *  and the form a person recognises. */
export function formatLocalDate(parts: LocalCalendarParts): string {
  const mm = String(parts.month1).padStart(2, '0');
  const dd = String(parts.day).padStart(2, '0');
  return `${String(parts.year)}-${mm}-${dd}`;
}
