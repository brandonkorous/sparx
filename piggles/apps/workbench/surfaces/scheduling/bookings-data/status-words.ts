import type { BookingType, BookingStatus, SeriesStatus, WaitlistStatus } from './shapes';

/* ── Saying what a status means ─────────────────────────────────────────── */

export type Tone = 'success' | 'warning' | 'danger' | 'info' | 'neutral';

/** A booking's status in the words an owner uses, plus its semantic color. */
export function bookingStateMeta(status: BookingStatus): { label: string; tone: Tone } {
  switch (status) {
    case 'requested':
      return { label: 'Awaiting confirmation', tone: 'warning' };
    case 'confirmed':
      return { label: 'Confirmed', tone: 'success' };
    case 'in_progress':
      return { label: 'In progress', tone: 'info' };
    case 'completed':
      return { label: 'Completed', tone: 'neutral' };
    case 'cancelled':
      return { label: 'Canceled', tone: 'danger' };
    case 'no_show':
      return { label: 'Did not turn up', tone: 'danger' };
    case 'waitlisted':
      return { label: 'On the waiting list', tone: 'info' };
    default:
      return { label: status, tone: 'neutral' };
  }
}

/** True once a booking can no longer move through its lifecycle. */
export function isTerminalBooking(status: BookingStatus): boolean {
  return status === 'completed' || status === 'cancelled' || status === 'no_show';
}

export function bookingTypeLabel(type: BookingType): string {
  switch (type) {
    case 'appointment':
      return 'Appointment';
    case 'class':
      return 'Class';
    case 'reservation':
      return 'Reservation';
    case 'rental':
      return 'Rental';
    default:
      return type;
  }
}

export function seriesStateMeta(status: SeriesStatus): { label: string; tone: Tone } {
  switch (status) {
    case 'active':
      return { label: 'Running', tone: 'success' };
    case 'completed':
      return { label: 'Finished', tone: 'neutral' };
    case 'cancelled':
      return { label: 'Stopped', tone: 'danger' };
    default:
      return { label: status, tone: 'neutral' };
  }
}

export function waitlistStateMeta(status: WaitlistStatus): { label: string; tone: Tone } {
  switch (status) {
    case 'waiting':
      return { label: 'Waiting', tone: 'info' };
    case 'offered':
      return { label: 'Slot offered', tone: 'warning' };
    case 'booked':
      return { label: 'Booked in', tone: 'success' };
    case 'expired':
      return { label: 'Offer lapsed', tone: 'neutral' };
    case 'cancelled':
      return { label: 'Removed', tone: 'neutral' };
    default:
      return { label: status, tone: 'neutral' };
  }
}
