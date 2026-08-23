'use client';

// ONE BOOKING, DRAWN — the block the diary places on its time axis.
//
// Split out of calendar-timegrid.tsx, which owns the frame: the gutter, the
// sticky header, the columns. This owns what a single appointment looks like
// inside one of them, which is a separate question and the one that changes.
//
// Color is STATUS, carried by the block and by the solid rail beside it, so a
// glance says what is confirmed, what still needs a nod and what is under way
// without reading a word.
//
// HOW TALL IT IS DECIDES WHAT IT SAYS. A block is as tall as the appointment is
// long, so the space is not the designer's to choose — a half-hour dry cut gets
// thirty-two pixels whatever we would like. Three stacked lines need about
// fifty, and drawing them anyway does not shorten the text, it CUTS it: the
// service name and the client's name came out sliced through the middle of the
// letters, which reads as broken software rather than as a short appointment
// (issue 148).

import { bookingStateMeta, type BookingStatus } from './bookings-data';
import { clockLabel, TONE_BLOCK, TONE_RAIL, type CalendarEvent } from './calendar-data';
import type { Placement } from './calendar-grid';

/** Who is coming. The chair is the fallback only where nobody is recorded — in
 *  the day view the chair is already the column heading, so naming it on the
 *  block repeats the words directly above it and never names the client. */
function whoFor(event: CalendarEvent): string | null {
  if (event.customerName) return event.customerName;
  if (event.partySize && event.partySize > 1) return `Party of ${String(event.partySize)}`;
  return event.resourceNames.length > 0 ? event.resourceNames.join(', ') : null;
}

/** Rows the block has room for: three from an hour up, two at three quarters,
 *  one at a half hour or less. */
function linesFor(slots: number): 1 | 2 | 3 {
  if (slots >= 4) return 3;
  return slots === 3 ? 2 : 1;
}

/** A half hour or less: one row, so the words run out of WIDTH and end in an
 *  ellipsis rather than being cut off through their middles. The client still
 *  gets named — it is the fact on a block that is nowhere else on the screen —
 *  she just shares the line with the service. */
function OneLine({ event, who }: { event: CalendarEvent; who: string | null }) {
  return (
    <span className="flex min-w-0 items-baseline gap-1.5">
      <span className="shrink-0 text-xs font-medium tabular-nums">{clockLabel(event.startAt)}</span>
      <span className="truncate text-xs font-semibold">
        {who ? `${event.serviceName} · ${who}` : event.serviceName}
      </span>
    </span>
  );
}

/** Two rows and three: the difference is WHERE the time goes, not whether the
 *  client is named. She is the one fact on a block that is nowhere else on the
 *  screen — the service repeats down the column and the chair is the column
 *  heading — so at two rows the time moves up beside the service to make room
 *  for her, rather than the name being the thing that gets dropped. Every blow
 *  dry in the diary read "3:15 PM / Blow dry" and named nobody. */
function Stacked({
  event,
  who,
  lines,
}: {
  event: CalendarEvent;
  who: string | null;
  lines: 2 | 3;
}) {
  if (lines === 2) {
    return (
      <span className="flex min-w-0 flex-col leading-tight">
        <span className="flex min-w-0 items-baseline gap-1.5">
          <span className="shrink-0 text-xs font-medium tabular-nums">
            {clockLabel(event.startAt)}
          </span>
          <span className="truncate text-sm font-semibold">{event.serviceName}</span>
        </span>
        {who ? <span className="truncate text-xs">{who}</span> : null}
      </span>
    );
  }
  return (
    <span className="flex min-w-0 flex-col leading-tight">
      <span className="truncate text-xs font-medium tabular-nums">{clockLabel(event.startAt)}</span>
      <span className="truncate text-sm font-semibold">{event.serviceName}</span>
      {who ? <span className="truncate text-xs">{who}</span> : null}
    </span>
  );
}

export function EventBlock({
  event,
  placement,
  onOpen,
}: {
  event: CalendarEvent;
  placement: Placement;
  onOpen: (event: CalendarEvent, modifiers: { shiftKey: boolean; altKey: boolean }) => void;
}) {
  const meta = bookingStateMeta(event.status as BookingStatus);
  const who = whoFor(event);
  const lines = linesFor(placement.slots);

  return (
    <button
      type="button"
      // The whole of it, always, however little the block itself can hold.
      title={[clockLabel(event.startAt), event.serviceName, event.customerName, meta.label]
        .filter(Boolean)
        .join(' · ')}
      onClick={(domEvent) => {
        onOpen(event, domEvent);
      }}
      className={`absolute flex gap-1.5 overflow-hidden rounded-md px-1 text-left ${lines === 1 ? 'items-center py-0' : 'py-1'} ${placement.topClass} ${placement.heightClass} ${placement.widthClass} ${placement.leftClass} ${TONE_BLOCK[meta.tone]}`}
    >
      {/* The solid rail — a 15% tint alone is too quiet to scan a busy day by.
          Full height, so a one-line block still carries the status stripe. */}
      <span
        className={`my-0.5 w-1 shrink-0 self-stretch rounded-full ${TONE_RAIL[meta.tone]}`}
        aria-hidden
      />
      {lines === 1 ? (
        <OneLine event={event} who={who} />
      ) : (
        <Stacked event={event} who={who} lines={lines} />
      )}
    </button>
  );
}
