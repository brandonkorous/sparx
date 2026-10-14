// How a version list writes a moment: the day it happened, the time it happened,
// and the cell that time sits in. Both the page History and the Publish releases
// list show the same kind of row, and were declaring these separately.
//
// THE CELL WIDTH IS MEASURED, NOT GUESSED. A clock time is not one width: at
// `text-sm` here, "2:59 AM" renders 55.8px and "2:44 AM" renders 56.9px, because
// 4 is a wider glyph than 9. Against the old fixed `w-14` (56px) that meant some
// rows wrapped to two lines and others did not, with nothing a reader could name
// deciding which. A two-digit hour is 66.1px, so every save between 10am and 1pm
// wrapped every time.
//
// `tabular-nums` is what makes the times line up at all: it renders every digit
// the same width, so all one-digit-hour times become exactly 57.1px. `min-w-18`
// (72px) holds the widest of them with room to spare, and it is a MINIMUM rather
// than a fixed width so a locale with a longer pattern grows the cell instead of
// wrapping inside it.

// WHOSE CLOCK. Both lists read a moment on the BUSINESS's clock, not this computer's
// (piggles persona issue 987). They used `Intl` with no zone, so a journal in London,
// opened on a laptop set to Pacific time, read that she published at "2:39 AM" on the
// Sunday morning she published at 10:39, and a Friday-evening save could sit under
// Saturday's heading. The day heading moves with the clock, so it is formatted on the
// same zone as the time.

import { clockName } from '../../lib/publish-clock';

const formats = new Map<string, { day: Intl.DateTimeFormat; clock: Intl.DateTimeFormat }>();

/** Built once per zone: `Intl` objects are expensive to construct per row. */
function formatsFor(zone: string): { day: Intl.DateTimeFormat; clock: Intl.DateTimeFormat } {
  let found = formats.get(zone);
  if (!found) {
    try {
      found = {
        day: new Intl.DateTimeFormat(undefined, {
          timeZone: zone,
          weekday: 'long',
          day: 'numeric',
          month: 'long',
        }),
        clock: new Intl.DateTimeFormat(undefined, {
          timeZone: zone,
          hour: 'numeric',
          minute: '2-digit',
        }),
      };
    } catch {
      // A zone this browser does not know: fall back to UTC rather than to this
      // computer, so the fallback is at least the same for every reader.
      return formatsFor('UTC');
    }
    formats.set(zone, found);
  }
  return found;
}

/** The day heading a version sits under: "Sunday, October 11", on `zone`'s clock. */
export function versionDay(iso: string, zone: string): string {
  return formatsFor(zone).day.format(new Date(iso));
}

/** The time on a version row: "10:39 AM", on `zone`'s clock. */
export function versionClock(iso: string, zone: string): string {
  return formatsFor(zone).clock.format(new Date(iso));
}

/** The line under a version list's heading that says whose clock its times are on. */
export function versionClockNote(zone: string | null, device: string, at: Date): string {
  if (zone) return `Times are on your business's clock, ${clockName(zone, at)}.`;
  return `Times are on this computer's clock, ${clockName(device, at)}, because your business has no time zone yet. You can set one in Business details.`;
}

/** The time cell in a version row. Read the note above before changing the width. */
export const TIME_CELL =
  'text-base-content min-w-18 shrink-0 text-sm tabular-nums whitespace-nowrap';
