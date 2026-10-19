// The carrier a handover starts on is the one the shopper chose (sparx persona issue 340).
//
// Marisol chose "UPS Ground" at checkout. The console's "Mark it as sent" form
// always started on USPS, Doty pressed the button, and her order page and her
// email said USPS beside "UPS Ground".

import { describe, expect, it } from 'vitest';

import { carrierChosen, serviceFor } from './carriers';

describe('carrierChosen', () => {
  it('starts on the carrier the chosen delivery names', () => {
    expect(carrierChosen('UPS Ground')).toBe('ups');
    expect(carrierChosen('FedEx 2Day')).toBe('fedex');
    expect(carrierChosen('DHL Express Worldwide')).toBe('dhl');
    expect(carrierChosen('USPS Priority Mail')).toBe('usps');
  });

  it('reads a whole word, never part of one', () => {
    expect(carrierChosen('Groups delivery')).toBe('usps');
  });

  it('starts on USPS when the delivery names no carrier', () => {
    expect(carrierChosen('Standard shipping')).toBe('usps');
    expect(carrierChosen('')).toBe('usps');
    expect(carrierChosen(null)).toBe('usps');
  });

  it('keeps the service the shopper chose when it starts there', () => {
    expect(serviceFor('UPS Ground', carrierChosen('UPS Ground'))).toBe('UPS Ground');
  });
});
