// How the version history writes a moment, on WHOSE clock (piggles persona issue 987).
//
// The history used `Intl` with no zone, so every time read on this computer's clock: a
// business in London, opened on a laptop set to Pacific time, saw that it published at
// "2:39 AM" on a morning it published at 10:39. "Today" and "Yesterday" were measured
// against this computer's midnight too, so an evening's saves could sit under the next
// day's heading. Everything here takes the business's zone, and the heading moves with
// the clock because it is worked out on the same zone as the time.

import { clockName, isoToWallClock } from '../../../lib/publish-clock';

const formats = new Map<string, { day: Intl.DateTimeFormat; clock: Intl.DateTimeFormat }>();

/** Built once per zone: `Intl` objects are expensive to construct per row. */
function formatsFor(zone: string): { day: Intl.DateTimeFormat; clock: Intl.DateTimeFormat } {
  let found = formats.get(zone);
  if (!found) {
    try {
      found = {
        day: new Intl.DateTimeFormat(undefined, {
          timeZone: zone,
          weekday: 'short',
          day: 'numeric',
          month: 'short',
        }),
        clock: new Intl.DateTimeFormat(undefined, {
          timeZone: zone,
          hour: 'numeric',
          minute: '2-digit',
        }),
      };
    } catch {
      // A zone this browser does not know: UTC, which is at least the same for every
      // reader, rather than whatever this computer is set to.
      return formatsFor('UTC');
    }
    formats.set(zone, found);
  }
  return found;
}

/** The time on a version row: "10:39 AM", on `zone`'s clock. */
export function versionClock(iso: string, zone: string): string {
  return formatsFor(zone).clock.format(new Date(iso));
}

/** Whole calendar days from `iso` to `now`, both read on `zone`'s clock. */
function calendarDaysBetween(iso: string, now: Date, zone: string): number {
  const day = (at: string) => Date.parse(`${isoToWallClock(at, zone).slice(0, 10)}T00:00:00Z`);
  return Math.round((day(now.toISOString()) - day(iso)) / 86_400_000);
}

/** "Today" / "Yesterday" / "Mon, Jul 28": compared by calendar day on `zone`'s clock,
 *  not by elapsed hours, so a save at 11pm and one at 1am are two different days. */
export function versionDayLabel(iso: string, zone: string, now: Date = new Date()): string {
  const days = calendarDaysBetween(iso, now, zone);
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  return formatsFor(zone).day.format(new Date(iso));
}

/** The line that says whose clock the history's times are on. */
export function versionClockNote(zone: string | null, device: string, at: Date): string {
  if (zone) return `Times are on your business's clock, ${clockName(zone, at)}.`;
  return `Times are on this computer's clock, ${clockName(device, at)}, because your business has no time zone yet. You can set one in Business details.`;
}
