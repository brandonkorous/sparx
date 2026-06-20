// Client-safe presentation helpers for the Scheduling dashboard. No server or DB
// imports — these run in both server components and client islands.

import type { BookingStatus, BookingType, ResourceKind } from './types';

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export const DAY_LABELS = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];

export function money(cents: number, currency = 'usd'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
  }).format(cents / 100);
}

export function duration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h} hr` : `${h} hr ${m} min`;
}

/** Minutes-from-midnight → "9:00 AM". */
export function minuteOfDay(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  const ampm = h < 12 ? 'AM' : 'PM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
}

export function dowShort(d: number): string {
  return DOW[d] ?? '';
}

export function formatDateTime(iso: string, timeZone?: string): string {
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    ...(timeZone ? { timeZone } : {}),
  }).format(new Date(iso));
}

export function formatTime(iso: string, timeZone?: string): string {
  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    ...(timeZone ? { timeZone } : {}),
  }).format(new Date(iso));
}

export function formatDate(iso: string, timeZone?: string): string {
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    ...(timeZone ? { timeZone } : {}),
  }).format(new Date(iso));
}

export const BOOKING_TYPE_LABEL: Record<BookingType, string> = {
  appointment: 'Appointment',
  class: 'Class',
  reservation: 'Reservation',
  rental: 'Rental',
};

export const RESOURCE_KIND_LABEL: Record<ResourceKind, string> = {
  staff: 'Staff',
  asset: 'Asset',
  table: 'Table',
  space: 'Space',
  equipment: 'Equipment',
};

export const STATUS_LABEL: Record<BookingStatus, string> = {
  requested: 'Requested',
  confirmed: 'Confirmed',
  in_progress: 'In progress',
  completed: 'Completed',
  cancelled: 'Cancelled',
  no_show: 'No-show',
  waitlisted: 'Waitlisted',
};

// Booking status → a semantic @sparx/ui color slot for Badge/StatusDot.
export function statusColor(status: BookingStatus): string {
  switch (status) {
    case 'confirmed':
      return 'success';
    case 'in_progress':
      return 'info';
    case 'completed':
      return 'neutral';
    case 'requested':
    case 'waitlisted':
      return 'warning';
    case 'cancelled':
    case 'no_show':
      return 'danger';
    default:
      return 'neutral';
  }
}
