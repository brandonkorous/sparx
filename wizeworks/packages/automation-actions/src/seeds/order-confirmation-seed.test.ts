import { describe, expect, it } from 'vitest';

import { COMMERCE_ORDER_CONFIRMATION_EMAIL } from './commerce.js';
import { SYSTEM_AUTOMATIONS } from './index.js';

// Sparx persona issue 087. A card order got two "order confirmed" emails: this
// automation, and a direct send from the payment webhook on every captured
// payment. The webhook no longer sends it, and this step sends with the email
// module on or off, so this is the one confirmation, and it has to stay on, on
// `order.placed`, once.

const sendsConfirmation = (spec: (typeof SYSTEM_AUTOMATIONS)[number]['spec']) =>
  spec.actions.some(
    (a) =>
      (a.config as { builderEmailKey?: string } | undefined)?.builderEmailKey ===
      'order-confirmation'
  );

describe('the order confirmation', () => {
  it('ships on with commerce, on the order being placed, with no delay', () => {
    expect(SYSTEM_AUTOMATIONS).toContainEqual({
      module: 'commerce',
      spec: COMMERCE_ORDER_CONFIRMATION_EMAIL,
    });
    expect(COMMERCE_ORDER_CONFIRMATION_EMAIL.status).toBe('active');
    expect(COMMERCE_ORDER_CONFIRMATION_EMAIL.trigger).toEqual({
      kind: 'event',
      eventType: 'order.placed',
    });
    expect(COMMERCE_ORDER_CONFIRMATION_EMAIL.actions).toEqual([
      {
        type: 'email.send_campaign',
        config: { builderEmailKey: 'order-confirmation', emailType: 'transactional' },
      },
    ]);
  });

  it('is sent by one automation only', () => {
    const senders = SYSTEM_AUTOMATIONS.filter(({ spec }) => sendsConfirmation(spec));
    expect(senders.map(({ spec }) => spec.name)).toEqual([COMMERCE_ORDER_CONFIRMATION_EMAIL.name]);
  });
});
