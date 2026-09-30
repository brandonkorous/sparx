'use client';

// WHAT THIS PERSON HAS BEEN BOOKED FOR: their whole diary, on their record.
//
// A customer's record carried ten tabs and not one of them was their
// appointments. For a salon, a clinic, a studio or a garage that IS the customer
// history: "when was she last in, who did she see, and what did she have" is the
// question you ask before she sits down, and the only way to answer it was to
// open the diary and scroll. The data needed nothing new: the booking list has
// always taken a `customerId` filter, and nothing had ever passed one.
//
// Newest first, past and future in one run, because "when were they last in" and
// "are they coming back" are the same glance. A row opens the real booking pane,
// because a booking has one home and this is a lens onto it.

import { Badge, Table } from '@wizeworks/silicaui-react';
import { CalendarCheck } from 'lucide-react';

import { ModuleScope } from '../../components/module-scope';
import type { OpenTarget, SurfaceContext } from '../../lib/surfaces/registry';
import {
  bookingResourceLabel,
  bookingStateMeta,
  formatClock,
  formatDay,
  useBookings,
} from '../scheduling/bookings-data';
import { openableRowProps, RelatedCard } from './customer-related';

/** As many as anyone reads on a record. The diary is where a long history is
 *  worked; this is the glance before they sit down. */
const SHOWN = 50;

function targetFor(event: { shiftKey: boolean; altKey: boolean }): OpenTarget {
  if (event.altKey) return 'window';
  if (event.shiftKey) return 'beside';
  return 'tab';
}

export function CustomerBookingsTab({
  ctx,
  customerId,
}: {
  ctx: SurfaceContext;
  customerId: string;
}) {
  const { data, isPending, isError } = useBookings({
    customerId,
    order: 'desc',
    take: SHOWN,
    skip: 0,
  });
  const rows = data?.items ?? [];
  const total = data?.total ?? 0;

  return (
    // The Bookings app's data, wearing the Bookings app's hue: color follows
    // functionality, so the state badges here say which app they came from.
    <ModuleScope module="scheduling">
      <RelatedCard
        isPending={isPending}
        isError={isError}
        isEmpty={rows.length === 0}
        icon={<CalendarCheck className="size-6" aria-hidden />}
        emptyTitle="Never booked in"
        emptyDescription="Nothing has been booked for this person yet. Anything taken for them, online or by hand, appears here."
      >
        <Table size="sm" hover>
          <thead>
            <tr>
              <th>When</th>
              <th>What</th>
              <th className="hidden @lg:table-cell">With</th>
              <th className="text-right">State</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((booking) => {
              const meta = bookingStateMeta(booking.status);
              return (
                <tr
                  key={booking.id}
                  {...openableRowProps((event) => {
                    ctx.open(
                      'scheduling.bookings.detail',
                      { id: booking.id },
                      { target: targetFor(event) }
                    );
                  })}
                >
                  <td className="align-top whitespace-nowrap">
                    <div className="font-medium">
                      {formatDay(booking.startAt, booking.timezone)}
                    </div>
                    <div className="text-sm">{formatClock(booking.startAt, booking.timezone)}</div>
                  </td>
                  <td className="align-top">{booking.service.name}</td>
                  <td className="hidden align-top @lg:table-cell">
                    {bookingResourceLabel(booking)}
                  </td>
                  <td className="text-right align-top">
                    <Badge color={meta.tone} variant="soft" size="sm">
                      {meta.label}
                    </Badge>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </Table>
        {/* Past the cap, say so: a record that silently shows fifty of eighty
            reads as "this is everything", and it is not. */}
        {total > rows.length ? (
          <p className="border-base-200 border-t px-4 py-3 text-base">
            Showing the latest {String(rows.length)} of {String(total)} bookings. The rest are in
            the Bookings list.
          </p>
        ) : null}
      </RelatedCard>
    </ModuleScope>
  );
}
