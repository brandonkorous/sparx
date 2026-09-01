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

export const DAY = new Intl.DateTimeFormat(undefined, {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
});

export const CLOCK = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' });

/** The time cell in a version row. Read the note above before changing the width. */
export const TIME_CELL =
  'text-base-content min-w-18 shrink-0 text-sm tabular-nums whitespace-nowrap';
