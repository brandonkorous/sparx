import { describe, expect, it } from 'vitest';

import { evaluateConditions } from '@wizeworks/automation-schemas';

import { COMMERCE_ORDER_REFUNDED_EMAIL } from './commerce.js';

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
