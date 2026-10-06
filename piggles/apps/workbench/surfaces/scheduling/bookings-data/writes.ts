'use client';

import { useMutation, useQueryClient } from '@wizeworks/query';
import { api } from '../../../lib/api/client';
import type { Booking, BookingSeries, SeriesOccurrence, WaitlistEntry } from './shapes';
import { bookingKeys, seriesKeys, waitlistKeys } from './keys';

/* ── Invalidation ───────────────────────────────────────────────────────── */

/** The one way anything here says "a booking changed" — refreshes every booking
 *  list window and, when known, the one record that moved. */
export function useInvalidateBookings() {
  const queryClient = useQueryClient();
  return (id?: string) => {
    void queryClient.invalidateQueries({ queryKey: bookingKeys.all });
    if (id) void queryClient.invalidateQueries({ queryKey: bookingKeys.detail(id) });
  };
}

/* ── Write payloads ─────────────────────────────────────────────────────── */

export interface CreateBookingPayload {
  serviceId: string;
  startAt: string;
  timezone?: string;
  customerId?: string;
  partySize?: number;
  resourceIds: string[];
  notes?: string;
  source: string;
}

export interface UpdateBookingPayload {
  notes?: string | null;
  staffNotes?: string | null;
}

/* ── Writes: bookings ───────────────────────────────────────────────────── */

export function useCreateBooking() {
  const invalidate = useInvalidateBookings();
  return useMutation({
    mutationFn: (input: CreateBookingPayload) =>
      api.post<Booking>('/v1/scheduling/bookings', input),
    onSuccess: (booking) => {
      invalidate(booking.id);
    },
  });
}

export function useUpdateBooking(id: string) {
  const invalidate = useInvalidateBookings();
  return useMutation({
    mutationFn: (input: UpdateBookingPayload) =>
      api.patch<Booking>(`/v1/scheduling/bookings/${id}`, input),
    onSuccess: () => {
      invalidate(id);
    },
  });
}

/** The lifecycle moves — each a dedicated server action, never a free-form status
 *  write, because entering a stage has effects (releasing a slot, capturing a fee). */
function useBookingAction(id: string, action: string) {
  const invalidate = useInvalidateBookings();
  return useMutation({
    mutationFn: (body?: Record<string, unknown>) =>
      api.post<Booking>(`/v1/scheduling/bookings/${id}/${action}`, body ?? {}),
    onSuccess: () => {
      invalidate(id);
    },
  });
}

export function useConfirmBooking(id: string) {
  return useBookingAction(id, 'confirm');
}
export function useCheckInBooking(id: string) {
  return useBookingAction(id, 'check-in');
}
export function useCompleteBooking(id: string) {
  return useBookingAction(id, 'complete');
}
export function useNoShowBooking(id: string) {
  return useBookingAction(id, 'no-show');
}
export function useCancelBooking(id: string) {
  return useBookingAction(id, 'cancel');
}
export function useRescheduleBooking(id: string) {
  return useBookingAction(id, 'reschedule');
}

/* ── Writes: series ─────────────────────────────────────────────────────── */

export interface CreateSeriesPayload {
  serviceId: string;
  startAt: string;
  rrule: string;
  customerId?: string;
  resourceIds: string[];
}

export interface CreatedSeriesResult {
  series: BookingSeries;
  created: SeriesOccurrence[];
  skipped: { startAt: string; reason: string }[];
}

export function useCreateSeries() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateSeriesPayload) =>
      api.post<CreatedSeriesResult>('/v1/scheduling/series', input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: seriesKeys.all });
      // Every occurrence it materialised is a booking in the booking list.
      void queryClient.invalidateQueries({ queryKey: bookingKeys.all });
    },
  });
}

export function useCancelSeries(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { scope: 'future' | 'all'; reason?: string }) =>
      api.post<{ id: string; cancelled: number }>(`/v1/scheduling/series/${id}/cancel`, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: seriesKeys.all });
      void queryClient.invalidateQueries({ queryKey: bookingKeys.all });
    },
  });
}

/* ── Writes: waiting list ───────────────────────────────────────────────── */

export interface CreateWaitlistPayload {
  serviceId: string;
  customerId: string;
  resourcePref?: string;
  desiredFrom: string;
  desiredTo: string;
}

export function useInvalidateWaitlist() {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: waitlistKeys.all });
  };
}

export function useCreateWaitlistEntry() {
  const invalidate = useInvalidateWaitlist();
  return useMutation({
    mutationFn: (input: CreateWaitlistPayload) =>
      api.post<WaitlistEntry>('/v1/scheduling/waitlist', input),
    onSuccess: () => {
      invalidate();
    },
  });
}

export function useOfferWaitlist(id: string) {
  const invalidate = useInvalidateWaitlist();
  return useMutation({
    mutationFn: (input: { offerTtlMinutes: number }) =>
      api.post<WaitlistEntry>(`/v1/scheduling/waitlist/${id}/offer`, input),
    onSuccess: () => {
      invalidate();
    },
  });
}

export function useAcceptWaitlist(id: string) {
  const invalidate = useInvalidateWaitlist();
  const invalidateBookings = useInvalidateBookings();
  return useMutation({
    mutationFn: (input: { startAt: string; resourceIds: string[] }) =>
      api.post<{ entry: WaitlistEntry; bookingId: string }>(
        `/v1/scheduling/waitlist/${id}/accept`,
        input
      ),
    onSuccess: (result) => {
      invalidate();
      invalidateBookings(result.bookingId);
    },
  });
}

export function useRemoveWaitlist(id: string) {
  const invalidate = useInvalidateWaitlist();
  return useMutation({
    mutationFn: () => api.delete<WaitlistEntry>(`/v1/scheduling/waitlist/${id}`),
    onSuccess: () => {
      invalidate();
    },
  });
}
