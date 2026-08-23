'use client';

// What removing a service actually costs, counted before it is offered.
//
// The confirm used to say "Bookings already made against it are kept. This
// cannot be undone." Both halves were the wrong shape (issue 145): the first is
// a reassurance with no number in it, and the second was untrue — the row is
// only stamped `deletedAt`, so it can be put straight back.
//
// The API has always taken `serviceId` and `from` on the bookings list. Nothing
// asked, so nothing could count.

import { useMemo } from 'react';

import { useBookings, type BookingStatus } from './bookings-data';

/** The states an appointment can still be in when it happens. A cancelled or
 *  no-show booking sitting in the future is not one somebody is coming for, and
 *  counting it as one is how a warning overstates itself. */
const LIVE: BookingStatus[] = ['requested', 'confirmed', 'waitlisted', 'in_progress'];

export interface ServiceLosses {
  /** Null while either count is still loading — never a number nobody measured. */
  total: number | null;
  upcoming: number | null;
}

export function useServiceLosses(serviceId: string | null): ServiceLosses {
  const id = serviceId ?? '';
  // Fixed when the pane opens rather than read on every render: 'now' in a query
  // key is a new key every frame, and the two counts would refetch forever.
  const now = useMemo(() => new Date().toISOString(), [id]);
  // One row each: only the totals are wanted, and `take: 1` is the cheapest way
  // to ask an endpoint that reports one.
  const all = useBookings({ serviceId: id, order: 'desc', take: 1, skip: 0 });
  const ahead = useBookings({
    serviceId: id,
    from: now,
    statusIn: LIVE,
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
  if (total === null || upcoming === null) return 'Bookings already made against it are kept.';
  if (total === 0) return 'Nothing has ever been booked on it.';
  if (upcoming === 0) {
    return `${plural(total, 'booking was', 'bookings were')} taken on it, all in the past. They keep their time and their price.`;
  }
  return `${plural(total, 'booking was', 'bookings were')} taken on it and ${plural(upcoming, 'is', 'are')} still to come. Those keep their time and their price, and stay in your diary.`;
}

/** The whole description, in the order it matters: what happens to the people
 *  already booked, then what happens to the website, then the way back. */
export function removalConsequence(losses: ServiceLosses): string {
  return `${bookingsLine(losses)} It comes off your website straight away, so nobody new can book it. You can put it back from your services list.`;
}
