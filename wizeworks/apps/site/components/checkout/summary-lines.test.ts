import { describe, expect, it } from 'vitest';

import { shippingLine, summaryTotalCents } from './summary-lines';

describe('shippingLine', () => {
  it('says nothing is known before anything is chosen', () => {
    expect(
      shippingLine({ settled: false, settledShippingCents: 0, chosenShippingCents: null })
    ).toEqual({ kind: 'unknown' });
  });

  it('prices a delivery the shopper has picked but not yet submitted', () => {
    expect(
      shippingLine({ settled: false, settledShippingCents: 0, chosenShippingCents: 900 })
    ).toEqual({ kind: 'amount', cents: 900 });
  });

  it('never reads a not-yet-worked-out zero as Free', () => {
    // The session opens carrying zero shipping. That is the whole of issue 206.
    expect(
      shippingLine({ settled: false, settledShippingCents: 0, chosenShippingCents: null })
    ).not.toEqual({ kind: 'free' });
  });

  it('calls a chosen zero Free, because somebody chose it', () => {
    expect(
      shippingLine({ settled: false, settledShippingCents: 0, chosenShippingCents: 0 })
    ).toEqual({ kind: 'free' });
  });

  it('uses the session once the delivery step has been submitted', () => {
    expect(
      shippingLine({ settled: true, settledShippingCents: 1200, chosenShippingCents: 900 })
    ).toEqual({ kind: 'amount', cents: 1200 });
  });
});

describe('summaryTotalCents', () => {
  it('adds a chosen delivery to a total that does not carry it yet', () => {
    expect(
      summaryTotalCents({ settled: false, totalCents: 12_600, chosenShippingCents: 900 })
    ).toBe(13_500);
  });

  it('leaves the total alone while nothing is chosen', () => {
    expect(
      summaryTotalCents({ settled: false, totalCents: 12_600, chosenShippingCents: null })
    ).toBe(12_600);
  });

  it('does not add the delivery twice once the session carries it', () => {
    expect(summaryTotalCents({ settled: true, totalCents: 13_500, chosenShippingCents: 900 })).toBe(
      13_500
    );
  });
});
