'use client';

import { useQuery } from '@wizeworks/query';
import { ApiError } from '@wizeworks/api-client';
import { api } from '../../../lib/api/client';
import type {
  ServiceLite,
  ResourceLite,
  BookingType,
  Booking,
  BookingSeries,
  BookingSeriesDetail,
  WaitlistEntry,
  CustomerLite,
  BookingTimelineEntry,
} from './shapes';
import {
  type BookingQuery,
  type SeriesQuery,
  type WaitlistQuery,
  bookingKeys,
  seriesKeys,
  waitlistKeys,
  lookupKeys,
} from './keys';

/* ── Reads: bookings ────────────────────────────────────────────────────── */

/** One window of the booking list. Every narrowing (search, status, type, order,
 *  paging) is a SERVER filter: filtering only the loaded page in the browser would
 *  answer "the soonest ten requested" with the wrong ten. */
export function useBookings(query: BookingQuery) {
  return useQuery({
    queryKey: bookingKeys.list(query),
    queryFn: () =>
      api.list<Booking>('/v1/scheduling/bookings', {
        ...(query.q ? { q: query.q } : {}),
        ...(query.status ? { status: query.status } : {}),
        ...(query.bookingType ? { bookingType: query.bookingType } : {}),
        ...(query.customerId ? { customerId: query.customerId } : {}),
        ...(query.serviceId ? { serviceId: query.serviceId } : {}),
        ...(query.from ? { from: query.from } : {}),
        ...(query.statusIn?.length ? { statusIn: query.statusIn.join(',') } : {}),
        order: query.order,
        take: query.take,
        skip: query.skip,
      }),
    // Hold the current window on screen while the next one loads, so paging and
    // re-sorting don't blink the table out and back.
    placeholderData: (previous) => previous,
  });
}

export function useBooking(id: string) {
  return useQuery({
    queryKey: bookingKeys.detail(id),
    queryFn: () => api.get<Booking>(`/v1/scheduling/bookings/${id}`),
    enabled: id !== 'new',
    // A 404 means the booking is gone — an answer, not a fault worth three retries.
    retry: (failureCount, error) =>
      error instanceof ApiError && error.status === 404 ? false : failureCount < 2,
  });
}

/** The lifecycle trail for one booking. Nested under the booking's own key, so
 *  every lifecycle write (which invalidates the booking root) refreshes this too. */
export function useBookingTimeline(id: string) {
  return useQuery({
    queryKey: bookingKeys.timeline(id),
    queryFn: () => api.get<BookingTimelineEntry[]>(`/v1/scheduling/bookings/${id}/timeline`),
    enabled: id !== '' && id !== 'new',
    retry: (failureCount, error) =>
      error instanceof ApiError && error.status === 404 ? false : failureCount < 2,
  });
}

/* ── Reads: series ──────────────────────────────────────────────────────── */

export function useBookingSeriesList(query: SeriesQuery) {
  return useQuery({
    queryKey: seriesKeys.list(query),
    queryFn: () =>
      api.list<BookingSeries>('/v1/scheduling/series', {
        ...(query.q ? { q: query.q } : {}),
        ...(query.status ? { status: query.status } : {}),
        take: query.take,
        skip: query.skip,
      }),
    placeholderData: (previous) => previous,
  });
}

export function useBookingSeries(id: string) {
  return useQuery({
    queryKey: seriesKeys.detail(id),
    queryFn: () => api.get<BookingSeriesDetail>(`/v1/scheduling/series/${id}`),
    enabled: id !== 'new',
    retry: (failureCount, error) =>
      error instanceof ApiError && error.status === 404 ? false : failureCount < 2,
  });
}

/* ── Reads: waiting list ────────────────────────────────────────────────── */

/** One window of the waiting list. Search, status, service and paging are ALL
 *  server filters, so "the next fifty waiting for this service" is answered against
 *  the whole list, not whichever page happens to be loaded. */
export function useWaitlist(query: WaitlistQuery) {
  return useQuery({
    queryKey: waitlistKeys.list(query),
    queryFn: () =>
      api.list<WaitlistEntry>('/v1/scheduling/waitlist', {
        ...(query.q ? { q: query.q } : {}),
        ...(query.serviceId ? { serviceId: query.serviceId } : {}),
        ...(query.status ? { status: query.status } : {}),
        take: query.take,
        skip: query.skip,
      }),
    // Hold the current window while the next loads, so paging and re-filtering
    // don't blink the table out and back.
    placeholderData: (previous) => previous,
  });
}

/* ── Reads: the pickers ─────────────────────────────────────────────────── */

/** The bookable services, for the service picker on a create form. Long-lived —
 *  the catalog of what you offer changes rarely and is referenced constantly. */
export function useSchedulingServices(q: string, type: BookingType | '' = '') {
  return useQuery({
    queryKey: lookupKeys.services(q, type),
    queryFn: () =>
      api.list<ServiceLite>('/v1/scheduling/services', {
        ...(q ? { q } : {}),
        ...(type ? { bookingType: type } : {}),
        activeOnly: true,
        take: 250,
      }),
    staleTime: 5 * 60_000,
  });
}

/** The resources a booking can be pinned to. Empty selection lets the engine
 *  assign one; naming them is what a "pick your stylist" service needs. */
export function useSchedulingResources() {
  return useQuery({
    queryKey: lookupKeys.resources(),
    queryFn: () => api.get<ResourceLite[]>('/v1/scheduling/resources', { activeOnly: true }),
    staleTime: 5 * 60_000,
  });
}

/** One customer by id — used to put a real name on a booking whose row carries
 *  only a `customerId` (the booking API does not join the customer name). */
export function useCustomer(id: string | null | undefined) {
  return useQuery({
    queryKey: lookupKeys.customer(id ?? ''),
    queryFn: () => api.get<CustomerLite>(`/v1/crm/customers/${id ?? ''}`),
    enabled: Boolean(id),
    staleTime: 60_000,
    retry: (failureCount, error) =>
      error instanceof ApiError && error.status === 404 ? false : failureCount < 2,
  });
}

/** Find a customer to book for. Debounce-free by design — the caller only enables
 *  it once a couple of characters are typed. */
export function useCustomerSearch(q: string) {
  const query = q.trim();
  return useQuery({
    queryKey: lookupKeys.customers(query),
    queryFn: () => api.list<CustomerLite>('/v1/crm/customers', { q: query, take: 20 }),
    enabled: query.length >= 2,
    staleTime: 30_000,
  });
}
