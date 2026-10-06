// A TIME BOX ON THE BUSINESS'S CLOCK, not this computer's.
//
// ── THE LINE THIS EXISTS FOR ────────────────────────────────────────────────
//
// Renée booked a Diesel oil change for Saturday, October 3 at 9:00 AM in Salt
// Lake City (sparx persona issue 086). The staff booking pane's header said
// 9:00 AM. Its "Move it" box, two inches lower, said 08:00 AM, because the
// console was open on a computer set to Pacific time.
//
// `<input type="datetime-local">` has no zone. It holds a wall time, and the
// only way the browser has to turn a wall time into a moment is THIS computer's
// zone. So every booking box in both consoles read and wrote the computer's
// clock while the header, the diary and every email used the business's. An
// owner checking the books from a laptop on holiday, or a shop whose office
// computer was set up somewhere else, moved a booking an hour (or three) and
// nothing on the screen said so.
//
// So the conversion takes the zone as an argument, and it is REQUIRED. There is
// no default, because a default is how the computer's clock got in.
//
// `check:date-conversions` holds the line: a file that draws a datetime-local
// box has to import this module (or the automations' own zone helpers).
//
// ── WHAT A WALL TIME CAN BE ─────────────────────────────────────────────────
//
// Most of the time one wall time is one moment. Twice a year it is not:
//
//   - When the clocks go FORWARD, an hour of wall times never happens. 2:30 AM
//     on March 8, 2026 does not exist in Denver. This refuses it and says why
//     (`wallProblem`), rather than quietly booking 1:30 or 3:30.
//   - When the clocks go BACK, an hour happens twice. This takes the FIRST one,
//     which is what everybody means by "1:30 on the night the clocks go back"
//     until they are told otherwise.
//
// The console has no date library, so this is done with `Intl`, which knows
// every zone's rules: format an instant in the zone, read the parts back as if
// they were UTC, and the difference is the offset in force at that instant.

/**
 * What a form hands the field that draws a time box, when the two live in
 * different files: whose clock the box is on, the line that says so, and the
 * one problem to show instead of it. `zone` is undefined while it is still
 * being worked out, and the box should hold still until it is known.
 */
export interface WallClockBox {
  zone: string | undefined;
  hint: string;
  problem: string | null;
}

const PARTS: Intl.DateTimeFormatOptions = {
  hourCycle: 'h23',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
};

const formatters = new Map<string, Intl.DateTimeFormat>();

/** One formatter per zone. A zone the runtime does not know reads as UTC rather
 *  than throwing inside a form: the box then shows a time that is wrong by the
 *  offset, and the hint underneath names UTC, which is the honest answer. */
function partsIn(zone: string): Intl.DateTimeFormat {
  const cached = formatters.get(zone);
  if (cached) return cached;
  let made: Intl.DateTimeFormat;
  try {
    made = new Intl.DateTimeFormat('en-US', { ...PARTS, timeZone: zone });
  } catch {
    made = new Intl.DateTimeFormat('en-US', { ...PARTS, timeZone: 'UTC' });
  }
  formatters.set(zone, made);
  return made;
}

interface WallParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

function wallPartsAt(ms: number, zone: string): WallParts {
  const parts = partsIn(zone).formatToParts(new Date(ms));
  const at = (type: Intl.DateTimeFormatPartTypes): number =>
    Number(parts.find((p) => p.type === type)?.value ?? '0');
  return {
    year: at('year'),
    month: at('month'),
    day: at('day'),
    // Some engines spell midnight "24" even under h23.
    hour: at('hour') % 24,
    minute: at('minute'),
    second: at('second'),
  };
}

/** How far ahead of UTC the zone is at this instant, in milliseconds. */
function offsetMs(ms: number, zone: string): number {
  const p = wallPartsAt(ms, zone);
  return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - ms;
}

const pad = (n: number): string => String(n).padStart(2, '0');

function wallText(p: WallParts): string {
  return `${String(p.year)}-${pad(p.month)}-${pad(p.day)}T${pad(p.hour)}:${pad(p.minute)}`;
}

/**
 * An instant as the business's wall clock reads it: `YYYY-MM-DDTHH:mm`, which
 * is the value a datetime-local box takes. Empty for nothing, or for something
 * that is not a time.
 */
export function wallValue(iso: string | null | undefined, zone: string): string {
  if (!iso) return '';
  const ms = new Date(iso).getTime();
  if (Number.isNaN(ms)) return '';
  return wallText(wallPartsAt(ms, zone));
}

const WALL = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::\d{2})?$/;

/** The UTC milliseconds the wall time WOULD be if the zone were UTC, or null when
 *  the box holds something that is not a real date and time. `2026-02-30` is
 *  refused: `Date.UTC` rolls it to March 2, and saving a day nobody typed is the
 *  same mistake as saving an hour nobody meant. */
