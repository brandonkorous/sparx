'use client';

// ONE BOOKING — take a new one, then manage it through its life.
//
// A new booking and an existing one are the same appointment at two ages, so
// this is ONE pane in two states: `{id:'new'}` is the form that takes a booking
// ([booking-create.tsx]), `{id}` is the record it becomes ([booking-manage.tsx])
// — the same pane, replaced in place after the create. The two states show
// different controls because a booking's shape changes once it exists: you no
// longer re-pick its service, you move it in time, confirm it, and see it
// through. This mirrors the sites create-and-manage pane.

import { Card } from '@wizeworks/silicaui-react';

import { PaneWaiting } from '../../components/pane-waiting';
import { PaneLoadError } from '../../components/pane-load-error';
import { PANE_SHELL } from '../../components/pane-toolbar';
import type { SurfaceContext } from '../../lib/surfaces/registry';
import { BookingCreate } from './booking-create';
import { BookingManage } from './booking-manage';
import { isNotFound, useBooking } from './bookings-data';

export function BookingDetailSurface({ ctx }: { ctx: SurfaceContext }) {
  const id = typeof ctx.params.id === 'string' ? ctx.params.id : 'new';
  const booking = useBooking(id);

  if (id === 'new') {
    return <BookingCreate ctx={ctx} />;
  }

  // A failed load REPLACES the record — never a live form beside a dead action.
  if (booking.isError) {
    const gone = isNotFound(booking.error);
    return (
      <div className={PANE_SHELL}>
        <Card className="min-h-0 flex-1 items-center justify-center">
          <PaneLoadError
            reason={gone ? 'missing' : 'unreachable'}
            title={gone ? 'This booking no longer exists' : 'Could not load this booking'}
            description={
              gone
                ? 'It may have been removed. Nothing else is affected.'
                : 'This is a problem reaching the server. Nothing about the booking has changed.'
            }
            onRetry={() => {
              void booking.refetch();
            }}
          />
        </Card>
      </div>
    );
  }

  if (booking.isPending || !booking.data) {
    return (
      <div className={PANE_SHELL}>
        <PaneWaiting />
      </div>
    );
  }

  // `key` remounts the editor when the pane is pointed at a different booking, so
  // notes state re-seeds from the new row — the replace hop after create needs this.
  return (
    <BookingManage
      key={booking.data.id}
      ctx={ctx}
      booking={booking.data}
      isFetching={booking.isFetching}
      updatedAt={booking.dataUpdatedAt}
      onRefresh={() => {
        void booking.refetch();
      }}
    />
  );
}

export default BookingDetailSurface;
