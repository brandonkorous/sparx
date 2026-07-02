'use server';

// Server actions for the Scheduling dashboard. Every write goes through api-rest
// (the module gate, RLS, the no-overlap guarantee, and event publishing all live
// there); the dashboard only signs the staff JWT and surfaces the friendly error.

import { revalidatePath } from 'next/cache';
import { api, type ApiRestError } from '@/lib/api-rest-client';

import type {
  AvailabilitySlot,
  Booking,
  BookingPolicy,
  BookingSeriesDetail,
  BookingSeriesOccurrence,
  CalendarConnection,
  ClassAttendee,
  SchedulingReport,
  WaitlistEntry,
} from './types';

export type ActionResult<T = undefined> = { ok: true; data: T } | { ok: false; error: string };

function fail(err: unknown, fallback: string): { ok: false; error: string } {
  const e = err as ApiRestError;
  return { ok: false, error: e?.message ?? fallback };
}

// ── Services ────────────────────────────────────────────────────────────────
export async function createServiceAction(body: unknown): Promise<ActionResult> {
  try {
    await api.post('/v1/scheduling/services', body);
    revalidatePath('/scheduling/services');
    return { ok: true, data: undefined };
  } catch (err) {
    return fail(err, 'Failed to create service');
  }
}

export async function updateServiceAction(id: string, body: unknown): Promise<ActionResult> {
  try {
    await api.patch(`/v1/scheduling/services/${id}`, body);
    revalidatePath('/scheduling/services');
    return { ok: true, data: undefined };
  } catch (err) {
    return fail(err, 'Failed to update service');
  }
}

export async function deleteServiceAction(id: string): Promise<ActionResult> {
  try {
    await api.delete(`/v1/scheduling/services/${id}`);
    revalidatePath('/scheduling/services');
    return { ok: true, data: undefined };
  } catch (err) {
    return fail(err, 'Failed to delete service');
  }
}

// ── Booking policies (deposits / fees / reminders) ──────────────────────────
export async function listBookingPoliciesAction(): Promise<ActionResult<BookingPolicy[]>> {
  try {
    const data = await api.get<BookingPolicy[]>('/v1/scheduling/policies');
    return { ok: true, data };
  } catch (err) {
    return fail(err, 'Failed to load policies');
  }
}

export async function createBookingPolicyAction(body: unknown): Promise<ActionResult> {
  try {
    await api.post('/v1/scheduling/policies', body);
    revalidatePath('/scheduling/policies');
    return { ok: true, data: undefined };
  } catch (err) {
    return fail(err, 'Failed to create policy');
  }
}

export async function updateBookingPolicyAction(id: string, body: unknown): Promise<ActionResult> {
  try {
    await api.patch(`/v1/scheduling/policies/${id}`, body);
    revalidatePath('/scheduling/policies');
    return { ok: true, data: undefined };
  } catch (err) {
    return fail(err, 'Failed to update policy');
  }
}

export async function deleteBookingPolicyAction(id: string): Promise<ActionResult> {
  try {
    await api.delete(`/v1/scheduling/policies/${id}`);
    revalidatePath('/scheduling/policies');
    return { ok: true, data: undefined };
  } catch (err) {
    return fail(err, 'Failed to delete policy');
  }
}

// ── Resources ───────────────────────────────────────────────────────────────
export async function createResourceAction(body: unknown): Promise<ActionResult> {
  try {
    await api.post('/v1/scheduling/resources', body);
    revalidatePath('/scheduling/resources');
    return { ok: true, data: undefined };
  } catch (err) {
    return fail(err, 'Failed to create resource');
  }
}

export async function updateResourceAction(id: string, body: unknown): Promise<ActionResult> {
  try {
    await api.patch(`/v1/scheduling/resources/${id}`, body);
    revalidatePath('/scheduling/resources');
    return { ok: true, data: undefined };
  } catch (err) {
    return fail(err, 'Failed to update resource');
  }
}

export async function deleteResourceAction(id: string): Promise<ActionResult> {
  try {
    await api.delete(`/v1/scheduling/resources/${id}`);
    revalidatePath('/scheduling/resources');
    return { ok: true, data: undefined };
  } catch (err) {
    return fail(err, 'Failed to delete resource');
  }
}

/** The resource's private subscribe-to `.ics` feed URL (docs/79 §8.1). */
export async function getResourceFeedUrlAction(
  id: string
): Promise<ActionResult<{ feedUrl: string }>> {
  try {
    const data = await api.get<{ feedUrl: string }>(`/v1/scheduling/resources/${id}/calendar-feed`);
    return { ok: true, data };
  } catch (err) {
    return fail(err, 'Failed to load the calendar feed URL');
  }
}

