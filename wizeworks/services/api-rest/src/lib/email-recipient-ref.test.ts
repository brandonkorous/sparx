// Sparx persona issue 358: the dispatch tick dropped the parcel, the booking and
// the waitlist place a queued email was about.

import { describe, expect, it } from 'vitest';

import { recipientRef } from './email-recipient-ref';

// Every key `entityRefsFromFields` (automation-actions/src/email.ts) writes.
const QUEUED = {
  customerId: 'cus-1',
  orderId: 'ord-8',
  cartId: 'cart-1',
  quoteId: 'q-1',
  billingDocumentId: 'inv-3',
  companyId: 'co-1',
  subscriptionId: 'sub-1',
  returnId: 'ret-1',
  fulfillmentId: 'ful-2',
  bookingId: 'book-1',
};

describe('recipientRef', () => {
  it('reads back every record the send was queued with', () => {
    const ref = recipientRef('renee@example.com', null, QUEUED);
    for (const [key, value] of Object.entries(QUEUED)) {
      expect(ref[key as keyof typeof ref], key).toBe(value);
    }
  });

  it('carries the waitlist place, and the account under its old name', () => {
    const ref = recipientRef('a@example.com', null, {
      waitlistEntryId: 'wl-1',
      b2bAccountId: 'co-old',
    });
    expect(ref.waitlistEntryId).toBe('wl-1');
    expect(ref.companyId).toBe('co-old');
  });

  it('prefers the send own customer, and reads nothing from nothing', () => {
    expect(recipientRef('a@example.com', 'cus-row', QUEUED).customerId).toBe('cus-row');
    expect(recipientRef('a@example.com', null, null)).toMatchObject({
      email: 'a@example.com',
      orderId: null,
      fulfillmentId: null,
    });
  });
});
