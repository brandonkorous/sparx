'use client';

// ══════════════════════════════════════════════════════════════════════════
// THE CALENDAR DATA LAYER — the diary's own reads, and nothing the list owns.
//
// The Bookings surfaces (bookings-data.ts) own the booking RECORD: the list, the
// single read, the write payloads, and the plain-words status meta. This file is
// the DIARY: the range read that lays a window of the calendar out by time, the
// external-calendar connections reachable from it, and the lifecycle writes fired
// from a booking opened on the grid.
//
// ── Why the lifecycle writes live HERE and not in bookings-data ────────────
//
// A confirm/cancel fired from the diary has to refresh the DIARY, and the range
// read is keyed under ['scheduling','calendar'] — a namespace bookings-data's
// own mutations never touch. So these actions invalidate BOTH roots. The single
// booking READ and every pure helper (status color, formatters) are reused from
// bookings-data unchanged, so the block on the grid and the row in the list can
// never disagree about what a status means or looks like.
//
// ── The key contract ──────────────────────────────────────────────────────
//
//   ['scheduling','calendar']                    the root every diary read nests under
//   ['scheduling','calendar','range',{q}]        one window (day / week) of events
//   ['scheduling','calendar','connections',id]   a resource's linked calendars
//   ['scheduling','calendar','oauth-providers']  which connect buttons to show
// ══════════════════════════════════════════════════════════════════════════

import { useMutation, useQuery, useQueryClient } from '@wizeworks/query';
import { ApiError } from '@wizeworks/api-client';
import { apiErrorMessage } from '../../lib/api-error';
import { api } from '../../lib/api/client';
import type { Tone } from './bookings-data';

/* ── Shapes: a calendar event ───────────────────────────────────────────── */

/**
 * One booking flattened for the grid — exactly what
 * `GET /v1/scheduling/bookings/calendar` returns. It carries only what a block
 * needs to draw and place itself; the full record is fetched on click.
 *
 * `color` is the service's color (or its first resource's) — a hint the business
 * chose, kept for later. The BLOCK is colored by status, not by this, so the
 * diary reads as "what still needs doing" rather than "what kind of thing".
 */
export interface CalendarEvent {
  id: string;
  serviceId: string;
  serviceName: string;
  bookingType: string;
  status: string;
  startAt: string;
  endAt: string;
  color: string | null;
  customerId: string | null;
  /** Who it is for, named — the guest name written on the booking, else the
   *  linked customer's. Null when nobody was recorded, which is a real answer
   *  and the one a block must not dress up. Resolved server-side. */
  customerName: string | null;
  resourceIds: string[];
  resourceNames: string[];
  partySize: number | null;
}

/* ── Shapes: an external-calendar connection ────────────────────────────── */

export type ConnectionStatus = 'active' | 'expired' | 'error';

/** A resource's linked outside calendar, in the API's safe view (no secrets). */
export interface CalendarConnection {
  id: string;
  resourceId: string;
  provider: string;
  connectionKind: string;
  credentialSource: string;
  direction: string;
  fidelity: string;
  status: ConnectionStatus;
  externalCalendarId: string | null;
  lastSyncedAt: string | null;
  lastError: string | null;
  createdAt: string;
}

/** Which OAuth connect buttons the deployment can actually offer. */
export interface OAuthProviders {
  cryptoConfigured: boolean;
  google: boolean;
  microsoft: boolean;
}

/* ── Query keys ─────────────────────────────────────────────────────────── */

export interface RangeQuery {
  from: string;
  to: string;
  /** Narrow to one resource — passed to the server so the payload shrinks too. */
  resourceId?: string;
}

export const calendarKeys = {
  all: ['scheduling', 'calendar'] as const,
  range: (query: RangeQuery) => [...calendarKeys.all, 'range', query] as const,
  connections: (resourceId: string) => [...calendarKeys.all, 'connections', resourceId] as const,
  oauthProviders: () => [...calendarKeys.all, 'oauth-providers'] as const,
};

/** The booking root the list owns — spelled here so a diary write can refresh it
 *  without importing (and coupling to) bookings-data's key object. */
const BOOKINGS_ROOT = ['scheduling', 'bookings'] as const;

/* ── Reads ──────────────────────────────────────────────────────────────── */

/**
 * Every live booking overlapping a window, laid out for the grid.
 *
 * The window is a server filter (`from`/`to`), never a slice of a bigger list
 * kept in the browser — a diary asks "what is on THIS week", and the answer is a
 * different set of rows each time, not a page of one big set. Cancelled and
 * no-show bookings are dropped server-side, so the grid shows only what still
 * stands.
 */
export function useCalendarRange(query: RangeQuery, enabled = true) {
  return useQuery({
    queryKey: calendarKeys.range(query),
    queryFn: () =>
      api.get<CalendarEvent[]>('/v1/scheduling/bookings/calendar', {
        from: query.from,
        to: query.to,
        ...(query.resourceId ? { resourceId: query.resourceId } : {}),
      }),
    enabled,
    // Keep the current week/day on screen while the next loads, so paging through
    // time doesn't blink the grid empty and back.
    placeholderData: (previous) => previous,
  });
}

