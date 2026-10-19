import { describe, expect, it } from 'vitest';

import { evaluateConditions } from '@wizeworks/automation-schemas';

import { interpolateFields } from '../entity.js';
import { COMMERCE_ORDER_REFUNDED_EMAIL, COMMERCE_REFUND_CRM_NOTE } from './commerce.js';

// Sparx persona issue 347. Dana sent back a part and got three emails in 0.2
// seconds: "Your refund is on the way" twice and "Your refund is complete". A
// return's money is recorded as a refund row per thing given back (the part, and
// its core deposit), and each row is an `order.refunded`; the return then sends
// its own "complete" email. A refund that belongs to a return is the return
// email's to tell, so this one is for refunds made on the order itself.

const fields = (source: string) => ({
  'customer.email': 'dana@example.com',
  'refund.source': source,
});

describe('the order refunded email', () => {
  it('is not sent for a refund that belongs to a return', () => {
    expect(evaluateConditions(COMMERCE_ORDER_REFUNDED_EMAIL.conditions, fields('return'))).toBe(
      false
    );
  });

  it('is sent for a refund made on the order', () => {
    expect(evaluateConditions(COMMERCE_ORDER_REFUNDED_EMAIL.conditions, fields('order'))).toBe(
      true
    );
  });
});

// Sparx persona issue 350. Doty refunded the last $15.00 of O-000036 after a
// $93.44 return, and the CRM note said "$108.44": the order's running total.
describe('the refund CRM note', () => {
  it('names the money this refund gave back', () => {
    const config = COMMERCE_REFUND_CRM_NOTE.actions[0]!.config as { note: string };
    const note = interpolateFields(config.note, {
      'order.number': 'O-000036',
      'order.refundTotal': 108.44,
      'refund.amount': '$15.00',
    });
    expect(note).toBe('Refund issued: O-000036 · $15.00');
  });
});
