'use client';

// What removing a service actually costs, counted before it is offered.
//
// The confirm used to say "Bookings already made against it are kept. This
// cannot be undone. You would have to set it up again." Both halves were the
// wrong shape (issue 145): the first is a reassurance with no number in it, so
// an owner removing a service with eleven people booked on it next week read
// the same sentence as one removing a service nobody ever booked; and the
// second was untrue, because the row is only stamped `deletedAt` and the
// services list can put it straight back.
//
// The API has always taken `serviceId`, `from` and `statusIn` on the bookings
// list. Nothing asked, so nothing could count.
//
// The sentences live in this `.ts` rather than the pane so vitest can reach them
// (a `.tsx` cannot be imported by the tests in this app: `jsx: preserve`).

import { useMemo } from 'react';

import { useBookings, type BookingStatus } from './bookings-data';

/** The states an appointment can still be in when it happens. A canceled or
 *  no-show booking sitting in the future is not one somebody is coming for, and
 *  counting it as one is how a warning overstates itself. */
export const LIVE_STATUSES: BookingStatus[] = [
  'requested',
  'confirmed',
  'waitlisted',
  'in_progress',
];

export interface ServiceLosses {
  /** Null while the count is still loading: never a number nobody measured. */
  total: number | null;
  upcoming: number | null;
}

export function useServiceLosses(serviceId: string | null): ServiceLosses {
  const id = serviceId ?? '';
  // Fixed when the pane opens rather than read on every render: "now" in a query
  // key is a new key every frame, and the two counts would refetch forever.
  const now = useMemo(() => new Date().toISOString(), [id]);
  // One row each: only the totals are wanted, and `take: 1` is the cheapest way
  // to ask an endpoint that reports one.
  const all = useBookings({ serviceId: id, order: 'desc', take: 1, skip: 0 });
  const ahead = useBookings({
    serviceId: id,
    from: now,
    statusIn: LIVE_STATUSES,
    order: 'asc',
    take: 1,
    skip: 0,
  });
  if (!serviceId) return { total: 0, upcoming: 0 };
  return { total: all.data?.total ?? null, upcoming: ahead.data?.total ?? null };
}

function plural(count: number, one: string, many: string): string {
  return `${String(count)} ${count === 1 ? one : many}`;
}

/** What the confirm says about the bookings. Falls back to the count-free
 *  sentence while the numbers are still loading, rather than printing a zero
 *  nobody measured. */
function bookingsLine({ total, upcoming }: ServiceLosses): string {
  if (total === null || upcoming === null) return 'Bookings already made on it are kept.';
  if (total === 0) return 'Nothing has ever been booked on it.';
  if (upcoming === 0) {
    return `${plural(total, 'booking was', 'bookings were')} taken on it, all in the past. ${total === 1 ? 'It keeps its time and its price.' : 'They keep their time and their price.'}`;
  }
  return `${plural(total, 'booking was', 'bookings were')} taken on it and ${plural(upcoming, 'is', 'are')} still to come. ${upcoming === 1 ? 'That one keeps its time and its price, and stays in your diary.' : 'Those keep their time and their price, and stay in your diary.'}`;
}

/** The whole description, in the order it matters: what happens to the people
 *  already booked, then what happens to the booking page, then the way back. */
export function removalConsequence(losses: ServiceLosses): string {
  return `${bookingsLine(losses)} It comes off your booking page straight away, so nobody new can book it. You can put it back from your services list.`;
}
