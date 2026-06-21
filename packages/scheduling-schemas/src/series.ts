// Recurring-booking series input schemas (docs/79 §7.6). A series is an RFC 5545
// RRULE + a first-occurrence start; the engine materializes it into child bookings
// (each a normal Booking with `seriesId` set), rolling a horizon forward over time.
// Per-occurrence allocation still honors the no-overlap guarantee — a conflicting
// occurrence is skipped, not forced.

import { z } from 'zod';

import { OptionalUuid, Uuid } from './common';

// Only the fields a series persists (serviceId, rrule, customerId, resourceIds) —
// every occurrence is derived from these so the rolling-horizon tick reproduces
// them identically. Per-occurrence party size / notes / time zone are not series
// concepts (book those one-off); occurrences inherit the service + resource zone.
export const CreateBookingSeriesInput = z.object({
  serviceId: Uuid,
  /** First occurrence start (the RRULE's DTSTART anchor). */
  startAt: z.string().datetime(),
  /** RFC 5545 RRULE, with or without the leading `RRULE:` (e.g.
   *  `FREQ=WEEKLY;BYDAY=MO,WE;COUNT=12`). FREQ is required; an unbounded rule
   *  (no COUNT/UNTIL) materializes to a rolling horizon and extends over time. */
  rrule: z.string().min(3).max(1000),
  customerId: OptionalUuid,
  /** Pin specific resources for every occurrence; empty → assign per strategy. */
  resourceIds: z.array(Uuid).max(20).default([]),
});
export type CreateBookingSeriesInput = z.infer<typeof CreateBookingSeriesInput>;

export const CancelBookingSeriesInput = z.object({
  id: Uuid,
  /** `future` cancels only not-yet-started occurrences (the default); `all` also
   *  cancels in-progress/upcoming ones. Past terminal bookings are never touched. */
  scope: z.enum(['future', 'all']).default('future'),
  reason: z.string().max(2000).nullable().optional(),
});
export type CancelBookingSeriesInput = z.infer<typeof CancelBookingSeriesInput>;
