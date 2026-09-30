// Who a booking is for, in the words the list and the record print. Issue 138.
//
// Pinned because the defect was a SENTENCE: every booking with a customer on it
// read "A customer", which is a perfectly valid string, while the name sat on
// the row. Also pins the removal sentence (issue 145), whose old version
// promised "This cannot be undone" about a service the list can put back.

import { describe, expect, it } from 'vitest';

import { bookingWhoLabel, type Booking } from './bookings-data';
import { removalConsequence } from './service-removal';

function booking(partial: Partial<Booking>): Booking {
  return {
    id: 'bk_1',
    serviceId: 'svc_1',
    bookingType: 'appointment',
    seriesId: null,
    locationId: null,
    status: 'confirmed',
    startAt: '2026-03-04T10:00:00.000Z',
    endAt: '2026-03-04T10:30:00.000Z',
    timezone: 'UTC',
    capacity: 1,
    partySize: null,
    customerId: null,
    companyId: null,
    assetRef: null,
    partsLinked: [],
    workOrderId: null,
    source: 'dashboard',
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
    createdAt: '2026-03-01T00:00:00.000Z',
    updatedAt: '2026-03-01T00:00:00.000Z',
    service: {
      id: 'svc_1',
      name: 'Beard trim',
      bookingType: 'appointment',
      durationMinutes: 30,
      priceCents: 2500,
      currency: 'usd',
      color: null,
    },
    resources: [],
    attendees: [],
    customer: null,
    ...partial,
  };
}

const MARA = {
  id: 'cus_1',
  firstName: 'Mara',
  lastName: 'Quill',
  email: 'mara@example.test',
  phone: '+15555550142',
};

describe('bookingWhoLabel', () => {
  it('names the linked customer instead of saying "A customer"', () => {
    expect(bookingWhoLabel(booking({ customerId: 'cus_1', customer: MARA }))).toBe('Mara Quill');
  });

  it('prefers a name written on the booking over the account behind it', () => {
    const written = booking({
      customerId: 'cus_1',
      customer: MARA,
      attendees: [
        {
          id: 'a1',
          customerId: 'cus_1',
          guestName: 'Mara (bringing her son)',
          partySize: 2,
          status: 'confirmed',
          waitlistPosition: null,
        },
      ],
    });
    expect(bookingWhoLabel(written)).toBe('Mara (bringing her son)');
  });

  it('falls back to their email when the account has no name', () => {
    const nameless = { ...MARA, firstName: null, lastName: null };
    expect(bookingWhoLabel(booking({ customerId: 'cus_1', customer: nameless }))).toBe(
      'mara@example.test'
    );
  });

  it('says nobody was recorded, rather than borrowing the customer sentence', () => {
    expect(bookingWhoLabel(booking({}))).toBe('No one assigned');
  });
});

describe('removalConsequence', () => {
  it('never says a removal cannot be undone, and says where the way back is', () => {
    const said = removalConsequence({ total: 3, upcoming: 1 });
    expect(said).not.toMatch(/cannot be undone/i);
    expect(said).toContain('put it back from your services list');
  });

  it('counts what is still to come', () => {
    expect(removalConsequence({ total: 12, upcoming: 4 })).toContain(
      '12 bookings were taken on it and 4 are still to come.'
    );
  });

  it('prints no number while the counts are still loading', () => {
    expect(removalConsequence({ total: null, upcoming: 2 })).not.toMatch(/\d/);
  });
});
