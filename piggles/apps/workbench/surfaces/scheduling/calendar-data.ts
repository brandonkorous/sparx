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
import { inRange, padRange } from './calendar-zone';

export * from './calendar-dates';
export * from './calendar-connections-data';

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
  /** The zone it was made in. The grid places the block on this clock, the one
   *  its own text uses, never the viewer's. */
  timezone: string;
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
    queryFn: async () => {
      // A day more each side, then trimmed to each booking's OWN day: the
      // viewer's week and the business's do not start at the same instant.
      const padded = padRange(query);
      const rows = await api.get<CalendarEvent[]>('/v1/scheduling/bookings/calendar', {
        from: padded.from,
        to: padded.to,
        ...(query.resourceId ? { resourceId: query.resourceId } : {}),
      });
      return inRange(rows, query);
    },
    enabled,
    // Keep the current week/day on screen while the next loads, so paging through
    // time doesn't blink the grid empty and back.
    placeholderData: (previous) => previous,
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

/* ── Tone → block classes ───────────────────────────────────────────────── */

/**
 * A soft tinted block per status, plus a solid rail of the same color.
 *
 * `bg-<tone> soft` is the sanctioned soft treatment — the color utility sets an
 * accent, `soft` mixes it into base-100, and the ACCENT ITSELF becomes the ink.
 * That last part is why it only works for a color that inverts with the canvas,
 * and why `neutral` did not: it was Piggles' CHROME color, pinned dark in both
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

/* ── Errors ─────────────────────────────────────────────────────────────── */

/** The server's own sentence for a 4xx, shown verbatim — a slot clash or a bad
 *  feed URL names itself far better than a status code. A 5xx falls back. */
export function calendarErrorMessage(error: unknown, fallback: string): string {
  return apiErrorMessage(error, fallback);
}

export function isModuleDisabled(error: unknown): boolean {
  return error instanceof ApiError && error.code === 'MODULE_DISABLED';
}
