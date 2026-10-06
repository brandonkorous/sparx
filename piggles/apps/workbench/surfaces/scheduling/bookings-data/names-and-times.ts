import type { Booking, BookedCustomer, CustomerLite } from './shapes';

/* ── Names, times, money ────────────────────────────────────────────────── */

export function customerName(customer: CustomerLite | null | undefined): string {
  if (!customer) return 'A customer';
  const full = [customer.firstName, customer.lastName].filter(Boolean).join(' ').trim();
  if (full) return full;
  if (customer.company?.trim()) return customer.company;
  if (customer.email?.trim()) return customer.email;
  return 'A customer';
}

/** Who a booking is for, in the fewest words that are true: a typed guest name,
 *  then the linked customer's own name, then a count, then the honest admission
 *  that nobody was recorded (never "A customer" when the name is on the read). */
export function bookingWhoLabel(booking: Booking): string {
  const named = booking.attendees.find((a) => a.guestName?.trim());
  if (named?.guestName) return named.guestName;
  if (booking.customer) return bookedCustomerName(booking.customer);
  if (booking.attendees.length > 1) return `${String(booking.attendees.length)} people`;
  if (booking.partySize && booking.partySize > 1) {
    return `Party of ${String(booking.partySize)}`;
  }
  return booking.customerId ? 'A customer' : 'No one assigned';
}

/** A booked customer's name, falling back to whatever else identifies them. */
export function bookedCustomerName(customer: BookedCustomer): string {
  const full = [customer.firstName, customer.lastName].filter(Boolean).join(' ').trim();
  if (full) return full;
  if (customer.email?.trim()) return customer.email;
  return 'A customer';
}

/** What ONE booking's tab says: the person plus the day, so open booking panes can
 *  be told apart (issue 842). When nobody was written down, the who-label
 *  identifies nothing, so the service stands in for the person. */
export function bookingTabTitle(booking: Booking): string {
  const who = bookingWhoLabel(booking);
  const anonymous = who === 'No one assigned' || who === 'A customer';
  const named = anonymous ? booking.service.name : who;
  return `${named} · ${formatDay(booking.startAt, booking.timezone)}`;
}

/** The staff / rooms a booking is with, named. */
export function bookingResourceLabel(booking: Booking): string {
  if (booking.resources.length === 0) return 'Not yet assigned';
  return booking.resources.map((r) => r.resource.name).join(', ');
}

/** A booking's date + time, shown in the zone it was made in. */
export function formatWhen(iso: string, timezone?: string | null): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    ...(timezone ? { timeZone: timezone } : {}),
  }).format(date);
}

/** Just the day part, for grouping and short columns. */
export function formatDay(iso: string, timezone?: string | null): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    ...(timezone ? { timeZone: timezone } : {}),
  }).format(date);
}

/** Just the clock part. */
export function formatClock(iso: string, timezone?: string | null): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat(undefined, {
    hour: 'numeric',
    minute: '2-digit',
    ...(timezone ? { timeZone: timezone } : {}),
  }).format(date);
}

export function formatMoney(cents: number, currency = 'USD'): string {
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: currency.toUpperCase(),
  }).format(cents / 100);
}

/** A timestamp as "just now" / "3 hours ago", falling back to a real date once a
 *  change is old enough that a relative phrase reads worse than the day itself. */
export function formatRelativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const seconds = Math.round((Date.now() - then) / 1000);
  if (seconds < 45) return 'just now';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${String(minutes)} minute${minutes === 1 ? '' : 's'} ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${String(hours)} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${String(days)} day${days === 1 ? '' : 's'} ago`;
  return formatDay(iso);
}
