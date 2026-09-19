// What time a scheduled rule runs, on the clock the reader owns.
//
// ── THE LINE THIS EXISTS FOR ────────────────────────────────────────────────
//
// The automations list said:
//
//     Every day at 00:00 UTC
//
// Two problems in five words. "UTC" is a word a shop owner has no reason to
// know and nothing on the screen said what it was. And even knowing it, the
// figure is not actionable: for a business seven hours behind, that rule runs at
// five in the afternoon the day before. The one thing the sentence exists to
// tell her is the one thing it does not.
//
// The console already knows the answer. `useBusinessZone()` has existed since
// issue 081, when a salon set her week to 09:00-17:30 and her diary showed a
// full head of color at three in the morning. Finance, Invoices and Bookings all
// read it. Automations wrote `UTC` by hand.
//
// ── WHAT IS STORED, AND WHY THE NUMBER CAN MOVE ─────────────────────────────
//
// The engine stores a MINUTE OF THE UTC DAY and ticks against it
// (`automation/src/engine/schedule-tick.ts` compares `minuteOfDayUtc(now)`).
// There is no zone on the record. So a rule set at "7:00pm your time" is really
// a fixed moment in the UTC day, and when the clocks change it becomes 6:00pm or
// 8:00pm on her clock.
//
// This module does NOT hide that. It converts with the offset in force on the
// day being asked about, so the screen always says when the rule will actually
// run next. A number that appears to have moved by an hour in November is the
// truth about a UTC-stored schedule; a number frozen at what she typed would be
// the lie.
//
// Fixing it properly means storing a zone beside the minute, which is a server
// model change and a migration. Recorded in issue 613.

/**
 * Whose clock a time should be shown on.
 *
 * Passed rather than read, and REQUIRED rather than optional, so a new caller
 * has to answer the question. An optional zone that quietly falls back to UTC is
 * the same screen this file exists to replace, with a nicer signature.
 */
export interface ReaderClock {
  /** `useBusinessZone()` verbatim, all three of its answers. */
  zone: string | null | undefined;
  /** This computer's zone, used only when the business has not set one, and
   *  said out loud when it is. */
  device: string;
}

export interface DailySchedule {
  cadence: 'daily' | 'weekly' | 'monthly' | 'interval' | 'once';
  atMinuteUtc: number;
  dayOfWeek?: number;
  dayOfMonth?: number;
  everyMinutes?: number;
  at?: string;
}

const MINUTES_IN_DAY = 1440;

/**
 * How far ahead of UTC a zone is, in minutes, at a given instant.
 *
 * Done with `Intl` rather than a date library because the console has no date
 * library and this is the one calculation that needs one. Formatting the instant
 * IN the zone and reading it back AS IF it were UTC gives the offset; it is the
 * standard trick and it handles daylight saving, because the formatter does.
 *
 * Returns 0 for a zone the runtime does not recognize. A wrong zone name should
 * show UTC rather than throw inside a table cell.
 */
export function zoneOffsetMinutes(zone: string, at: Date): number {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: zone,
      hour12: false,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }).formatToParts(at);
    const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? '0');
    const asIfUtc = Date.UTC(
      get('year'),
      get('month') - 1,
      get('day'),
      get('hour') % 24,
      get('minute'),
      get('second')
    );
    return Math.round((asIfUtc - at.getTime()) / 60_000);
  } catch {
    return 0;
  }
}

const wrap = (minute: number): number =>
  ((minute % MINUTES_IN_DAY) + MINUTES_IN_DAY) % MINUTES_IN_DAY;

/** A minute of the UTC day, on the reader's clock. */
export function utcMinuteToLocal(minuteUtc: number, zone: string, on: Date = new Date()): number {
  return wrap(minuteUtc + zoneOffsetMinutes(zone, on));
}

/** The reverse, for a time somebody just typed. */
export function localMinuteToUtc(minuteLocal: number, zone: string, on: Date = new Date()): number {
  return wrap(minuteLocal - zoneOffsetMinutes(zone, on));
}

/**
 * A time of day as a person says it.
 *
 * "midnight" and "noon" by name: "12:00am" is the one clock reading people
 * regularly get backwards, and midnight is the most common schedule there is.
 */
export function clockLabel(minuteOfDay: number): string {
  const minute = wrap(Math.round(minuteOfDay));
  if (minute === 0) return 'midnight';
  if (minute === 12 * 60) return 'noon';
  const hour24 = Math.floor(minute / 60);
  const minutes = minute % 60;
  const suffix = hour24 < 12 ? 'am' : 'pm';
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
  return `${String(hour12)}:${String(minutes).padStart(2, '0')}${suffix}`;
}

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/** 1st, 2nd, 3rd, 4th … because "On day 3 of the month" is not how anyone says it. */
export function ordinal(n: number): string {
  const rest = n % 100;
  if (rest >= 11 && rest <= 13) return `${String(n)}th`;
  switch (n % 10) {
    case 1:
      return `${String(n)}st`;
    case 2:
      return `${String(n)}nd`;
    case 3:
      return `${String(n)}rd`;
    default:
      return `${String(n)}th`;
  }
}

