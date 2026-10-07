'use client';

// When this person is next in, when they were last in, and what is booked ahead.
//
// For a salon, a studio, a clinic or a garage those ARE the relationship. Halo &
// Hem's Priyanka Deshmukh had a $180 color appointment on Friday, and her record
// led with "Total spent $0.00 · Orders 0 · Last order None yet" over "Nothing
// here yet": a booked, paying client described as having nothing and being worth
// nothing (persona issue 113). So in a business with the Bookings app this row
// leads the record, in the Bookings hue, and the record counts her as someone
// with something on it.
//
// What it counts:
//   - Next visit: the soonest booking still to come that nobody has called off.
//   - Last visit: the most recent booking whose time has passed, that the
//     business accepted and nobody called off or marked missed. NOT only the
//     ones marked done: plenty of salons never press Complete, and Priyanka's
//     August appointment still read "confirmed" in October.
//   - Visits so far: every booking that counts as a last visit.
//   - Booked ahead: what the visits still to come are worth at today's prices.
//     Past visits are not summed: a booking keeps no price of its own, and the
//     price a service had last spring is not on record.

import { useState } from 'react';

import { ModuleScope } from '../../components/module-scope';
import { useModuleStates } from '../../lib/api/shell-data';
import {
  type Booking,
  type BookingStatus,
  formatClock,
  formatDay,
  formatMoney,
  useBookings,
} from '../scheduling/bookings-data';
import { describeOrderRecency } from './customers-data';
import { Kpi } from './customer-kpi';

/** A booking still to come is one nobody has called off or finished. */
const AHEAD: BookingStatus[] = ['requested', 'confirmed', 'in_progress'];
/** A booking in the past that happened, as far as the record knows. */
const HAPPENED: BookingStatus[] = ['confirmed', 'in_progress', 'completed'];
/** Enough to price everything booked ahead for anyone but a standing order. */
const AHEAD_READ = 100;

export interface CustomerVisits {
  /** The Bookings app is on and reachable, so this person can have visits. */
  shown: boolean;
  isPending: boolean;
  isError: boolean;
  next: Booking | null;
  last: Booking | null;
  visitsSoFar: number;
  ahead: Booking[];
  aheadTotal: number;
}

/** The reads behind the row, owned by the tab so its "is there anything on this
 *  record" answer counts bookings too. */
export function useCustomerVisits(customerId: string): CustomerVisits {
  const { data: modules } = useModuleStates();
  const app = modules?.find((module) => module.slug === 'scheduling');
  // Only a known "off" hides it; a slow modules read never does.
  const shown = !(app && (!app.enabled || app.reachable === false));
  // Fixed for the life of the pane, so the query key holds still.
  const [now] = useState(() => new Date().toISOString());

  const aheadQ = useBookings(
    {
      customerId,
      from: now,
      statusIn: AHEAD,
      order: 'asc',
      take: AHEAD_READ,
      skip: 0,
    },
    { enabled: shown }
  );
  const lastQ = useBookings(
    { customerId, to: now, statusIn: HAPPENED, order: 'desc', take: 1, skip: 0 },
    { enabled: shown }
  );

  const ahead = aheadQ.data?.items ?? [];
  return {
    shown,
    isPending: shown && (aheadQ.isPending || lastQ.isPending),
    isError: shown && (aheadQ.isError || lastQ.isError),
    next: ahead[0] ?? null,
    last: lastQ.data?.items[0] ?? null,
    visitsSoFar: lastQ.data?.total ?? 0,
    ahead,
    aheadTotal: aheadQ.data?.total ?? ahead.length,
  };
}

/** True when there is something to show: a visit behind them or one to come. */
export function hasVisits(visits: CustomerVisits): boolean {
  return visits.shown && (visits.next !== null || visits.last !== null);
}

/** What the visits still to come are worth, or null when it cannot be said in
 *  one currency or not all of them were read. */
function aheadWorth(visits: CustomerVisits): { cents: number; currency: string } | null {
  const first = visits.ahead[0];
  if (!first || visits.aheadTotal > visits.ahead.length) return null;
  const currency = first.service.currency;
  if (visits.ahead.some((b) => b.service.currency !== currency)) return null;
  return { cents: visits.ahead.reduce((sum, b) => sum + b.service.priceCents, 0), currency };
}

function visitCount(n: number): string {
  return n === 1 ? '1 visit' : `${n.toLocaleString()} visits`;
}

export function VisitKpis({ visits }: { visits: CustomerVisits }) {
  const { next, last } = visits;
  const worth = aheadWorth(visits);

  return (
    // Bookings' numbers wear the Bookings hue, beside Commerce's own row.
    <ModuleScope module="scheduling">
      <div className="grid grid-cols-2 gap-3 @2xl:grid-cols-4">
        <Kpi
          label="Next visit"
          value={next ? formatDay(next.startAt, next.timezone) : 'Nothing booked'}
          hint={
            next ? `${formatClock(next.startAt, next.timezone)} · ${next.service.name}` : undefined
          }
        />
        <Kpi
          label="Last visit"
          value={last ? describeOrderRecency(last.startAt) : 'Not yet'}
          hint={
            last ? `${formatDay(last.startAt, last.timezone)} · ${last.service.name}` : undefined
          }
        />
        <Kpi label="Visits so far" value={visits.visitsSoFar.toLocaleString()} />
        <Kpi
          label="Booked ahead"
          value={
            worth
              ? formatMoney(worth.cents, worth.currency)
              : visits.aheadTotal > 0
                ? visitCount(visits.aheadTotal)
                : '—'
          }
          hint={
            worth && visits.aheadTotal > 0
              ? `${visitCount(visits.aheadTotal)}, at today's prices`
              : undefined
          }
        />
      </div>
    </ModuleScope>
  );
}