// ── Calendar connections (inbound iCal busy import, docs/79 §8.2) ────────────
export async function listCalendarConnectionsAction(
  resourceId: string
): Promise<ActionResult<CalendarConnection[]>> {
  try {
    const data = await api.get<CalendarConnection[]>(
      `/v1/scheduling/calendar/connections?resourceId=${resourceId}`
    );
    return { ok: true, data };
  } catch (err) {
    return fail(err, 'Failed to load calendar connections');
  }
}

export async function createIcalFeedAction(body: {
  resourceId: string;
  icalUrl: string;
  provider?: string;
}): Promise<ActionResult<CalendarConnection & { sync?: { ok: boolean; error?: string } }>> {
  try {
    const data = await api.post<CalendarConnection & { sync?: { ok: boolean; error?: string } }>(
      '/v1/scheduling/calendar/connections/ical',
      body
    );
    return { ok: true, data };
  } catch (err) {
    return fail(err, 'Failed to add the calendar feed');
  }
}

export async function createCaldavConnectionAction(body: {
  resourceId: string;
  provider?: 'apple_caldav' | 'caldav';
  username: string;
  appPassword: string;
  serverUrl?: string;
}): Promise<ActionResult<CalendarConnection & { sync?: { ok: boolean; error?: string } }>> {
  try {
    const data = await api.post<CalendarConnection & { sync?: { ok: boolean; error?: string } }>(
      '/v1/scheduling/calendar/connections/caldav',
      body
    );
    return { ok: true, data };
  } catch (err) {
    return fail(err, 'Failed to connect the calendar');
  }
}

export async function syncCalendarConnectionAction(id: string): Promise<ActionResult> {
  try {
    await api.post(`/v1/scheduling/calendar/connections/${id}/sync`, {});
    return { ok: true, data: undefined };
  } catch (err) {
    return fail(err, 'Failed to sync the calendar');
  }
}

export async function deleteCalendarConnectionAction(id: string): Promise<ActionResult> {
  try {
    await api.delete(`/v1/scheduling/calendar/connections/${id}`);
    return { ok: true, data: undefined };
  } catch (err) {
    return fail(err, 'Failed to remove the calendar connection');
  }
}

// ── Layer-3 OAuth calendar sync (Google / Microsoft, docs/79 §8.3) ───────────
export async function getCalendarOAuthProvidersAction(): Promise<
  ActionResult<{ cryptoConfigured: boolean; google: boolean; microsoft: boolean }>
> {
  try {
    const data = await api.get<{ cryptoConfigured: boolean; google: boolean; microsoft: boolean }>(
      '/v1/scheduling/calendar/oauth/providers'
    );
    return { ok: true, data };
  } catch (err) {
    return fail(err, 'Failed to load calendar providers');
  }
}

/** Begin an OAuth connect — returns the provider consent URL the browser redirects
 *  to. A BYO connection passes the tenant's own client id + secret. */
export async function startCalendarOAuthAction(body: {
  resourceId: string;
  provider: 'google' | 'microsoft';
  redirectUri: string;
  credentialSource?: 'platform' | 'tenant_byo';
  oauthClientId?: string;
  oauthClientSecret?: string;
  loginHint?: string;
}): Promise<ActionResult<{ authorizeUrl: string; connectionId: string }>> {
  try {
    const data = await api.post<{ authorizeUrl: string; connectionId: string }>(
      '/v1/scheduling/calendar/connections/oauth/start',
      body
    );
    return { ok: true, data };
  } catch (err) {
    return fail(err, 'Failed to start the calendar connection');
  }
}

/** Complete an OAuth connect from the dashboard callback — posts the provider code +
 *  signed state back to exchange tokens and run the first sync. */
export async function completeCalendarOAuthAction(body: {
  code: string;
  state: string;
}): Promise<ActionResult<CalendarConnection & { sync?: { ok: boolean; error?: string } }>> {
  try {
    const data = await api.post<CalendarConnection & { sync?: { ok: boolean; error?: string } }>(
      '/v1/scheduling/calendar/connections/oauth/complete',
      body
    );
    return { ok: true, data };
  } catch (err) {
    return fail(err, 'Failed to finish connecting the calendar');
  }
}

