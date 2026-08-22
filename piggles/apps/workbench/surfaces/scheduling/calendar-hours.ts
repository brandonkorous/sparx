'use client';

// WHEN SOMEBODY IS SHUT — the bands the diary greys out behind the bookings.
//
// The grid knew what was booked and nothing about when anyone works, so a week
// with hours set looked identical to a week with none (issue 084). This turns a
// person's weekly hours plus their closures into quantised bands, in the same
// 15-minute slot units the blocks use, so no inline style is involved.

import { HEIGHT_PX, TOP_PX, SLOT_MIN, type TimeWindow } from './calendar-grid';
import type { AvailabilityException, AvailabilityWindow } from './setup-data';
import { customHoursOf } from './setup-data';

/** One greyed band: where it starts, how tall, and why it is shut. */
export interface ClosedBand {
  key: string;
  topClass: string;
  heightClass: string;
  /** Shown on hover — "Closed", or the closure's own name. */
  title: string;
}

interface OpenSpan {
  startMinute: number;
  endMinute: number;
}

function clamp(value: number, low: number, high: number): number {
  return Math.min(Math.max(value, low), high);
}

/** A [start, end) in minutes → the grid classes for that slice of a column. */
function band(startMin: number, endMin: number, view: TimeWindow, key: string, title: string) {
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

/** Local midnight for a date, as milliseconds. */
function dayStart(date: Date): number {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy.getTime();
}

/**
 * The closure covering a day, if any — the whole-day kind, or a special-hours
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
  exceptions: AvailabilityException[]
): AvailabilityException | null {
  const from = dayStart(date);
  const to = from + 24 * 60 * 60 * 1000;
  for (const exception of exceptions) {
    if (exception.resourceId !== null && exception.resourceId !== resourceId) continue;
    if (exception.kind !== 'closed' && exception.kind !== 'custom_hours') continue;
    const start = new Date(exception.startAt).getTime();
    const end = new Date(exception.endAt).getTime();
    if (Number.isNaN(start) || Number.isNaN(end)) continue;
    if (start < to && end >= from) return exception;
  }
  return null;
}

/** The hours this person is open on this date, after closures have their say. */
function openSpansOn(
  date: Date,
  resourceId: string,
  windows: AvailabilityWindow[],
  exceptions: AvailabilityException[]
): OpenSpan[] {
  const closure = closureFor(date, resourceId, exceptions);
  if (closure) {
    // Shut all day, or open on special hours that REPLACE the weekly pattern.
    const special = customHoursOf(closure);
    return special ? [{ startMinute: special.startMinute, endMinute: special.endMinute }] : [];
  }
  return windows
    .filter((window) => window.dayOfWeek === date.getDay())
    .map((window) => ({ startMinute: window.startMinute, endMinute: window.endMinute }))
    .sort((a, b) => a.startMinute - b.startMinute);
}

/**
 * The bands to grey out on one day column — everything the person is NOT open
 * for, inside the view's own hour window.
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
  view: TimeWindow
): ClosedBand[] {
  const closure = closureFor(date, resourceId, exceptions);
  const spans = openSpansOn(date, resourceId, windows, exceptions);
  const title = closure?.reason?.trim() ? closure.reason.trim() : 'Closed';

  if (spans.length === 0) {
    const whole = band(view.startMin, view.endMin, view, `${String(date.getTime())}-shut`, title);
    return whole ? [whole] : [];
  }

  const bands: ClosedBand[] = [];
  let cursor = view.startMin;
  for (const span of spans) {
    const gap = band(
      cursor,
      span.startMinute,
      view,
      `${String(date.getTime())}-${String(cursor)}`,
      title
    );
    if (gap) bands.push(gap);
    cursor = Math.max(cursor, span.endMinute);
  }
  const tail = band(
    cursor,
    view.endMin,
    view,
    `${String(date.getTime())}-${String(cursor)}-tail`,
    title
  );
  if (tail) bands.push(tail);
  return bands;
}

/** Whether this person works at all on this date — for the empty state, which
 *  must not call a shut week "an open diary". */
export function worksOn(
  date: Date,
  resourceId: string,
  windows: AvailabilityWindow[],
  exceptions: AvailabilityException[]
): boolean {
  return openSpansOn(date, resourceId, windows, exceptions).length > 0;
}