function asIfUtc(value: string): number | null {
  const m = WALL.exec(value);
  if (!m) return null;
  const [year, month, day, hour, minute] = m.slice(1).map(Number) as [
    number,
    number,
    number,
    number,
    number,
  ];
  if (hour > 23 || minute > 59) return null;
  const ms = Date.UTC(year, month - 1, day, hour, minute);
  const back = new Date(ms);
  if (back.getUTCFullYear() !== year || back.getUTCMonth() !== month - 1) return null;
  if (back.getUTCDate() !== day) return null;
  return ms;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Milliseconds as an ISO instant, or null for a number that is not one. */
function isoOf(ms: number): string | null {
  const at = new Date(ms);
  return Number.isNaN(at.getTime()) ? null : at.toISOString();
}

/** Every instant that reads as `value` on the zone's clock, earliest first: one
 *  on an ordinary day, two in the hour the clocks go back, none in the hour they
 *  go forward. Offsets are taken a day either side, which covers both sides of
 *  any change (no zone changes its clocks twice in two days). */
function instantsFor(value: string, zone: string): number[] {
  const naive = asIfUtc(value);
  if (naive === null) return [];
  const wall = value.slice(0, 16);
  const candidates = new Set([
    naive - offsetMs(naive - DAY_MS, zone),
    naive - offsetMs(naive + DAY_MS, zone),
    naive - offsetMs(naive, zone),
  ]);
  return [...candidates]
    .filter((ms) => wallText(wallPartsAt(ms, zone)) === wall)
    .sort((a, b) => a - b);
}

/**
 * What a datetime-local box means, read on the business's clock, as an ISO
 * instant. `null` when the box is empty, holds something that is not a time, or
 * holds a time the clocks skip (ask `wallProblem` for the sentence).
 */
export function instantFromWall(value: string, zone: string): string | null {
  const first = instantsFor(value, zone)[0];
  return first === undefined ? null : isoOf(first);
}

/**
 * The one sentence to show under a box whose time cannot be saved because the
 * clocks skip it, or `null` when there is nothing to say. An empty or half-typed
 * box is not this function's business: the form decides what "required" means.
 */
export function wallProblem(value: string, zone: string): string | null {
  const naive = asIfUtc(value);
  if (naive === null) return null;
  if (instantsFor(value, zone).length > 0) return null;
  const day = new Intl.DateTimeFormat('en-US', {
    timeZone: 'UTC',
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  }).format(new Date(naive));
  const clock = (ms: number): string =>
    new Intl.DateTimeFormat('en-US', {
      timeZone: 'UTC',
      hour: 'numeric',
      minute: '2-digit',
    }).format(new Date(ms));
  // The first wall time after the gap: the same day, an hour (the size of the
  // jump, whatever it is) later than the top of the hour that was skipped.
  const jump = offsetMs(naive + DAY_MS, zone) - offsetMs(naive - DAY_MS, zone);
  const resumes = Math.floor(naive / 3_600_000) * 3_600_000 + Math.max(jump, 0);
  return `${clock(naive)} does not happen on ${day} in ${zoneWords(zone)}: the clocks go forward an hour that night. Pick a time from ${clock(resumes)}.`;
}

/** The instant a calendar day (`YYYY-MM-DD`) starts on the zone's clock. */
export function dayStartIn(day: string, zone: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return null;
  return instantFromWall(`${day}T00:00`, zone);
}

/** The last second of a calendar day on the zone's clock: one second before the
 *  next day starts, so a day the clocks change on is 23 or 25 hours long. */
export function dayEndIn(day: string, zone: string): string | null {
  const start = dayStartIn(day, zone);
  if (start === null) return null;
  const next = isoOf(Date.parse(`${day}T00:00:00Z`) + DAY_MS)?.slice(0, 10);
  const nextStart = next ? dayStartIn(next, zone) : null;
  return nextStart === null ? null : isoOf(Date.parse(nextStart) - 1000);
}

/** The calendar day an instant falls on, on the zone's clock. */
export function dayIn(iso: string, zone: string): string {
  return wallValue(iso, zone).slice(0, 10);
}

/**
 * A zone the way a person says it: "Mountain time", "Pacific time", "Central
 * European time". Read off the date in hand because a few zones change their
 * name with the season. Falls back to the city, and never to the identifier.
 */
export function zoneWords(zone: string, at: Date = new Date()): string {
  try {
    const name = new Intl.DateTimeFormat('en-US', { timeZone: zone, timeZoneName: 'longGeneric' })
      .formatToParts(at)
      .find((part) => part.type === 'timeZoneName')?.value;
    if (name && !name.startsWith('GMT')) return name.replace(/ Time$/, ' time');
  } catch {
    // An unknown zone falls through to its city.
  }
  return `${(zone.split('/').pop() ?? zone).replace(/_/g, ' ')} time`;
}

/**
 * The line under a time box. Names the zone always, and when this computer is
 * on a different clock, says that too: that is the moment somebody would
 * otherwise trust the clock in the corner of their screen.
 */
export function wallClockHint(
  zone: string,
  device: string,
  where = 'where the booking happens'
): string {
  const here = `In ${zoneWords(zone)}, ${where}.`;
  if (sameClock(zone, device)) return here;
  return `${here} This computer is set to ${zoneWords(device)}, so this is not the time on your screen’s clock.`;
}

/** Whether two zones read the same right now. Compared by offset, not by name,
 *  so somebody in Boise is not warned about Denver. */
function sameClock(a: string, b: string): boolean {
  if (a === b) return true;
  const now = Date.now();
  return offsetMs(now, a) === offsetMs(now, b);
}