// ── Reports (docs/79 §12) ────────────────────────────────────────────────────
export async function getSchedulingReportAction(
  from: string,
  to: string
): Promise<ActionResult<SchedulingReport>> {
  try {
    const qs = new URLSearchParams({ from, to });
    const data = await api.get<SchedulingReport>(`/v1/scheduling/reports?${qs.toString()}`);
    return { ok: true, data };
  } catch (err) {
    return fail(err, 'Failed to load reports');
  }
}

// ── Classes / roster (docs/79 §7.2) ─────────────────────────────────────────
export async function listSessionAttendeesAction(
  bookingId: string
): Promise<ActionResult<ClassAttendee[]>> {
  try {
    const data = await api.get<ClassAttendee[]>(`/v1/scheduling/sessions/${bookingId}/attendees`);
    return { ok: true, data };
  } catch (err) {
    return fail(err, 'Failed to load the roster');
  }
}

export async function addAttendeeAction(
  bookingId: string,
  body: { guestName?: string; customerId?: string; partySize?: number }
): Promise<ActionResult<ClassAttendee & { waitlisted: boolean }>> {
  try {
    const data = await api.post<ClassAttendee & { waitlisted: boolean }>(
      `/v1/scheduling/sessions/${bookingId}/attendees`,
      body
    );
    revalidatePath('/scheduling/bookings');
    return { ok: true, data };
  } catch (err) {
    return fail(err, 'Failed to add the attendee');
  }
}

export async function updateAttendeeAction(
  id: string,
  body: { status?: string; partySize?: number }
): Promise<ActionResult> {
  try {
    await api.patch(`/v1/scheduling/attendees/${id}`, body);
    revalidatePath('/scheduling/bookings');
    return { ok: true, data: undefined };
  } catch (err) {
    return fail(err, 'Failed to update the attendee');
  }
}

// ── Waitlist (docs/79 §7) ───────────────────────────────────────────────────
export async function listWaitlistAction(status?: string): Promise<ActionResult<WaitlistEntry[]>> {
  try {
    const qs = status ? `?status=${encodeURIComponent(status)}` : '';
    const data = await api.get<WaitlistEntry[]>(`/v1/scheduling/waitlist${qs}`);
    return { ok: true, data };
  } catch (err) {
    return fail(err, 'Failed to load the waitlist');
  }
}

export async function offerWaitlistAction(id: string): Promise<ActionResult> {
  try {
    await api.post(`/v1/scheduling/waitlist/${id}/offer`, {});
    revalidatePath('/scheduling/waitlist');
    return { ok: true, data: undefined };
  } catch (err) {
    return fail(err, 'Failed to send the offer');
  }
}

export async function acceptWaitlistAction(id: string, startAt: string): Promise<ActionResult> {
  try {
    await api.post(`/v1/scheduling/waitlist/${id}/accept`, { startAt });
    revalidatePath('/scheduling/waitlist');
    revalidatePath('/scheduling/bookings');
    return { ok: true, data: undefined };
  } catch (err) {
    return fail(err, 'Failed to book the offer');
  }
}

export async function removeWaitlistAction(id: string): Promise<ActionResult> {
  try {
    await api.delete(`/v1/scheduling/waitlist/${id}`);
    revalidatePath('/scheduling/waitlist');
    return { ok: true, data: undefined };
  } catch (err) {
    return fail(err, 'Failed to remove the entry');
  }
}

// ── Availability ──────────────────────────────────────────────────────────────
export async function setAvailabilityWindowsAction(
  resourceId: string,
  windows: unknown[]
): Promise<ActionResult> {
  try {
    await api.put(`/v1/scheduling/resources/${resourceId}/availability`, { windows });
    revalidatePath('/scheduling/availability');
    return { ok: true, data: undefined };
  } catch (err) {
    return fail(err, 'Failed to save availability');
  }
}

export async function createExceptionAction(body: unknown): Promise<ActionResult> {
  try {
    await api.post('/v1/scheduling/exceptions', body);
    revalidatePath('/scheduling/availability');
    return { ok: true, data: undefined };
  } catch (err) {
    return fail(err, 'Failed to add exception');
  }
}

export async function deleteExceptionAction(id: string): Promise<ActionResult> {
  try {
    await api.delete(`/v1/scheduling/exceptions/${id}`);
    revalidatePath('/scheduling/availability');
    return { ok: true, data: undefined };
  } catch (err) {
    return fail(err, 'Failed to delete exception');
  }
}

