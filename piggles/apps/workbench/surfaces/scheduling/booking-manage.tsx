'use client';

// ONE BOOKING, once it exists. Advancing it (confirm → check in → complete) is its
// position, so that lives in the toolbar; the rare, hard-to-undo outcomes sit at the
// bottom under a divider.

import { useEffect } from 'react';

import { Badge } from '@wizeworks/silicaui-react';

import { PaneToolbar, PANE_SHELL } from '../../components/pane-toolbar';
import { RefreshButton } from '../../components/refresh-button';
import type { SurfaceContext } from '../../lib/surfaces/registry';
import { useBookingManage } from './booking-manage-state';
import { BookingLifecycle } from './booking-lifecycle';
import { COLUMN } from './booking-shell';
import { SaveFailure } from '@/components/save-failure';
import { bookingStateMeta, bookingTabTitle, type Booking, type Tone } from './bookings-data';
import {
  BookingNotesAndRecord,
  BookingEndingsFor,
  BookingRecordSections,
  BookingSummary,
  BookingWhoAndMove,
  type BookingManageState,
} from './booking-manage/booking-manage-sections';

interface BookingManageProps {
  ctx: SurfaceContext;
  booking: Booking;
  isFetching: boolean;
  updatedAt: number | undefined;
  onRefresh: () => void;
}

export function BookingManage(props: BookingManageProps) {
  const { ctx, booking, isFetching, updatedAt, onRefresh } = props;
  const state = useBookingManage(booking);
  const { id, policy, actionError, who, terminal } = state;
  // A booking has no name field, so the registry title was the only one it ever
  // had and four open bookings read as four tabs saying "Booking" (issue 842).
  useEffect(() => {
    ctx.setTitle(bookingTabTitle(booking));
  }, [ctx, booking]);

  const meta = bookingStateMeta(booking.status);

  return (
    <div className={PANE_SHELL}>
      <BookingManageToolbar
        booking={booking}
        meta={meta}
        state={state}
        isFetching={isFetching}
        updatedAt={updatedAt}
        onRefresh={onRefresh}
      />

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className={COLUMN}>
          {/* The service names the pane's TAB, so the body opens with the rest of
              it — when this is, who it is with, and where the money stands. */}
          <BookingSummary booking={booking} who={who} policy={policy} />

          <SaveFailure title="That did not go through" message={actionError} />

          <BookingWhoAndMove ctx={ctx} booking={booking} state={state} />

          <BookingNotesAndRecord ctx={ctx} booking={booking} state={state} />

          <BookingRecordSections id={id} booking={booking} terminal={terminal} />

          {!terminal ? <BookingEndingsFor booking={booking} state={state} /> : null}
        </div>
      </div>
    </div>
  );
}

function BookingManageToolbar({
  booking,
  meta,
  state,
  isFetching,
  updatedAt,
  onRefresh,
}: Omit<BookingManageProps, 'ctx'> & {
  meta: { label: string; tone: Tone };
  state: BookingManageState;
}) {
  const { confirm, checkIn, complete, lifecycleBusy } = state;
  return (
    <PaneToolbar
      label="Booking actions"
      refresh={
        <RefreshButton isFetching={isFetching} updatedAt={updatedAt} onRefresh={onRefresh} />
      }
      status={
        <Badge color={meta.tone} variant="soft" size="sm">
          {meta.label}
        </Badge>
      }
      primary={
        <BookingLifecycle
          booking={booking}
          confirm={confirm}
          checkIn={checkIn}
          complete={complete}
          busy={lifecycleBusy}
        />
      }
    />
  );
}
