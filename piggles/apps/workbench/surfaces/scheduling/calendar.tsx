'use client';

// THE CALENDAR: the operator's diary, everything booked laid out by time. WEEK is
// seven day-columns; DAY is a column per resource (staff, bay, room), which is how
// a shop runs a day. A resource cannot be double-booked, so each column is one track.

// Color is status, carried by the blocks (calendar-timegrid). A click opens a
// quick-look MODAL over the diary; shift-click opens the full booking pane beside
// it, alt-click in its own window.

import { useState } from 'react';
import { PaneWaiting } from '../../components/pane-waiting';
import { PaneLoadError } from '../../components/pane-load-error';
import { Card, Text } from '@wizeworks/silicaui-react';
import { faCalendarXmark } from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';
import { PANE_SHELL } from '../../components/pane-toolbar';
import { CalendarToolbar } from './calendar-toolbar';
import type { SurfaceContext } from '../../lib/surfaces/registry';
import { CalendarBookingModal } from './calendar-booking-modal';
import { type CalendarEvent } from './calendar-data';
import { TimeGrid, targetFor } from './calendar-timegrid';
import { emptyLine } from './calendar-columns';
import { useDiary, type Diary } from './calendar-diary-state';
import { RowOpenHint } from '../../components/row-open-hint';

/** Registry module for this pane, so the brand draws Bookings' own picture rather
 *  than the generic one. */
const MODULE = 'scheduling';

type OpenEvent = (event: CalendarEvent, modifiers: { shiftKey: boolean; altKey: boolean }) => void;

function DiaryBody({ diary, onOpenEvent }: { diary: Diary; onOpenEvent: OpenEvent }) {
  const { query, events, view, resourceId, anchor, shut } = diary;
  if (query.isError) {
    return (
      <PaneLoadError
        module={MODULE}
        icon={<Icon glyph={faCalendarXmark} className="size-6" aria-hidden />}
        title="Could not load your diary"
        description="This is a problem reaching the server. Nothing in your diary has changed: the bookings just could not be read just now."
        error={query.error}
        onRetry={() => {
          void query.refetch();
        }}
      />
    );
  }

  if (query.isLoading && events.length === 0) {
    return <PaneWaiting module={MODULE} label="Loading your diary…" />;
  }

  return (
    <div className="relative h-full">
      <TimeGrid
        columns={diary.columns}
        window={diary.timeWindow}
        columnMinClass={diary.columnMinClass}
        revealNonce={diary.revealNonce}
        onOpenEvent={onOpenEvent}
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
}

function DiaryToolbar({ diary, ctx }: { diary: Diary; ctx: SurfaceContext }) {
  const { query } = diary;
  return (
    <CalendarToolbar
      label={diary.label}
      view={diary.view}
      resourceId={diary.resourceId}
      resources={diary.activeResources}
      isFetching={query.isFetching}
      updatedAt={query.data ? query.dataUpdatedAt : undefined}
      onSetView={diary.changeView}
      onSetAnchor={diary.moveTo}
      onSetResourceId={diary.setResourceId}
      onStep={diary.step}
      onRefresh={() => {
        void query.refetch();
      }}
      onOpenLinkedCalendars={() => {
        ctx.open('scheduling.calendar.connections', {}, { target: 'beside' });
      }}
    />
  );
}

export function CalendarSurface({ ctx }: { ctx: SurfaceContext }) {
  const diary = useDiary();
  // The booking shown in the quick-look modal, or null when it is closed.
  const [selectedBookingId, setSelectedBookingId] = useState<string | null>(null);

  const openBooking: OpenEvent = (event, modifiers) => {
    // Shift/alt jumps straight to the full booking PANE; a plain click opens the
    // quick-look modal, which keeps the calendar in view behind it.
    if (modifiers.shiftKey || modifiers.altKey) {
      ctx.open('scheduling.bookings.detail', { id: event.id }, { target: targetFor(modifiers) });
      return;
    }
    setSelectedBookingId(event.id);
  };

  return (
    <div className={PANE_SHELL}>
      <DiaryToolbar diary={diary} ctx={ctx} />

      {/* One Card around every state, uncapped: the diary earns the full width it is
          given, and the Card carries Piggles' resting elevation (DESIGN.md §4). */}
      <Card className="min-h-0 flex-1 overflow-hidden">
        <DiaryBody diary={diary} onOpenEvent={openBooking} />
      </Card>

      {diary.events.length > 0 ? <RowOpenHint what="a booking to open it" /> : null}

      {/* Floats over the diary; the grid stays mounted and live behind it. */}
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
