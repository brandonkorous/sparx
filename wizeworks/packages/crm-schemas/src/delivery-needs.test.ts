import { describe, expect, it } from 'vitest';

import { deliveryNeedsOf, poNumberOf, withDeliveryNeeds, withPoNumber } from './invoicing';

// What a trade buyer said about getting their order to them, kept on the quote their
// request became (sparx persona issue 086). It shares the metadata bag with the
// PO number and the send record, so it must never wipe either.

describe('withDeliveryNeeds', () => {
  it('keeps the PO number and the send record that share the bag', () => {
    const bag = withPoNumber({ sentTo: 'ap@wasatchutility.test' }, 'WFUC-24-0817');
    const next = withDeliveryNeeds(bag, {
      neededBy: '2026-10-20',
      deliverTo: 'Yard 2, 400 Industrial Way',
      notes: 'Forklift on site, no liftgate needed',
    });
    expect(poNumberOf(next)).toBe('WFUC-24-0817');
    expect(next.sentTo).toBe('ap@wasatchutility.test');
    expect(deliveryNeedsOf(next)).toEqual({
      neededBy: '2026-10-20',
      deliverTo: 'Yard 2, 400 Industrial Way',
      notes: 'Forklift on site, no liftgate needed',
    });
  });

  it('writes nothing when nothing was said, so the quote does not read as having needs', () => {
    expect(
      withDeliveryNeeds({ poNumber: 'A1' }, { neededBy: null, deliverTo: ' ', notes: '' })
    ).toEqual({ poNumber: 'A1' });
  });

  it('trims what was typed', () => {
    expect(
      deliveryNeedsOf(
        withDeliveryNeeds({}, { neededBy: null, deliverTo: '  Dock 4 ', notes: null })
      )
    ).toEqual({ neededBy: null, deliverTo: 'Dock 4', notes: null });
  });
});

describe('deliveryNeedsOf', () => {
  it('is null for a bag with none, or one that is not an object', () => {
    expect(deliveryNeedsOf({})).toBeNull();
    expect(deliveryNeedsOf(null)).toBeNull();
    expect(deliveryNeedsOf([])).toBeNull();
    expect(deliveryNeedsOf({ delivery: 'tomorrow' })).toBeNull();
  });

  it('refuses a date that is not a calendar day rather than printing it', () => {
    expect(deliveryNeedsOf({ delivery: { neededBy: 'soon', deliverTo: 'Dock 4' } })).toEqual({
      neededBy: null,
      deliverTo: 'Dock 4',
      notes: null,
    });
  });
});
