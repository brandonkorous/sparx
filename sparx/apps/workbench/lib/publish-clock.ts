// The clock a scheduled piece goes live on, and a scheduled email goes out on.
//
// The schedule box is a plain date-and-time input, and it was read as THIS
// COMPUTER's time and never said so. Rosalind, a journal in England, typed
// Thursday 06:00 on a laptop in another zone and the piece was stored for
// 13:00 UTC, which is 14:00 at home; the editor then read "Goes live Oct 8,
// 2026, 6:00 AM" without saying whose 6:00 (Piggles persona issue 942).
//
// What she types is read on the business's clock when it has one, and on this
// computer's when it does not, and the screen says which either way.
//
// It moved here from surfaces/cms when her newsletter needed the same answer.
// The campaign's "Schedule for a specific time" box was read on this computer's
// clock and said "Uses your own time zone", and the campaign she sent at 08:20
// UTC read "Sent: October 11, 2026 at 1:20 AM" on a laptop in California, when
// it was 9:20 AM at home (Piggles persona issue 984). One copy, so a piece and a
// campaign can never disagree about what 06:00 means.

import { zoneOffsetMinutes } from '../surfaces/automations/schedule-clock';

/**
 * A wall-clock reading ("2026-10-08T06:00") on `zone`'s clock, as an instant.
 * Null for something that is not a date and time.
 *
 * Offset taken twice, because the first guess can sit on the other side of a
 * clock change from the answer: 01:30 on the night the clocks go back is two
 * different instants, and the second pass lands on the one the zone uses.
 */
export function wallClockToIso(local: string, zone: string): string | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(local.trim());
  if (!match) return null;
  const [, y, mo, d, h, mi] = match.map(Number) as [number, number, number, number, number, number];
  const asIfUtc = Date.UTC(y, mo - 1, d, h, mi);
  if (Number.isNaN(asIfUtc)) return null;
  const first = zoneOffsetMinutes(zone, new Date(asIfUtc));
  let at = asIfUtc - first * 60_000;
  const second = zoneOffsetMinutes(zone, new Date(at));
  if (second !== first) at = asIfUtc - second * 60_000;
  const instant = new Date(at);
  if (Number.isNaN(instant.getTime())) return null;
  return instant.toISOString();
}

/** The reverse: an instant as the "2026-10-08T06:00" a date-and-time box takes,
 *  on `zone`'s clock. */
export function isoToWallClock(iso: string, zone: string): string {
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return '';
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: zone,
      hour12: false,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }).formatToParts(at);
    const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '00';
    return `${get('year')}-${get('month')}-${get('day')}T${get('hour') === '24' ? '00' : get('hour')}:${get('minute')}`;
  } catch {
    return '';
  }
}

/** The clock's own name on a given day: "British Summer Time". */
export function clockName(zone: string, at: Date): string {
  try {
    const part = new Intl.DateTimeFormat('en-US', { timeZone: zone, timeZoneName: 'long' })
      .formatToParts(at)
      .find((p) => p.type === 'timeZoneName');
    return part?.value ?? zone;
  } catch {
    return zone;
  }
}

/** An instant on `zone`'s clock, with the clock named: "Oct 8, 2026, 6:00 AM British Summer Time". */
export function onClock(iso: string, zone: string): string {
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return iso;
  try {
    const when = new Intl.DateTimeFormat('en-US', {
      timeZone: zone,
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(at);
    return `${when} ${clockName(zone, at)}`;
  } catch {
    return at.toISOString();
  }
}

/** The sentence under the box: whose clock, and how to change it. */
export function clockNote(zone: string | null, device: string, at: Date): string {
  if (zone) return `On your business's clock, ${clockName(zone, at)}.`;
  return `Your business has no time zone yet, so this is this computer's clock, ${clockName(device, at)}. To schedule on your business's own clock, set it in Business details.`;
}

/**
 * A history line, with a machine time in it read out on the reader's clock.
 *
 * The server notes a schedule as "Scheduled for 2026-10-08T13:00:00.000Z", and
 * the history printed that as written (issue 942). It cannot know whose clock
 * the reader keeps, and older notes already carry it, so the time is turned
 * into words here rather than there.
 */
export function summaryOnClock(summary: string, zone: string): string {
  return summary.replace(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?Z/g, (iso) =>
    onClock(iso, zone)
  );
}

/**
 * The date-and-time box value `minutes` from now, on `zone`'s clock: the
 * earliest sensible schedule, and where the box opens.
 *
 * It used to be worked out with this computer's offset, so on a laptop eight
 * hours behind the business the box opened eight hours in the past
 * (Piggles persona issue 984).
 */
export function wallClockFromNow(minutes: number, zone: string, now: number = Date.now()): string {
  const at = new Date(now + minutes * 60_000);
  if (Number.isNaN(at.getTime())) return '';
  return isoToWallClock(at.toISOString(), zone);
}

/**
 * What the box says, read on `zone`'s clock, as an instant, but only when that
 * instant is still to come. Null for a past time or something that is not a
 * time.
 *
 * "In the future" is asked of the INSTANT, never of the wall time against this
 * computer's: 09:30 typed for a business in London is already past at 10:00
 * London time, though a laptop in California would call it hours away
 * (Piggles persona issue 984).
 */
export function futureInstant(
  local: string,
  zone: string,
  now: number = Date.now()
): string | null {
  const at = wallClockToIso(local, zone);
  if (at === null) return null;
  return new Date(at).getTime() > now ? at : null;
}
