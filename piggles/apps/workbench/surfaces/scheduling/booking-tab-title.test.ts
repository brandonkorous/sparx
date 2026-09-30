import { describe, expect, it } from 'vitest';

import { bookingTabTitle, formatDay, type Booking } from './bookings-data';

/**
 * FOUR TABS, ONE WORD.
 *
 * Every other record in this console names its own tab once it loads. A booking
 * could not: it has no name field. It is a service, a person and a time, so the
 * registry's starting word was the only title it ever got, and four open
 * bookings read as `Booking  Booking  Booking  Booking` (issue 842).
 *
 * These tests state which half of the pair wins, which is the whole decision.
 * The day half is checked against `formatDay` rather than a literal, because the
 * literal would be asserting what `Intl` does on this machine.
 */

const WHEN = '2026-09-30T14:00:00.000Z';

function booking(over: Partial<Booking> = {}): Booking {
  return {
    id: 'bk_1',
    serviceId: 'svc_1',
    bookingType: 'appointment',
    seriesId: null,
    locationId: null,
    status: 'confirmed',
    startAt: WHEN,
    endAt: '2026-09-30T15:00:00.000Z',
    timezone: 'UTC',
    capacity: 1,
    partySize: null,
    customerId: null,
    companyId: null,
    assetRef: null,
    partsLinked: [],
    workOrderId: null,
    source: 'console',
    policyId: null,
    depositStatus: null,
    paymentIntentId: null,
    intakeSubmissionId: null,
    notes: null,
    staffNotes: null,
    confirmedAt: null,
    checkedInAt: null,
    completedAt: null,
    cancelledAt: null,
    cancellationReason: null,
    noShowAt: null,
    createdAt: WHEN,
    updatedAt: WHEN,
    service: {
      id: 'svc_1',
      name: 'Hot yoga',
      bookingType: 'appointment',
      durationMinutes: 60,
      priceCents: 2000,
      currency: 'USD',
      color: null,
    },
    resources: [],
    attendees: [],
    customer: null,
    ...over,
  };
}

const day = formatDay(WHEN, 'UTC');

describe('bookingTabTitle', () => {
  it('says who it is for, because that is what an owner scans a tab strip for', () => {
    const title = bookingTabTitle(
      booking({
        customerId: 'cus_1',
        customer: { id: 'cus_1', firstName: 'Mara', lastName: 'Quill', email: null, phone: null },
      })
    );
    expect(title).toBe(`Mara Quill \u00b7 ${day}`);
  });

  it('prefers the name written onto the booking over the account it is linked to', () => {
    const title = bookingTabTitle(
      booking({
        customerId: 'cus_1',
        customer: { id: 'cus_1', firstName: 'Mara', lastName: 'Quill', email: null, phone: null },
        attendees: [
          {
            id: 'att_1',
            customerId: null,
            guestName: 'Tomas Reyes',
            partySize: 1,
            status: 'booked',
            waitlistPosition: null,
          },
        ],
      })
    );
    expect(title).toBe(`Tomas Reyes \u00b7 ${day}`);
  });

  it('falls back to the service when nobody was written down', () => {
    // "No one assigned" is honest on the pane and useless on a tab: it is the
    // same words for every unassigned booking, which is the defect itself.
    expect(bookingTabTitle(booking())).toBe(`Hot yoga \u00b7 ${day}`);
  });

  it('falls back to the service when the customer is attached but unnamed', () => {
    expect(bookingTabTitle(booking({ customerId: 'cus_1' }))).toBe(`Hot yoga \u00b7 ${day}`);
  });

  it('carries the day, so two bookings for the same person are different tabs', () => {
    const who = { id: 'cus_1', firstName: 'Mara', lastName: 'Quill', email: null, phone: null };
    const first = bookingTabTitle(booking({ customerId: 'cus_1', customer: who }));
    const second = bookingTabTitle(
      booking({
        customerId: 'cus_1',
        customer: who,
        startAt: '2026-10-07T14:00:00.000Z',
      })
    );
    expect(first).not.toBe(second);
  });

  it('shows the booking in the zone it was made in, not the reader s', () => {
    const late = booking({ startAt: '2026-09-30T23:30:00.000Z', timezone: 'Pacific/Auckland' });
    expect(bookingTabTitle(late)).toBe(
      `Hot yoga \u00b7 ${formatDay('2026-09-30T23:30:00.000Z', 'Pacific/Auckland')}`
    );
  });
});
