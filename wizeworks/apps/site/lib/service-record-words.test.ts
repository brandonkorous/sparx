// The words a fleet buyer reads on her vehicles' service records (sparx persona
// issue 086): a state, never a code; how long a service takes and what it costs;
// each part with the order it came from, linked to somewhere she can open.

import { describe, expect, it } from 'vitest';

import {
  durationWords,
  partLine,
  partOrderHref,
  recordsForVehicle,
  serviceStatusTone,
  serviceStatusWords,
  serviceTypeSummary,
} from './service-record-words';

describe('a visit reads as a state, in a color that means it', () => {
  it.each([
    ['requested', 'Waiting for the shop to confirm', 'warning'],
    ['confirmed', 'Booked', 'info'],
    ['in_progress', 'In the shop', 'info'],
    ['completed', 'Done', 'success'],
    ['cancelled', 'Canceled', 'danger'],
    ['no_show', 'Missed', 'danger'],
  ])('%s', (status, words, tone) => {
    expect(serviceStatusWords(status)).toBe(words);
    expect(serviceStatusTone(status)).toBe(tone);
  });

  it('never prints a code it does not know', () => {
    expect(serviceStatusWords('waitlisted')).toBe('On the waiting list');
    expect(serviceStatusWords('something_new')).toBe('Booked');
  });
});

describe('how long and how much', () => {
  it('says the duration the way a person would', () => {
    expect(durationWords(30)).toBe('30 min');
    expect(durationWords(60)).toBe('1 hr');
    expect(durationWords(90)).toBe('1 hr 30 min');
    expect(durationWords(480)).toBe('8 hr');
  });

  it('adds the price only when there is one', () => {
    expect(serviceTypeSummary({ durationMinutes: 90, priceCents: 14900, currency: 'usd' })).toBe(
      '1 hr 30 min · $149.00'
    );
    expect(serviceTypeSummary({ durationMinutes: 45, priceCents: 0, currency: 'usd' })).toBe(
      '45 min'
    );
  });
});

describe('the parts on a visit', () => {
  const part = {
    orderId: 'ord-1',
    orderItemId: 'line-1',
    orderNumber: 'SO-1042',
    variantId: 'var-1',
    sku: 'LF3349',
    title: 'Oil filter',
    quantity: 2,
  };

  it('reads as a count, a name and a part number', () => {
    expect(partLine(part)).toBe('2 × Oil filter (LF3349)');
    expect(partLine({ ...part, sku: null, quantity: 1 })).toBe('1 × Oil filter');
    expect(partLine({ ...part, sku: 'Oil filter' })).toBe('2 × Oil filter');
  });

  // sparx persona issue 086: the shop's titles already end in the part number.
  it('does not repeat a part number the name already carries', () => {
    const title = 'Cummins Fuel Injection Crossover Tube O-Ring (4062328)';
    expect(partLine({ ...part, title, sku: '4062328', quantity: 1 })).toBe(`1 × ${title}`);
    expect(partLine({ ...part, title: 'LF3349 oil filter', sku: 'lf3349' })).toBe(
      '2 × LF3349 oil filter'
    );
  });

  it('still names a part number that only looks like part of a longer one', () => {
    expect(partLine({ ...part, title: 'Filter kit 40623281', sku: '4062328' })).toBe(
      '2 × Filter kit 40623281 (4062328)'
    );
  });

  it("opens the reader's own order on her order page", () => {
    expect(partOrderHref(part, 'acct-1', ['ord-1'])).toBe('/account/orders/ord-1');
  });

  it("sends a colleague's order to the account's order list", () => {
    expect(partOrderHref(part, 'acct-1', [])).toBe('/account/b2b/acct-1/orders');
  });

  it('links nowhere when the part names no order', () => {
    expect(partOrderHref({ ...part, orderId: null }, 'acct-1', [])).toBeNull();
  });
});

describe("a vehicle's history", () => {
  const records = [
    { id: 'a', vehicle: { vehicleId: 'v1', label: 'Unit 12' } },
    { id: 'b', vehicle: null },
    { id: 'c', vehicle: { vehicleId: 'v2', label: 'Unit 14' } },
    { id: 'd', vehicle: { vehicleId: 'v1', label: 'Unit 12' } },
  ];

  it('is the visits filed under that vehicle, in the order given', () => {
    expect(recordsForVehicle(records, 'v1').map((r) => r.id)).toEqual(['a', 'd']);
  });
});
