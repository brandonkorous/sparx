import { describe, expect, it } from 'vitest';
import { Carrier } from '@wizeworks/crm-schemas';

import { carrierLabel } from './shipping';

// A carrier code is never printed as itself. Brynn's counter sale read "On its
// way · pickup" on her order page: `pickup` was the one carrier a fulfillment can
// carry that had no words (sparx persona issue 177).

describe('the words for a carrier', () => {
  it('exist for every carrier a fulfillment can carry', () => {
    for (const code of Carrier.options) {
      expect(carrierLabel(code), code).not.toBe(code);
    }
  });

  it('say a counter handover was collected', () => {
    expect(carrierLabel('pickup')).toBe('Collected in person');
  });

  // R+L Carriers shipped Renée's tank. The owner typed the name; the order page said
  // "Another courier", and a freight PRO number means nothing without whose it is
  // (sparx persona issue 216).
  it('use the name the owner typed for a carrier sparx has no code for', () => {
    expect(carrierLabel('other', 'R+L Carriers')).toBe('R+L Carriers');
    expect(carrierLabel('other', '  ')).toBe('Another courier');
    expect(carrierLabel('other', null)).toBe('Another courier');
    expect(carrierLabel('ups', 'R+L Carriers')).toBe('UPS');
  });
});
