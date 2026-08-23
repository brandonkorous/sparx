'use client';

// THE TIME GRID — the shape both the day view and the week view draw on.
//
// A left gutter of hour labels, then one or more columns (a day, or a resource)
// sharing one time axis. Every booking is an absolutely-positioned block whose
// top and height come from the quantised class lookups in calendar-grid.ts — no
// inline style anywhere, which is the whole reason that file exists.
//
// A single booking's block lives next door in calendar-event-block.tsx.
//
// The grid scrolls as one: the header row is sticky, the columns hold a min
// width so seven of them in a narrow pane become a horizontal scroll rather than
// seven unreadable slivers. Color is status: a soft-tinted block plus a solid
// rail of the same tone, so a busy day is scannable at a glance — what is
// confirmed, what still needs a nod, what is already under way.

import { useEffect, useRef, type ReactNode } from 'react';
import type { OpenTarget } from '../../lib/surfaces/registry';
import { hourLabel, type CalendarEvent } from './calendar-data';
import { EventBlock } from './calendar-event-block';
import { columnHeightClass, hourMarks, placeEvents, type TimeWindow } from './calendar-grid';
import type { ClosedBand } from './calendar-hours';

/** Same modifier contract as every list in the app: plain opens a tab, shift
 *  docks beside, alt tears off to a window. */
export function targetFor(event: { shiftKey: boolean; altKey: boolean }): OpenTarget {
  if (event.altKey) return 'window';
  if (event.shiftKey) return 'beside';
  return 'tab';
}

/** One vertical strip of the grid — a day, or a resource. */
export interface GridColumn {
  key: string;
  /** The column's heading — a weekday, or a person/room's name. */
  header: ReactNode;
  /** True to mark the column that is today. */
  today?: boolean;
  /** The hours nobody is open for — drawn behind the bookings so a week with
   *  hours set does not look like a week with none (issue 084). */
  closed?: ClosedBand[];
  events: CalendarEvent[];
}

interface TimeGridProps {
  columns: GridColumn[];
  window: TimeWindow;
  /** Tailwind min-width for each column — wider for a roomy day, tighter for a
   *  seven-across week. */
  columnMinClass: string;
  /**
   * Bumped by the surface whenever it has moved you in time, so the grid puts
   * today's column back where you can see it.
   *
   * Seven columns at their floor width are wider than a phone, so a week opens
   * as a horizontal scroll — and it opens on MONDAY. On a Saturday that left
   * today three columns off the right edge, and pressing Today did nothing
   * visible because the anchor was already inside this week. The diary's whole
   * job is "what is on now", and the phone was the one place it could not say.
   */
  revealNonce: number;
  onOpenEvent: (event: CalendarEvent, modifiers: { shiftKey: boolean; altKey: boolean }) => void;
}

// The time axis. STICKY, because a grid whose columns are wider than the pane
// scrolls sideways — and the moment it does, a non-sticky gutter leaves with the
// leftmost column, so the diary becomes blocks with no hours against them. It
// carries its own ground for the columns to slide under.
//
// Two elements, not one: the hour labels are positioned against the gutter, and
// `relative` and `sticky` are the same CSS property. Stacking them in one class
// string would leave which of them applies to the order Tailwind happened to
// emit them in. The outer one pins; the inner one is the labels' frame.
const GUTTER = 'bg-base-100 sticky left-0 w-14 shrink-0';
/** The gutter sits above the blocks; the header row above both, and its own
 *  gutter cell above everything, because it is sticky on both axes at once. */
const GUTTER_LAYER = 'z-10';
const HEADER_LAYER = 'z-20';
const CORNER_LAYER = 'z-30';

