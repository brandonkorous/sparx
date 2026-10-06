/* ── Shapes: the booking record ─────────────────────────────────────────── */

/** The bookable thing, as embedded on a booking or offered in a picker. */
export interface ServiceLite {
  id: string;
  name: string;
  bookingType: BookingType;
  durationMinutes: number;
  priceCents: number;
  currency: string;
  color: string | null;
  /** The place it happens at, when it names one. Its zone is the clock a new
   *  booking's time is typed on (sparx persona issue 086). The list returns it;
   *  the copy embedded on a booking does not, hence optional. */
  locationId?: string | null;
}

/** Anything a booking consumes the time of — a member of staff, a room, a bay. */
export interface ResourceLite {
  id: string;
  name: string;
  kind: string;
  color: string | null;
}

/** One resource allocated to a booking (staff/room), with its own window. */
export interface BookingResourceRow {
  id: string;
  role: string;
  status: string;
  startAt: string;
  endAt: string;
  resource: ResourceLite;
}

/** One seat on a class / party member on a reservation. */
export interface BookingAttendeeRow {
  id: string;
  customerId: string | null;
  guestName: string | null;
  partySize: number;
  status: string;
  waitlistPosition: number | null;
}

export type BookingType = 'appointment' | 'class' | 'reservation' | 'rental';
export type BookingStatus =
  'requested' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled' | 'no_show' | 'waitlisted';

/** One booking in full: the shape the list rows AND the detail pane both read.
 *  Times are ISO strings; `timezone` is the zone the booking was made in and is
 *  what its times should be shown in. */
export interface Booking {
  id: string;
  serviceId: string;
  bookingType: BookingType;
  seriesId: string | null;
  locationId: string | null;
  status: BookingStatus;
  startAt: string;
  endAt: string;
  timezone: string;
  capacity: number;
  partySize: number | null;
  customerId: string | null;
  companyId: string | null;
  assetRef: Record<string, unknown> | null;
  partsLinked: unknown[];
  workOrderId: string | null;
  source: string;
  policyId: string | null;
  depositStatus: string | null;
  paymentIntentId: string | null;
  intakeSubmissionId: string | null;
  notes: string | null;
  staffNotes: string | null;
  confirmedAt: string | null;
  checkedInAt: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
  cancellationReason: string | null;
  noShowAt: string | null;
  createdAt: string;
  updatedAt: string;
  service: ServiceLite;
  resources: BookingResourceRow[];
  attendees: BookingAttendeeRow[];
  /** Who it is for, NAMED — null for a walk-in with no account. The list used to
   *  have only `customerId` and printed the words "A customer" beside a booking
   *  whose customer the database could name (issue 138). */
  customer: BookedCustomer | null;
  /** What the card was asked to do when the booking ended, and whether it did
   *  (sparx persona issue 087). On the record only; null means nothing recorded.
   *  The deposit status says where the money is; this says why. */
  payment?: BookingPayment | null;
}

/** The last word on a booking's card, from its history. */
export interface BookingPayment {
  /** The payment provider did what was asked. */
  done: boolean;
  move: 'capture_fee' | 'release_hold' | 'call_off' | 'refund_deposit' | 'keep_deposit';
  ending: 'no_show' | 'cancel' | 'complete';
  amountCents: number;
  currency: string;
  /** The payment provider's words when it did not. */
  reason: string | null;
  at: string;
}

/** The part of a customer a booking surface needs to say who turned up. */
export interface BookedCustomer {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  phone: string | null;
}

/* ── Shapes: recurring series ───────────────────────────────────────────── */

export type SeriesStatus = 'active' | 'completed' | 'cancelled';

export interface BookingSeries {
  id: string;
  serviceId: string;
  rrule: string;
  status: SeriesStatus;
  customerId: string | null;
  resourceIds: string[];
  materializedThrough: string | null;
  serviceName: string | null;
  totalBookings: number;
  upcomingBookings: number;
  createdAt: string;
  updatedAt: string;
}

/** A compact occurrence row on a series detail — a real booking, but the detail
 *  only needs when it is and where it stands. */
export interface SeriesOccurrence {
  id: string;
  status: BookingStatus;
  startAt: string;
  endAt: string;
  /** The zone the occurrence was booked in, which is the clock its time is
   *  read on. Without it the list printed each one on this computer's clock. */
  timezone: string;
}

export interface BookingSeriesDetail extends BookingSeries {
  bookings: SeriesOccurrence[];
}

/* ── Shapes: waiting list ───────────────────────────────────────────────── */

export type WaitlistStatus = 'waiting' | 'offered' | 'booked' | 'expired' | 'cancelled';

export interface WaitlistEntry {
  id: string;
  serviceId: string;
  customerId: string;
  resourcePref: string | null;
  desiredFrom: string;
  desiredTo: string;
  status: WaitlistStatus;
  offeredAt: string | null;
  offerExpiresAt: string | null;
  createdAt: string;
  serviceName: string | null;
  customerName: string;
  customerEmail: string | null;
}

/** A person to book for, in the customer search. */
export interface CustomerLite {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  /** Ring them when they are late. The API has always returned it; nothing had
   *  ever asked, so a booking could not show a phone number (issue 111). */
  phone: string | null;
  company: string | null;
}

/* ── Reads: the change history ──────────────────────────────────────────── */

/** One entry in a booking's audit trail, exactly as `GET …/:id/timeline` returns
 *  it. `diff` carries whatever the action recorded — old→new times for a move,
 *  a `changes` map for an edit, a reason for a cancellation — or nothing. */
export interface BookingTimelineEntry {
  id: string;
  action: string;
  actorId: string | null;
  actorType: string | null;
  diff: Record<string, unknown> | null;
  createdAt: string;
}
