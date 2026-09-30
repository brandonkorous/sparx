// The team's note on a settled swap is SENT. It was typed on the body and never
// sent, so the reason a swap was agreed was lost when the dialog closed.

import { describe, expect, it } from 'vitest';

import { EMPTY_SHIPMENT_FORM, settleExchangeBody } from './return-shipment';

describe('settleExchangeBody', () => {
  it('carries the note to the server', () => {
    const body = settleExchangeBody('v1', EMPTY_SHIPMENT_FORM, '  Size ran small, she rang  ');
    expect(body.staffNote).toBe('Size ran small, she rang');
  });

  it('leaves out an empty note rather than sending a blank one', () => {
    expect('staffNote' in settleExchangeBody('v1', EMPTY_SHIPMENT_FORM, '   ')).toBe(false);
  });

  it('still sends one replacement, and the parcel only when it has a number', () => {
    const body = settleExchangeBody('v1', { ...EMPTY_SHIPMENT_FORM, trackingNumber: '1Z9' }, '');
    expect(body).toEqual({
      replacementVariantId: 'v1',
      quantity: 1,
      shipment: { trackingNumber: '1Z9' },
    });
  });
});
