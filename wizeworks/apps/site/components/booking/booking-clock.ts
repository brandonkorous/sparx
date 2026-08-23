// WHICH CLOCK a booking surface shows its times in.
//
// Every time on a booking widget is the BUSINESS's local time, not the reader's.
// You have to physically turn up to an appointment, so the only clock that means
// anything is the one on the wall where it happens — a visitor two states over
// reading their own would arrive three hours out (issue 109). A null zone (a
// business with several places and none of them named) falls back to the reader's
// own, which is the honest answer when we cannot say.

function inZone(tz: string | null, opts: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  try {
    return new Intl.DateTimeFormat('en-US', { ...opts, ...(tz ? { timeZone: tz } : {}) });
  } catch {
    // An unparseable zone must not take the page down with it — a time in the
    // reader's own zone is wrong by hours; a crash is wrong by everything.
    return new Intl.DateTimeFormat('en-US', opts);
  }
}

export function formatTime(iso: string, tz: string | null): string {
  return inZone(tz, { hour: 'numeric', minute: '2-digit' }).format(new Date(iso));
}

export function formatDateTime(iso: string, tz: string | null): string {
  return inZone(tz, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(iso));
}

/** The shorter form a list of sessions wants — "Sat, Sep 5 at 10:00 AM". */
export function formatShortDateTime(iso: string, tz: string | null): string {
  return inZone(tz, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(iso));
}

/** The zone's short name for a given day — "PDT", "GMT+1". Daylight saving moves
 *  it, so it is read off the date in hand rather than stored. */
export function zoneName(iso: string, tz: string): string {
  const parts = inZone(tz, { timeZoneName: 'short' }).formatToParts(new Date(iso));
  return parts.find((p) => p.type === 'timeZoneName')?.value ?? '';
}

/** Whether the reader's own clock says the same thing. Compared by what it READS,
 *  not by zone name, so somebody in Vancouver is not told about Los Angeles. */
export function readsTheSame(iso: string, tz: string | null): boolean {
  return tz === null || formatTime(iso, tz) === formatTime(iso, null);
}

/** The date and time, with the zone named only when the reader's own clock would
 *  say something else — most people are local and need no explanation. */
export function formatStamp(iso: string, tz: string | null): string {
  const stamp = formatDateTime(iso, tz);
  return tz && !readsTheSame(iso, tz) ? `${stamp} ${zoneName(iso, tz)}` : stamp;
}

// ── Which DAY, in the business's zone ───────────────────────────────────────
// The times above are only half of it: "Thursday" has to mean Thursday where the
// salon is too, or a reader eight hours away gets a grid holding the tail of one
// day and the head of the next. These mirror `@wizeworks/time`'s `tzOffsetMs` /
// `localWallToUtc` deliberately, two-pass DST resolution included — that package
// is not a dependency of this app, and an algorithm that disagreed with the
// server's about the hour the clocks change would be worse than the duplication.

const PARTS = {
  hour12: false,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
} as const;

/** How far ahead of UTC `tz` is at this instant, in milliseconds. */
function offsetMs(utcMs: number, tz: string): number {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: tz, ...PARTS }).formatToParts(
    new Date(utcMs)
  );
  const at = (type: string): number => Number(parts.find((p) => p.type === type)?.value ?? '0');
  // `hour12: false` renders midnight as 24 in some engines; both mean hour zero.
  const hour = at('hour') % 24;
  const asIfUtc = Date.UTC(
    at('year'),
    at('month') - 1,
    at('day'),
    hour,
    at('minute'),
    at('second')
  );
  return asIfUtc - utcMs;
}

/** The instant that midnight on `day` (YYYY-MM-DD) is, where `tz` is. */
export function startOfDay(day: string, tz: string | null): Date {
  const naive = Date.parse(`${day}T00:00:00Z`);
  if (Number.isNaN(naive)) return new Date(`${day}T00:00`);
  if (!tz) return new Date(`${day}T00:00`);
  const once = offsetMs(naive, tz);
  return new Date(naive - offsetMs(naive - once, tz));
}

/** The calendar day an instant falls on, where `tz` is — `YYYY-MM-DD`. */
export function dayOf(iso: string | Date, tz: string | null): string {
  const date = typeof iso === 'string' ? new Date(iso) : iso;
  const fmt = new Intl.DateTimeFormat('en-CA', {
    ...(tz ? { timeZone: tz } : {}),
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  // en-CA formats as YYYY-MM-DD, which is what <input type="date"> wants.
  return fmt.format(date);
}

/** `day` shifted by whole calendar days, still as `YYYY-MM-DD`. Done on the UTC
 *  calendar, where every day is 24 hours long, so a clocks-change day does not
 *  turn a "+1 day" into the same day again. */
export function dayAfter(day: string, days = 1): string {
  const ms = Date.parse(`${day}T00:00:00Z`);
  if (Number.isNaN(ms)) return day;
  return new Date(ms + days * 86_400_000).toISOString().slice(0, 10);
}

/** Today, where the business is — the day its booking page should open on. */
export function today(tz: string | null): string {
  return dayOf(new Date(), tz);
}