/** One resource's linked outside calendars (or every connection when unscoped). */
export function useConnections(resourceId?: string) {
  return useQuery({
    queryKey: calendarKeys.connections(resourceId ?? 'all'),
    queryFn: () =>
      api.get<CalendarConnection[]>('/v1/scheduling/calendar/connections', {
        ...(resourceId ? { resourceId } : {}),
      }),
    staleTime: 30_000,
  });
}

/** Which connect options this deployment supports — read once, cached long. */
export function useOAuthProviders() {
  return useQuery({
    queryKey: calendarKeys.oauthProviders(),
    queryFn: () => api.get<OAuthProviders>('/v1/scheduling/calendar/oauth/providers'),
    staleTime: 5 * 60_000,
  });
}

/* ── Invalidation ───────────────────────────────────────────────────────── */

/** The one way the diary says "a booking moved" — refreshes every grid window
 *  AND the booking list/record the change also belongs to. */
export function useInvalidateCalendar() {
  const queryClient = useQueryClient();
  return (bookingId?: string) => {
    void queryClient.invalidateQueries({ queryKey: calendarKeys.all });
    void queryClient.invalidateQueries({ queryKey: BOOKINGS_ROOT });
    if (bookingId) {
      void queryClient.invalidateQueries({ queryKey: [...BOOKINGS_ROOT, bookingId] });
    }
  };
}

function useInvalidateConnections() {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: [...calendarKeys.all, 'connections'] });
    // A fresh feed writes external-busy blocks, which change what the grid shows.
    void queryClient.invalidateQueries({ queryKey: calendarKeys.all });
  };
}

/* ── Writes: booking lifecycle, fired from a block on the grid ──────────── */

/** The lifecycle moves — each a dedicated server action (never a raw status
 *  write), because entering a stage has effects (releasing a slot, settling a
 *  deposit). Every one refreshes the diary and the list together. */
function useBookingAction(id: string, action: string) {
  const invalidate = useInvalidateCalendar();
  return useMutation({
    mutationFn: (body?: Record<string, unknown>) =>
      api.post(`/v1/scheduling/bookings/${id}/${action}`, body ?? {}),
    onSuccess: () => {
      invalidate(id);
    },
  });
}

export function useConfirm(id: string) {
  return useBookingAction(id, 'confirm');
}
export function useCheckIn(id: string) {
  return useBookingAction(id, 'check-in');
}
export function useComplete(id: string) {
  return useBookingAction(id, 'complete');
}
export function useNoShow(id: string) {
  return useBookingAction(id, 'no-show');
}
export function useCancel(id: string) {
  return useBookingAction(id, 'cancel');
}
export function useReschedule(id: string) {
  return useBookingAction(id, 'reschedule');
}

/* ── Writes: calendar connections ───────────────────────────────────────── */

export interface AddIcalFeedPayload {
  resourceId: string;
  icalUrl: string;
  provider?: string;
  label?: string;
}

export function useAddIcalFeed() {
  const invalidate = useInvalidateConnections();
  return useMutation({
    mutationFn: (input: AddIcalFeedPayload) =>
      api.post<CalendarConnection>('/v1/scheduling/calendar/connections/ical', input),
    onSuccess: () => {
      invalidate();
    },
  });
}

export function useSyncConnection() {
  const invalidate = useInvalidateConnections();
  return useMutation({
    mutationFn: (id: string) =>
      api.post<CalendarConnection>(`/v1/scheduling/calendar/connections/${id}/sync`),
    onSuccess: () => {
      invalidate();
    },
  });
}

export function useRemoveConnection() {
  const invalidate = useInvalidateConnections();
  return useMutation({
    mutationFn: (id: string) =>
      api.delete<{ id: string; deleted: boolean }>(`/v1/scheduling/calendar/connections/${id}`),
    onSuccess: () => {
      invalidate();
    },
  });
}

/* ── Saying what a connection's state means ─────────────────────────────── */

export function connectionStateMeta(status: ConnectionStatus): { label: string; tone: Tone } {
  switch (status) {
    case 'active':
      return { label: 'Syncing', tone: 'success' };
    case 'expired':
      return { label: 'Needs reconnecting', tone: 'warning' };
    case 'error':
      return { label: 'Sync problem', tone: 'danger' };
    default:
      return { label: status, tone: 'neutral' };
  }
}

/** A connection's provider in plain words. */
export function providerLabel(provider: string): string {
  switch (provider) {
    case 'google':
      return 'Google Calendar';
    case 'microsoft':
      return 'Microsoft Outlook';
    case 'apple_caldav':
      return 'Apple iCloud';
    case 'caldav':
      return 'Other calendar (CalDAV)';
    case 'ical':
      return 'Calendar link (iCal)';
    default:
      return provider;
  }
}

