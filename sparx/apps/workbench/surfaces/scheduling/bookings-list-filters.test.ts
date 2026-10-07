import { describe, expect, it } from 'vitest';
import { parseBookingStatus, statusQuery, STATUS_OPTIONS } from './bookings-list-filters';

// Money's By job opens this list on appointments that happened and were never
// closed (persona issue 926). "Happened, still open" is a question, not a
// status: in the past, and still Confirmed or In progress.
describe('Happened, still open', () => {
  const NOW = '2026-10-06T22:00:00.000Z';

  it('arrives from an address and is in the picker', () => {
    expect(parseBookingStatus('still_open')).toBe('still_open');
    expect(STATUS_OPTIONS.find((o) => o.value === 'still_open')?.label).toBe(
      'Happened, still open'
    );
  });

  it('asks for the open ones that started before the list opened', () => {
    expect(statusQuery('still_open', NOW)).toEqual({
      status: '',
      statusIn: ['confirmed', 'in_progress'],
      to: NOW,
    });
  });

  it('leaves a real status as it was', () => {
    expect(statusQuery('confirmed', NOW)).toEqual({ status: 'confirmed' });
    expect(statusQuery('', NOW)).toEqual({ status: '' });
  });
});