/**
 * The whole sentence.
 *
 * `zone` is `useBusinessZone()` verbatim, all three of its answers:
 *   a string   the business set one, so the time is simply stated
 *   `null`     nobody set one, so this computer's clock is used AND SAID, since
 *              an unset value that reads like a chosen one is issue 178
 *   `undefined` still loading; the caller should not be rendering a time yet,
 *              but if it does it gets the honest holding line
 */
export function scheduleLine(
  schedule: DailySchedule,
  clock: ReaderClock,
  on: Date = new Date()
): string {
  const { zone, device } = clock;
  if (schedule.cadence === 'interval') {
    const every = schedule.everyMinutes ?? 0;
    if (every === 60) return 'Every hour';
    if (every % 60 === 0 && every > 60) return `Every ${String(every / 60)} hours`;
    return `Every ${String(every)} minutes`;
  }
  if (zone === undefined) return 'Checking what time that is for you…';

  const usingDevice = zone === null;
  const effective = zone ?? device;
  const suffix = usingDevice ? ' (this computer’s clock)' : '';

  if (schedule.cadence === 'once') {
    if (!schedule.at) return 'Once';
    const at = new Date(schedule.at);
    if (Number.isNaN(at.getTime())) return 'Once';
    const minutes = utcMinuteToLocal(at.getUTCHours() * 60 + at.getUTCMinutes(), effective, at);
    const day = new Intl.DateTimeFormat('en-US', {
      timeZone: effective,
      month: 'short',
      day: 'numeric',
    }).format(at);
    return `Once, on ${day} at ${clockLabel(minutes)}${suffix}`;
  }

  const local = clockLabel(utcMinuteToLocal(schedule.atMinuteUtc, effective, on));
  switch (schedule.cadence) {
    case 'daily':
      return `Every day at ${local}${suffix}`;
    case 'weekly':
      return `Every ${DAY_NAMES[schedule.dayOfWeek ?? 0] ?? 'week'} at ${local}${suffix}`;
    case 'monthly':
      return `On the ${ordinal(schedule.dayOfMonth ?? 1)} of the month at ${local}${suffix}`;
    default:
      return `At ${local}${suffix}`;
  }
}

/**
 * A stored instant as the wall clock reads it in a zone: `YYYY-MM-DDTHH:mm`,
 * which is the shape a `datetime-local` input wants.
 */
export function wallTimeInZone(iso: string, zone: string): string {
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return '';
  const shifted = new Date(at.getTime() + zoneOffsetMinutes(zone, at) * 60_000);
  return shifted.toISOString().slice(0, 16);
}

/**
 * The reverse: a wall time somebody typed, in their zone, as a stored instant.
 *
 * Applied twice on purpose. The first pass uses the offset in force at the
 * literal reading, which is the wrong instant by up to a day; the second uses
 * the offset at the answer. Without the second pass a time typed within a day of
 * a clock change lands an hour out, and that is the one week anybody would
 * notice.
 */
export function isoFromWallTime(wall: string, zone: string): string {
  if (!wall) return '';
  const asIfUtc = new Date(`${wall}:00.000Z`);
  if (Number.isNaN(asIfUtc.getTime())) return '';
  const first = new Date(asIfUtc.getTime() - zoneOffsetMinutes(zone, asIfUtc) * 60_000);
  return new Date(asIfUtc.getTime() - zoneOffsetMinutes(zone, first) * 60_000).toISOString();
}

/** `HH:mm` for a minute of the day, for a `type="time"` input. */
export function hhmm(minuteOfDay: number): string {
  const minute = ((Math.round(minuteOfDay) % 1440) + 1440) % 1440;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(Math.floor(minute / 60))}:${pad(minute % 60)}`;
}

/** The reverse of `hhmm`. An unparseable value reads as midnight, which is what
 *  an empty time input already means to the browser. */
export function minuteFromHhmm(value: string): number {
  const [h, m] = value.split(':');
  const minute = Number(h) * 60 + Number(m);
  return Number.isFinite(minute) ? ((minute % 1440) + 1440) % 1440 : 0;
}

/** What to put under a time field so nobody has to guess whose clock it is. */
export function whoseClockHint(clock: ReaderClock): string {
  if (clock.zone === undefined) return 'Checking which clock this is on…';
  if (clock.zone === null) {
    return `Times here are on this computer’s clock (${clock.device}). Set your business hours zone in Business details and this follows it.`;
  }
  return `Times here are on your business clock (${clock.zone}).`;
}
