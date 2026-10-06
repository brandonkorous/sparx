// One booking, two policies and a settled payment, shared by the booking money tests.
// Amounts go through formatMoney so a test never asserts what Intl does on this machine.
import { formatMoney, type Booking, type BookingPayment } from './bookings-data';
import type { BookingPolicy } from './setup-data';

const START = '2026-10-06T21:30:00.000Z';
export const NOW = new Date('2026-10-05T12:00:00.000Z').getTime();
export const forty = formatMoney(4000, 'USD');
export const thirty = formatMoney(3000, 'USD');

export function booking(over: Partial<Booking> = {}): Booking {
  return {
    id: 'bk_1',
    serviceId: 'svc_1',
    bookingType: 'appointment',
    seriesId: null,
    locationId: null,
    status: 'confirmed',
    startAt: START,
    endAt: '2026-10-06T22:30:00.000Z',
    timezone: 'UTC',
    capacity: 1,
    partySize: null,
    customerId: 'c-ana',
    companyId: null,
    assetRef: null,
    partsLinked: [],
    workOrderId: null,
    source: 'site',
    policyId: 'pol_1',
    depositStatus: 'held',
    paymentIntentId: 'pi_row',
    intakeSubmissionId: null,
    notes: null,
    staffNotes: null,
    confirmedAt: null,
    checkedInAt: null,
    completedAt: null,
    cancelledAt: null,
    cancellationReason: null,
    noShowAt: null,
    // Booked two days ago: the hold is still good.
    createdAt: '2026-10-03T12:00:00.000Z',
    updatedAt: '2026-10-03T12:00:00.000Z',
    service: {
      id: 'svc_1',
      name: 'Deep tissue massage',
      bookingType: 'appointment',
      durationMinutes: 60,
      priceCents: 12_000,
      currency: 'USD',
      color: null,
    },
    resources: [],
    attendees: [],
    customer: null,
    ...over,
  };
}

/** A $40.00 no-show fee and a $25.00 late-cancellation fee, held on the card. */
export const CARD_HOLD: BookingPolicy = {
  id: 'pol_1',
  name: 'Massage rules',
  depositType: 'card_hold',
  depositAmountCents: null,
  depositPercent: null,
  cancellationWindowHours: 24,
  lateCancelFeeType: 'fixed',
  lateCancelFeeValue: 2500,
  noShowFeeType: 'fixed',
  noShowFeeValue: 4000,
  policyText: null,
  reminderOffsetsMin: [],
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};
export const DEPOSIT: BookingPolicy = {
  ...CARD_HOLD,
  depositType: 'deposit',
  depositAmountCents: 3000,
};

export const paid = (over: Partial<BookingPayment>): BookingPayment => ({
  done: true,
  move: 'capture_fee',
  ending: 'no_show',
  amountCents: 4000,
  currency: 'USD',
  reason: null,
  at: '2026-10-06T23:00:00.000Z',
  ...over,
});
