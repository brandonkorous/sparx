'use client';

// WHEN SOMEBODY IS SHUT: the bands the diary shades behind the bookings.
//
// The grid knew what was booked and nothing about when anyone works, so a week
// with hours set looked identical to a week with none (issue 084), and a Monday
// the business never opens read as "an open diary", which invites an owner to
// expect bookings on a day nobody can take one. This turns a person's weekly
// hours plus their closures into quantised bands, in the same 15-minute slot
// units the blocks use, so no inline style is involved.
//
// SEASONAL HOURS COUNT. A weekly window can be bounded by two dates (issue 866,
// see season-window.ts), and the booking engine skips a window outside its dates.
// Shading that ignored them would draw a summer-only Saturday as open all winter,
// which is the diary telling the owner she can be booked when the booking page
// will refuse everyone.
//
// THE BUSINESS'S CLOCK, NOT THE VIEWER'S. A closure is two instants, and which
// calendar days it shuts depends on whose clock reads them. Read on the viewer's,
// a Tokyo shop's Thursday closure also shut Wednesday for anyone hours behind.
// So a closure is read in the person's own zone (calendar-zone), the same clock
// the blocks are placed on.

import { localDayKey, zoned } from './calendar-zone';
import { HEIGHT_PX, SLOT_MIN, TOP_PX, type TimeWindow } from './calendar-grid';
import { customHoursOf, type AvailabilityException, type AvailabilityWindow } from './setup-data';

/** One shaded band: where it starts, how tall, and why it is shut. */
export interface ClosedBand {
  key: string;
  topClass: string;
  heightClass: string;
  /** Shown on hover: "Closed", or the closure's own reason. */
  title: string;
}

interface OpenSpan {
  startMinute: number;
  endMinute: number;
}

function clamp(value: number, low: number, high: number): number {
  return Math.min(Math.max(value, low), high);
}

/** A [start, end) in minutes, as the grid classes for that slice of a column. */
function band(
  startMin: number,
  endMin: number,
  view: TimeWindow,
  key: string,
  title: string
): ClosedBand | null {
  const top = clamp(startMin, view.startMin, view.endMin);
  const bottom = clamp(endMin, view.startMin, view.endMin);
  if (bottom - top < SLOT_MIN) return null;
  const topSlots = Math.round((top - view.startMin) / SLOT_MIN);
  const slots = Math.round((bottom - top) / SLOT_MIN);
  const topClass = TOP_PX[topSlots];
  const heightClass = HEIGHT_PX[slots];
  if (!topClass || !heightClass) return null;
  return { key, topClass, heightClass, title };
}

/** Whether a weekly window is in force on this date: the right weekday, and
 *  inside its season if it has one. Either bound alone is open-ended. */
function windowAppliesOn(window: AvailabilityWindow, date: Date): boolean {
  if (window.dayOfWeek !== date.getDay()) return false;
  const day = localDayKey(date);
  if (window.validFrom && day < window.validFrom.slice(0, 10)) return false;
  if (window.validTo && day > window.validTo.slice(0, 10)) return false;
  return true;
}

/**
 * The closure covering a day, if any: the whole-day kind, or a special-hours
 * override that replaces the weekly pattern for that date.
 *
 * A closure with no `resourceId` is the whole business, which covers everybody;
 * one naming a person covers only them. Both are compared by overlap with the
 * day rather than by equality, because a closure spans a range and the day it
 * covers is rarely its first.
 */
function closureFor(
  date: Date,
  resourceId: string,
  exceptions: AvailabilityException[],
  timezone?: string | null
): AvailabilityException | null {
  const day = localDayKey(date);
  for (const exception of exceptions) {
    if (exception.resourceId !== null && exception.resourceId !== resourceId) continue;
    if (exception.kind !== 'closed' && exception.kind !== 'custom_hours') continue;
    if (covers(exception, day, timezone)) return exception;
  }
  return null;
}

/** Whether a closure touches this calendar day ON THE BUSINESS'S CLOCK. One
 *  ending exactly at its midnight leaves the day alone. */
function covers(exception: AvailabilityException, day: string, timezone?: string | null): boolean {
  const start = zoned(exception.startAt, timezone);
  const end = zoned(exception.endAt, timezone);
  if (start.dayKey === '' || end.dayKey === '') return false;
  if (start.dayKey > day) return false;
  return end.dayKey > day || (end.dayKey === day && end.minutes > 0);
}

/** The hours this person is open on this date, after closures have their say. */
function openSpansOn(
  date: Date,
  resourceId: string,
  windows: AvailabilityWindow[],
  exceptions: AvailabilityException[],
  timezone?: string | null
): OpenSpan[] {
  const closure = closureFor(date, resourceId, exceptions, timezone);
  if (closure) {
    // Shut all day, or open on special hours that REPLACE the weekly pattern.
    const special = customHoursOf(closure);
    return special ? [{ startMinute: special.startMinute, endMinute: special.endMinute }] : [];
  }
  return windows
    .filter((window) => window.resourceId === resourceId && windowAppliesOn(window, date))
    .map((window) => ({ startMinute: window.startMinute, endMinute: window.endMinute }))
    .sort((a, b) => a.startMinute - b.startMinute);
}

/**
 * The bands to shade on one column: everything the person is NOT open for,
 * inside the view's own hour window.
 *
 * Returns a single full-height band for a day they do not work at all, which is
 * what makes "Monday is shut" visible at a glance rather than inferable from an
 * absence of bookings.
 */
export function closedBandsFor(
  date: Date,
  resourceId: string,
  windows: AvailabilityWindow[],
  exceptions: AvailabilityException[],
  view: TimeWindow,
  timezone?: string | null
): ClosedBand[] {
  const closure = closureFor(date, resourceId, exceptions, timezone);
  const spans = openSpansOn(date, resourceId, windows, exceptions, timezone);
  const title = closure?.reason?.trim() ? closure.reason.trim() : 'Closed';
  const stamp = String(date.getTime());

  if (spans.length === 0) {
    const whole = band(view.startMin, view.endMin, view, `${stamp}-shut`, title);
    return whole ? [whole] : [];
  }

  const bands: ClosedBand[] = [];
  let cursor = view.startMin;
  for (const span of spans) {
    const gap = band(cursor, span.startMinute, view, `${stamp}-${String(cursor)}`, title);
    if (gap) bands.push(gap);
    cursor = Math.max(cursor, span.endMinute);
  }
  const tail = band(cursor, view.endMin, view, `${stamp}-${String(cursor)}-tail`, title);
  if (tail) bands.push(tail);
  return bands;
}

/** Whether this person works at all on this date, for the empty state, which
 *  must not call a shut week "an open diary". */
export function worksOn(
  date: Date,
  resourceId: string,
  windows: AvailabilityWindow[],
  exceptions: AvailabilityException[],
  timezone?: string | null
): boolean {
  return openSpansOn(date, resourceId, windows, exceptions, timezone).length > 0;
}
