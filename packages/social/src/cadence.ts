// Posting cadence — turning "Tuesdays at 9am" into real instants.
//
// A posting slot is a recurring LOCAL time, not a timestamp. That distinction is the
// whole point: 9am has to stay 9am across a daylight-saving boundary, because the
// audience's morning does not move an hour because the clocks did. So a slot stores
// `weekday` + `minuteOfDay` + an IANA timezone, and this module resolves it to the
// actual instants it lands on.
//
// Pure, dependency-free (Intl only), and shared: the api-rest slot filler schedules
// against these instants, and the calendar draws the same ones as empty slots, so the
// plan a person sees is literally the plan that runs.
//
// Its dependency-free-ness is load-bearing, not incidental. This file is published as its
// own `@sparx/social/cadence` entrypoint so the browser can import it WITHOUT pulling the
// package barrel — which re-exports the adapters, the registry and the renderer, and whose
// `./thing.js` import specifiers Turbopack will not rewrite to `.ts`. Keep this file free
// of relative imports: adding one puts the workbench build back where it was.

/** One recurring slot in the week, as the DB stores it. */
export interface CadenceSlot {
  /** 0 = Sunday … 6 = Saturday, matching `Date.getDay()`. */
  weekday: number;
  /** Minutes past local midnight — 9am is 540. */
  minuteOfDay: number;
  /** IANA zone, e.g. `America/Denver`. */
  timezone: string;
}

/**
 * How far a zone is from UTC at a given instant, in milliseconds.
 *
 * There is no direct API for this, so we format the instant AS that zone's wall clock,
 * read it back as if it were UTC, and take the difference. It is the standard trick and
 * it handles DST correctly, because the formatter applies whichever offset is actually
 * in force at that instant.
 */
export function zoneOffsetMs(instant: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(instant);

  const read = (type: Intl.DateTimeFormatPartTypes): number =>
    Number(parts.find((p) => p.type === type)?.value ?? '0');

  const asUtc = Date.UTC(
    read('year'),
    read('month') - 1,
    read('day'),
    // Some locales render midnight as hour 24; normalize it.
    read('hour') % 24,
    read('minute'),
    read('second')
  );
  return asUtc - instant.getTime();
}

/**
 * The instant at which a given local wall time occurs in a zone.
 *
 * Two passes: the first guesses the offset from the naive timestamp, the second
 * re-reads it at the corrected instant. That second pass is what makes the hour either
 * side of a DST transition come out right — the offset at the naive time and the offset
 * at the true instant differ exactly there.
 */
export function wallTimeToInstant(
  year: number,
  month: number,
  day: number,
  minuteOfDay: number,
  timeZone: string
): Date {
  const naive = Date.UTC(year, month - 1, day, Math.floor(minuteOfDay / 60), minuteOfDay % 60);
  const firstGuess = new Date(naive - zoneOffsetMs(new Date(naive), timeZone));
  return new Date(naive - zoneOffsetMs(firstGuess, timeZone));
}

/** The zone-local calendar date + weekday of an instant. */
export function zonedDateParts(
  instant: Date,
  timeZone: string
): { year: number; month: number; day: number; weekday: number } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'short',
  }).formatToParts(instant);

  const read = (type: Intl.DateTimeFormatPartTypes): string =>
    parts.find((p) => p.type === type)?.value ?? '';

  const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  return {
    year: Number(read('year')),
    month: Number(read('month')),
    day: Number(read('day')),
    weekday: Math.max(0, WEEKDAYS.indexOf(read('weekday'))),
  };
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Every instant this slot lands on between `from` and `from + withinDays`.
 *
 * Walks zone-local days rather than adding 7×24h to a start point, because a week is not
 * always 168 hours in a zone that observes DST — stepping in local days and re-resolving
 * the wall time each hit is what keeps a 9am slot at 9am.
 */
export function slotOccurrences(slot: CadenceSlot, from: Date, withinDays: number): Date[] {
  const out: Date[] = [];
  for (let i = 0; i <= withinDays; i += 1) {
    // Probe midday, so a DST shift near midnight can't push the probe onto the
    // neighbouring local date and skip or double a day.
    const probe = new Date(from.getTime() + i * DAY_MS + 12 * 60 * 60 * 1000);
    const parts = zonedDateParts(probe, slot.timezone);
    if (parts.weekday !== slot.weekday) continue;

    const instant = wallTimeToInstant(
      parts.year,
      parts.month,
      parts.day,
      slot.minuteOfDay,
      slot.timezone
    );
    if (instant.getTime() > from.getTime()) out.push(instant);
  }
  return out.sort((a, b) => a.getTime() - b.getTime());
}

/** The next single instant this slot lands on after `from`, or null within the window. */
export function nextSlotOccurrence(slot: CadenceSlot, from: Date, withinDays = 14): Date | null {
  return slotOccurrences(slot, from, withinDays)[0] ?? null;
}

/** "Tuesdays at 9:00 AM" — the slot in words, for the cadence UI. */
export function describeSlot(slot: CadenceSlot, locale?: string): string {
  const DAY_NAMES = [
    'Sundays',
    'Mondays',
    'Tuesdays',
    'Wednesdays',
    'Thursdays',
    'Fridays',
    'Saturdays',
  ];
  // Any date works — only the clock part is rendered.
  const sample = new Date(
    Date.UTC(2024, 0, 7, Math.floor(slot.minuteOfDay / 60), slot.minuteOfDay % 60)
  );
  const time = new Intl.DateTimeFormat(locale, {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'UTC',
  }).format(sample);
  return `${DAY_NAMES[slot.weekday] ?? 'Every week'} at ${time}`;
}