/* ── Tone → block classes ───────────────────────────────────────────────── */

/**
 * A soft tinted block per status, plus a solid rail of the same color.
 *
 * `bg-<tone> soft` is the sanctioned soft treatment — the color utility sets an
 * accent, `soft` mixes it into base-100, and the ACCENT ITSELF becomes the ink.
 * That last part is why it only works for a colour that inverts with the canvas,
 * and why `neutral` did not: it was Piggles' CHROME colour, pinned dark in both
 * themes, so every completed booking in the dark diary was drawn #27232a on
 * #272b37 — a contrast ratio of 1.09, which is not a faint block but a blank
 * one. The chrome and the semantic grey are two tokens now (see @piggles/brand's
 * palette.css), so all five tones read the same way again.
 *
 * The rail is a separate solid element, because a tint alone is too quiet to
 * scan a busy day by.
 */
export const TONE_BLOCK: Record<Tone, string> = {
  success: 'bg-success soft',
  warning: 'bg-warning soft',
  danger: 'bg-danger soft',
  info: 'bg-info soft',
  neutral: 'bg-neutral soft',
};

export const TONE_RAIL: Record<Tone, string> = {
  success: 'bg-success',
  warning: 'bg-warning',
  danger: 'bg-danger',
  info: 'bg-info',
  neutral: 'bg-neutral',
};

/* ── Dates: the diary's navigation ──────────────────────────────────────── */

const DAY_MS = 24 * 60 * 60 * 1000;

/** Midnight at the start of a date, on the operator's own clock. */
export function startOfDay(date: Date): Date {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

/** Monday 00:00 of the week a date falls in. Weeks start Monday — the working
 *  week most diaries are read by. */
export function startOfWeek(date: Date): Date {
  const start = startOfDay(date);
  // getDay(): 0=Sun..6=Sat. Shift so Monday is the origin.
  const shift = (start.getDay() + 6) % 7;
  start.setDate(start.getDate() - shift);
  return start;
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * DAY_MS);
}

export function addWeeks(date: Date, weeks: number): Date {
  return addDays(date, weeks * 7);
}

/** The seven day-starts of the week a date falls in. */
export function weekDays(anchor: Date): Date[] {
  const start = startOfWeek(anchor);
  return Array.from({ length: 7 }, (_unused, index) => addDays(start, index));
}

export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function isToday(date: Date): boolean {
  return isSameDay(date, new Date());
}

/** The [from, to) ISO window a day view reads. */
export function dayWindow(anchor: Date): RangeQuery {
  const from = startOfDay(anchor);
  return { from: from.toISOString(), to: addDays(from, 1).toISOString() };
}

/** The [from, to) ISO window a week view reads. */
export function weekWindow(anchor: Date): RangeQuery {
  const from = startOfWeek(anchor);
  return { from: from.toISOString(), to: addDays(from, 7).toISOString() };
}

/* ── Dates: labels ──────────────────────────────────────────────────────── */

/** The heading for a day, e.g. "Monday, 12 May 2026". */
export function dayLabel(date: Date): string {
  return new Intl.DateTimeFormat(undefined, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date);
}

/**
 * The heading for a week, e.g. "Aug 17 – 23, 2026" or "Apr 28 – May 4, 2026".
 *
 * `formatRange` rather than three hand-assembled branches. The branches put the
 * day before the month and pasted the pieces together, which is right in one
 * locale and wrong in the runtime's actual one: en-US produced "17–Aug 23, 2026"
 * for every same-month week — the start month simply gone, four weeks in five.
 * Intl already knows where each locale puts the parts and which parts a range
 * may share, so it is asked instead of guessed at.
 */
export function weekLabel(anchor: Date): string {
  const start = startOfWeek(anchor);
  return new Intl.DateTimeFormat(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).formatRange(start, addDays(start, 6));
}

/** A short column heading for a week day, e.g. "Mon 12". */
export function weekdayHeading(date: Date): { weekday: string; day: string } {
  return {
    weekday: new Intl.DateTimeFormat(undefined, { weekday: 'short' }).format(date),
    day: new Intl.DateTimeFormat(undefined, { day: 'numeric' }).format(date),
  };
}

/** An hour mark for the time gutter, e.g. "9 AM". */
export function hourLabel(hour: number): string {
  const date = new Date();
  date.setHours(hour, 0, 0, 0);
  return new Intl.DateTimeFormat(undefined, { hour: 'numeric' }).format(date);
}

/** The clock part of an instant, e.g. "9:30 AM". */
export function clockLabel(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(date);
}

/* ── Errors ─────────────────────────────────────────────────────────────── */

/** The server's own sentence for a 4xx, shown verbatim — a slot clash or a bad
 *  feed URL names itself far better than a status code. A 5xx falls back. */
export function calendarErrorMessage(error: unknown, fallback: string): string {
  return apiErrorMessage(error, fallback);
}

export function isModuleDisabled(error: unknown): boolean {
  return error instanceof ApiError && error.code === 'MODULE_DISABLED';
}
