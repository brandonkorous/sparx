// A card taken at checkout is a charge a refund can reverse (sparx persona issue 339).
//
// Checkout writes the gateway's catalog id as the payment's `processor`
// ("sparx_pay", "stripe_direct", "square", ...). The list of gateway processors
// held only "stripe" and "paypal", so every card paid through sparx Pay read as
// money handed over at the counter: a return's refund told Doty to hand Marisol
// the money himself, and nothing went back to her card.

import { describe, expect, it } from 'vitest';

import { gatewayCatalogTemplate } from './catalog';
import { GATEWAY_PROCESSORS, takenByGateway } from './processors';

describe('takenByGateway', () => {
  it('is true for every gateway in the catalog that can refund', () => {
    const refunding = gatewayCatalogTemplate().filter((g) => g.capabilities.refunds);
    expect(refunding.map((g) => g.id)).toContain('sparx_pay');
    for (const gateway of refunding) {
      expect(takenByGateway(gateway.id), gateway.id).toBe(true);
    }
  });

  it('is false for a gateway that cannot refund', () => {
    for (const gateway of gatewayCatalogTemplate().filter((g) => !g.capabilities.refunds)) {
      expect(takenByGateway(gateway.id), gateway.id).toBe(false);
    }
  });

  it('keeps the names older payments were written with', () => {
    expect(takenByGateway('stripe')).toBe(true);
    expect(takenByGateway('paypal')).toBe(true);
  });

  it('is false for money a person handed over', () => {
    for (const processor of ['manual', 'cash', 'check', 'wire', 'card', 'net_terms', 'gift_card']) {
      expect(takenByGateway(processor), processor).toBe(false);
    }
  });

  it('is the list the payouts page settles', () => {
    expect([...GATEWAY_PROCESSORS]).toEqual(
      expect.arrayContaining(['stripe', 'paypal', 'square', 'sparx_pay', 'stripe_direct'])
    );
  });
});
