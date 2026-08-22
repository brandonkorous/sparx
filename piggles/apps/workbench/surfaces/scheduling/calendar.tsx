'use client';

// THE CALENDAR — the operator's diary, everything booked in laid out by time.
//
// Two shapes of the same grid. WEEK is seven day-columns on one time axis — the
// "how does my week look" view. DAY is one day split into a column per resource
// (a member of staff, a bay, a room), which is how a shop actually runs a day:
// who is on what, and where the gaps are. A resource can't be double-booked (the
// database forbids it), so a resource column is a clean single track.
//
// Everything that narrows or moves the diary is a real read: the [from, to)
// window is a server filter, the resource filter is passed to the server too, so
// the grid never sieves a page in the browser and calls it the answer. Color is
// status, carried by the blocks themselves (see calendar-timegrid), so a glance
// tells you what is confirmed, what still needs a nod, and what is under way.
//
// Clicking a booking opens a quick-look MODAL over the diary — reschedule, the
// lifecycle moves, and its change history, without splitting or hiding the grid.
// Shift-click opens the full booking pane alongside, alt-click in its own window,
// for anyone who wants the deep editor straight away.

import { useMemo, useState } from 'react';
import { PaneWaiting } from '../../components/pane-waiting';
import { PaneLoadError } from '../../components/pane-load-error';
import { Card, Text } from '@wizeworks/silicaui-react';
import { faCalendarXmark } from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';
import { PANE_SHELL } from '../../components/pane-toolbar';
import { CalendarToolbar } from './calendar-toolbar';
import type { SurfaceContext } from '../../lib/surfaces/registry';

/** Registry module for this pane, so the brand draws Bookings' own picture rather
 *  than the generic one. */
const MODULE = 'scheduling';
import { CalendarBookingModal } from './calendar-booking-modal';
import { useSchedulingResources } from './bookings-data';
import {
  addDays,
  addWeeks,
  dayLabel,
  dayWindow,
  useCalendarRange,
  weekLabel,
  weekWindow,
  type CalendarEvent,
} from './calendar-data';
import { windowForEvents } from './calendar-grid';
import { TimeGrid, targetFor } from './calendar-timegrid';
import { dayColumns, emptyLine, useShutHours, weekColumns, type View } from './calendar-columns';

export function CalendarSurface({ ctx }: { ctx: SurfaceContext }) {
  const [view, setView] = useState<View>('week');
  const [anchor, setAnchor] = useState<Date>(() => new Date());
  const [resourceId, setResourceId] = useState('');
  // The booking shown in the quick-look modal, or null when it is closed.
  const [selectedBookingId, setSelectedBookingId] = useState<string | null>(null);

  const resources = useSchedulingResources();
  const activeResources = resources.data ?? [];

  const range = view === 'week' ? weekWindow(anchor) : dayWindow(anchor);
  const { data, isLoading, isFetching, dataUpdatedAt, isError, refetch } = useCalendarRange({
    ...range,
    ...(resourceId ? { resourceId } : {}),
  });

  const events = useMemo(() => data ?? [], [data]);
  const timeWindow = useMemo(() => windowForEvents(events), [events]);

  const shut = useShutHours(resourceId, timeWindow);

  const columns = useMemo(
    () =>
      view === 'week'
        ? weekColumns(anchor, events, shut)
        : dayColumns(events, resources.data ?? [], resourceId, anchor, shut),
    [view, anchor, events, resources.data, resourceId, shut]
  );

  const label = view === 'week' ? weekLabel(anchor) : dayLabel(anchor);
  const columnMinClass = view === 'week' ? 'min-w-[7rem]' : 'min-w-[12rem]';

  const step = (direction: 1 | -1) => {
    setAnchor((current) =>
      view === 'week' ? addWeeks(current, direction) : addDays(current, direction)
    );
  };

  const openBooking = (event: CalendarEvent, modifiers: { shiftKey: boolean; altKey: boolean }) => {
    // The escape hatch: shift/alt jumps straight to the full booking PANE beside
    // the diary or in its own window. A plain click opens the quick-look modal,
    // which keeps the calendar in view behind it.
    if (modifiers.shiftKey || modifiers.altKey) {
      ctx.open('scheduling.bookings.detail', { id: event.id }, { target: targetFor(modifiers) });
      return;
    }
    setSelectedBookingId(event.id);
  };

  const body = () => {
    if (isError) {
      return (
        <PaneLoadError
          module={MODULE}
          icon={<Icon glyph={faCalendarXmark} className="size-6" aria-hidden />}
          title="Could not load your diary"
          description="This is a problem reaching the server. Nothing in your diary has changed — the bookings just could not be read just now."
          onRetry={() => {
            void refetch();
          }}
        />
      );
    }

    if (isLoading && events.length === 0) {
      return <PaneWaiting module={MODULE} label="Loading your diary…" />;
    }

    return (
      <div className="relative h-full">
        <TimeGrid
          columns={columns}
          window={timeWindow}
          columnMinClass={columnMinClass}
          onOpenEvent={openBooking}
        />
        {events.length === 0 ? (
          <div className="pointer-events-none absolute inset-0 flex items-start justify-center pt-24">
            <div className="bg-base-100 border-base-200 max-w-sm rounded-lg border px-4 py-3 text-center">
              <Text className="font-medium">
                {view === 'week' ? 'Nothing booked this week' : 'Nothing booked this day'}
              </Text>
              <Text className="text-sm">{emptyLine(resourceId, view, anchor, shut)}</Text>
            </div>
          </div>
        ) : null}
      </div>
    );
  };

  return (
    <div className={PANE_SHELL}>
      <CalendarToolbar
        label={label}
        view={view}
        resourceId={resourceId}
        resources={activeResources}
        isFetching={isFetching}
        updatedAt={data ? dataUpdatedAt : undefined}
        onSetView={setView}
        onSetAnchor={setAnchor}
        onSetResourceId={setResourceId}
        onStep={step}
        onRefresh={() => {
          void refetch();
        }}
        onOpenLinkedCalendars={() => {
          ctx.open('scheduling.calendar.connections', {}, { target: 'beside' });
        }}
      />

      {/* One recessed card holding the whole grid. Capped nowhere on purpose: the
          diary earns the full width it is given — more of the day and more
          columns, not a paragraph pinned to the left. */}
      {/* A real Card rather than a hand-rolled base-100 box: same one card around
          every state, and it picks up the resting elevation Piggles separates
          surfaces with (DESIGN.md §4) instead of a hairline nobody can see. */}
      <Card className="min-h-0 flex-1 overflow-hidden">{body()}</Card>

      {events.length > 0 ? (
        <Text className="hidden shrink-0 px-1 text-sm @lg:block">
          Click a booking to open it · Shift-click alongside · Alt-click in a new window
        </Text>
      ) : null}

      {/* The quick-look modal floats over the diary — the grid above stays mounted
          and live behind it, so a booking is opened without losing the week. */}
      <CalendarBookingModal
        bookingId={selectedBookingId}
        open={selectedBookingId !== null}
        onOpenChange={(next) => {
          if (!next) setSelectedBookingId(null);
        }}
        ctx={ctx}
      />
    </div>
  );
}

export default CalendarSurface;
