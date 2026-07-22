'use client';

// THE TIME GRID — the shape both the day view and the week view draw on.
//
// A left gutter of hour labels, then one or more columns (a day, or a resource)
// sharing one time axis. Every booking is an absolutely-positioned block whose
// top and height come from the quantised class lookups in calendar-grid.ts — no
// inline style anywhere, which is the whole reason that file exists.
//
// The grid scrolls as one: the header row is sticky, the columns hold a min
// width so seven of them in a narrow pane become a horizontal scroll rather than
// seven unreadable slivers. Colour is status: a soft-tinted block plus a solid
// rail of the same tone, so a busy day is scannable at a glance — what is
// confirmed, what still needs a nod, what is already under way.

import type { ReactNode } from 'react';
import type { OpenTarget } from '../../lib/surfaces/registry';
import { bookingStateMeta, type BookingStatus } from './bookings-data';
import { clockLabel, hourLabel, TONE_BLOCK, TONE_RAIL, type CalendarEvent } from './calendar-data';
import { columnHeightClass, hourMarks, placeEvents, type TimeWindow } from './calendar-grid';

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
  events: CalendarEvent[];
}

interface TimeGridProps {
  columns: GridColumn[];
  window: TimeWindow;
  /** Tailwind min-width for each column — wider for a roomy day, tighter for a
   *  seven-across week. */
  columnMinClass: string;
  onOpenEvent: (event: CalendarEvent, modifiers: { shiftKey: boolean; altKey: boolean }) => void;
}

const GUTTER = 'w-14 shrink-0';

export function TimeGrid({ columns, window, columnMinClass, onOpenEvent }: TimeGridProps) {
  const marks = hourMarks(window.startMin, window.endMin);
  const heightClass = columnHeightClass(window.slots);

  return (
    <div className="h-full overflow-auto">
      {/* `w-max min-w-full` is what lets the grid do both: grow columns to fill a
          wide pane, yet in a narrow one become a horizontal scroll whose sticky
          header still spans the full width rather than tearing off at the edge. */}
      <div className="w-max min-w-full">
        {/* Column headings — sticky, so the day/resource a block sits under stays
            named however far down you scroll. */}
        <div className="bg-base-100 border-base-200 sticky top-0 z-10 flex border-b">
          <div className={GUTTER} />
          {columns.map((column) => (
            <div
              key={column.key}
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
          <div className={`${GUTTER} relative ${heightClass}`}>
            {marks.map((mark) => (
              <div
                key={mark.hour}
                className={`text-base-content absolute right-1 ${mark.topClass} -translate-y-1/2 text-xs tabular-nums`}
              >
                {hourLabel(mark.hour)}
              </div>
            ))}
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

function EventBlock({
  event,
  placement,
  onOpen,
}: {
  event: CalendarEvent;
  placement: { topClass: string; heightClass: string; widthClass: string; leftClass: string };
  onOpen: (event: CalendarEvent, modifiers: { shiftKey: boolean; altKey: boolean }) => void;
}) {
  const meta = bookingStateMeta(event.status as BookingStatus);
  const who =
    event.resourceNames.length > 0
      ? event.resourceNames.join(', ')
      : event.partySize && event.partySize > 1
        ? `Party of ${String(event.partySize)}`
        : null;

  return (
    <button
      type="button"
      title={`${clockLabel(event.startAt)} · ${event.serviceName} · ${meta.label}`}
      onClick={(domEvent) => {
        onOpen(event, domEvent);
      }}
      className={`absolute flex gap-1.5 overflow-hidden rounded-md p-1 text-left ${placement.topClass} ${placement.heightClass} ${placement.widthClass} ${placement.leftClass} ${TONE_BLOCK[meta.tone]}`}
    >
      {/* The solid rail — a 15% tint alone is too quiet to scan a busy day by. */}
      <span className={`mt-0.5 w-1 shrink-0 rounded-full ${TONE_RAIL[meta.tone]}`} aria-hidden />
      <span className="flex min-w-0 flex-col leading-tight">
        <span className="truncate text-xs font-medium tabular-nums">
          {clockLabel(event.startAt)}
        </span>
        <span className="truncate text-sm font-semibold">{event.serviceName}</span>
        {who ? <span className="truncate text-xs">{who}</span> : null}
      </span>
    </button>
  );
}