// ── Bookings ──────────────────────────────────────────────────────────────────
export async function loadSlotsAction(query: {
  serviceId: string;
  from: string;
  to: string;
  resourceId?: string;
  partySize?: number;
}): Promise<ActionResult<AvailabilitySlot[]>> {
  try {
    const qs = new URLSearchParams({
      serviceId: query.serviceId,
      from: query.from,
      to: query.to,
    });
    if (query.resourceId) qs.set('resourceId', query.resourceId);
    if (query.partySize) qs.set('partySize', String(query.partySize));
    const data = await api.get<AvailabilitySlot[]>(`/v1/scheduling/availability?${qs}`);
    return { ok: true, data };
  } catch (err) {
    return fail(err, 'Failed to load availability');
  }
}

export async function createBookingAction(body: unknown): Promise<ActionResult<Booking>> {
  try {
    const data = await api.post<Booking>('/v1/scheduling/bookings', body);
    revalidatePath('/scheduling/bookings');
    revalidatePath('/scheduling');
    return { ok: true, data };
  } catch (err) {
    return fail(err, 'Failed to create booking');
  }
}

// ── Recurring booking series (docs/79 §7.6) ─────────────────────────────────
export interface CreateSeriesResult {
  series: { id: string };
  created: BookingSeriesOccurrence[];
  skipped: { startAt: string; reason: string }[];
}

export async function createBookingSeriesAction(body: {
  serviceId: string;
  startAt: string;
  rrule: string;
  customerId?: string | null;
  resourceIds?: string[];
}): Promise<ActionResult<CreateSeriesResult>> {
  try {
    const data = await api.post<CreateSeriesResult>('/v1/scheduling/series', body);
    revalidatePath('/scheduling/series');
    revalidatePath('/scheduling/bookings');
    revalidatePath('/scheduling');
    return { ok: true, data };
  } catch (err) {
    return fail(err, 'Failed to create the recurring series');
  }
}

export async function getBookingSeriesAction(
  id: string
): Promise<ActionResult<BookingSeriesDetail>> {
  try {
    const data = await api.get<BookingSeriesDetail>(`/v1/scheduling/series/${id}`);
    return { ok: true, data };
  } catch (err) {
    return fail(err, 'Failed to load the series');
  }
}

export async function cancelBookingSeriesAction(
  id: string,
  scope: 'future' | 'all',
  reason?: string
): Promise<ActionResult<{ id: string; cancelled: number }>> {
  try {
    const data = await api.post<{ id: string; cancelled: number }>(
      `/v1/scheduling/series/${id}/cancel`,
      { scope, reason: reason ?? null }
    );
    revalidatePath('/scheduling/series');
    revalidatePath('/scheduling/bookings');
    revalidatePath('/scheduling');
    return { ok: true, data };
  } catch (err) {
    return fail(err, 'Failed to cancel the series');
  }
}

export async function updateBookingAction(id: string, body: unknown): Promise<ActionResult> {
  try {
    await api.patch(`/v1/scheduling/bookings/${id}`, body);
    revalidatePath('/scheduling/bookings');
    revalidatePath(`/scheduling/bookings/${id}`);
    return { ok: true, data: undefined };
  } catch (err) {
    return fail(err, 'Failed to update booking');
  }
}

async function bookingAction(
  id: string,
  verb: string,
  body: unknown,
  fallback: string
): Promise<ActionResult> {
  try {
    await api.post(`/v1/scheduling/bookings/${id}/${verb}`, body ?? {});
    revalidatePath('/scheduling/bookings');
    revalidatePath(`/scheduling/bookings/${id}`);
    revalidatePath('/scheduling');
    return { ok: true, data: undefined };
  } catch (err) {
    return fail(err, fallback);
  }
}

export async function confirmBookingAction(id: string): Promise<ActionResult> {
  return bookingAction(id, 'confirm', {}, 'Failed to confirm booking');
}

export async function cancelBookingAction(id: string, reason?: string): Promise<ActionResult> {
  return bookingAction(id, 'cancel', { reason: reason ?? null }, 'Failed to cancel booking');
}

export async function rescheduleBookingAction(
  id: string,
  startAt: string,
  resourceIds: string[] = []
): Promise<ActionResult> {
  return bookingAction(id, 'reschedule', { startAt, resourceIds }, 'Failed to reschedule booking');
}

export async function checkInBookingAction(id: string): Promise<ActionResult> {
  return bookingAction(id, 'check-in', {}, 'Failed to check in booking');
}

export async function completeBookingAction(id: string): Promise<ActionResult> {
  return bookingAction(id, 'complete', {}, 'Failed to complete booking');
}

export async function noShowBookingAction(id: string): Promise<ActionResult> {
  return bookingAction(id, 'no-show', {}, 'Failed to mark no-show');
}
