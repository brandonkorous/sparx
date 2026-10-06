import type { BookingType, BookingStatus, SeriesStatus, WaitlistStatus } from './shapes';

/* ── Query keys ─────────────────────────────────────────────────────────── */

export type BookingOrder = 'asc' | 'desc';

export interface BookingQuery {
  q?: string;
  status?: BookingStatus | '';
  bookingType?: BookingType | '';
  /** Only this customer's bookings. The API has always taken it; nothing asked,
   *  so a person's record could not show what they had ever been booked for. */
  customerId?: string;
  /** Only bookings for this service. Also always taken by the API, also never
   *  asked for — so nothing could count what a service was about to lose when
   *  someone removed it (issue 145). */
  serviceId?: string;
  /** ISO instant; bookings that start at or after it. 'What is still to come'. */
  from?: string;
  /** Any of these statuses. A cancelled appointment in the future is not one
   *  that is still to come, so counting what is ahead has to say which. */
  statusIn?: BookingStatus[];
  order: BookingOrder;
  take: number;
  skip: number;
}

export interface SeriesQuery {
  q?: string;
  status?: SeriesStatus | '';
  take: number;
  skip: number;
}

export interface WaitlistQuery {
  q?: string;
  serviceId?: string;
  status?: WaitlistStatus | '';
  take: number;
  skip: number;
}

export const bookingKeys = {
  all: ['scheduling', 'bookings'] as const,
  list: (query: BookingQuery) => [...bookingKeys.all, 'list', query] as const,
  detail: (id: string) => [...bookingKeys.all, id] as const,
  timeline: (id: string) => [...bookingKeys.all, id, 'timeline'] as const,
};

export const seriesKeys = {
  all: ['scheduling', 'series'] as const,
  list: (query: SeriesQuery) => [...seriesKeys.all, 'list', query] as const,
  detail: (id: string) => [...seriesKeys.all, id] as const,
};

export const waitlistKeys = {
  all: ['scheduling', 'waitlist'] as const,
  list: (query: WaitlistQuery) => [...waitlistKeys.all, 'list', query] as const,
};

export const lookupKeys = {
  services: (q: string, type: BookingType | '') =>
    ['scheduling', 'lookup', 'services', { q, type }] as const,
  resources: () => ['scheduling', 'lookup', 'resources'] as const,
  customers: (q: string) => ['scheduling', 'lookup', 'customers', { q }] as const,
  customer: (id: string) => ['scheduling', 'lookup', 'customer', id] as const,
};