export function TimeGrid({
  columns,
  window,
  columnMinClass,
  revealNonce,
  onOpenEvent,
}: TimeGridProps) {
  const marks = hourMarks(window.startMin, window.endMin);
  const heightClass = columnHeightClass(window.slots);
  const scroller = useRef<HTMLDivElement>(null);
  const todayCell = useRef<HTMLDivElement | null>(null);

  // Centred where there is room, clamped to the ends where there is not, so the
  // first and last days of a week never leave a band of empty grid beside them.
  // Measured off rectangles rather than `offsetLeft`: the header is sticky and
  // the offset parent is not the scroller, so the two disagree.
  useEffect(() => {
    const box = scroller.current;
    const cell = todayCell.current;
    if (!box || !cell) return;
    const into = cell.getBoundingClientRect().left - box.getBoundingClientRect().left;
    const centred = box.scrollLeft + into - (box.clientWidth - cell.offsetWidth) / 2;
    box.scrollLeft = Math.max(0, Math.min(centred, box.scrollWidth - box.clientWidth));
  }, [revealNonce, columns]);

  return (
    <div ref={scroller} className="h-full overflow-auto">
      {/* `w-max min-w-full` is what lets the grid do both: grow columns to fill a
          wide pane, yet in a narrow one become a horizontal scroll whose sticky
          header still spans the full width rather than tearing off at the edge. */}
      <div className="w-max min-w-full">
        {/* Column headings — sticky, so the day/resource a block sits under stays
            named however far down you scroll. */}
        <div className={`bg-base-100 border-base-200 sticky top-0 flex border-b ${HEADER_LAYER}`}>
          <div className={`${GUTTER} ${CORNER_LAYER}`} />
          {columns.map((column) => (
            <div
              key={column.key}
              ref={
                column.today
                  ? (node) => {
                      todayCell.current = node;
                    }
                  : undefined
              }
              className={`border-base-200 flex-1 border-l px-2 py-1.5 text-center ${columnMinClass} ${
                column.today ? 'bg-info soft' : ''
              }`}
            >
              {column.header}
            </div>
          ))}
        </div>

        {/* The grid body — gutter + columns, all the same pixel height so the hour
          lines meet across every column. */}
        <div className="flex">
          <div className={`${GUTTER} ${GUTTER_LAYER} ${heightClass}`}>
            <div className={`relative ${heightClass}`}>
              {marks.map((mark) => (
                <div
                  key={mark.hour}
                  className={`absolute right-1 ${mark.topClass} -translate-y-1/2 text-xs tabular-nums`}
                >
                  {hourLabel(mark.hour)}
                </div>
              ))}
            </div>
          </div>

          {columns.map((column) => (
            <Column
              key={column.key}
              column={column}
              window={window}
              heightClass={heightClass}
              marks={marks}
              columnMinClass={columnMinClass}
              onOpenEvent={onOpenEvent}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function Column({
  column,
  window,
  heightClass,
  marks,
  columnMinClass,
  onOpenEvent,
}: {
  column: GridColumn;
  window: TimeWindow;
  heightClass: string;
  marks: { hour: number; topClass: string }[];
  columnMinClass: string;
  onOpenEvent: (event: CalendarEvent, modifiers: { shiftKey: boolean; altKey: boolean }) => void;
}) {
  const placed = placeEvents(column.events, window);

  return (
    <div className={`border-base-200 relative flex-1 border-l ${columnMinClass} ${heightClass}`}>
      {/* Shut hours, behind everything — a flat wash rather than stripes, so it
          reads as "nothing happens here" and never competes with a booking. */}
      {(column.closed ?? []).map((closed) => (
        <div
          key={closed.key}
          title={closed.title}
          className={`bg-base-200 absolute inset-x-0 ${closed.topClass} ${closed.heightClass}`}
          aria-hidden
        />
      ))}

      {/* Faint hour lines behind the blocks. */}
      {marks.map((mark) => (
        <div
          key={mark.hour}
          className={`border-base-200 absolute inset-x-0 ${mark.topClass} border-t`}
          aria-hidden
        />
      ))}

      {placed.map(({ item, placement }) => (
        <EventBlock key={item.id} event={item} placement={placement} onOpen={onOpenEvent} />
      ))}
    </div>
  );
}
