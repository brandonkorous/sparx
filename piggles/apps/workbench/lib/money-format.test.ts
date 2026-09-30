// Money is drawn, never thrown.
//
// ── The defect this exists for ───────────────────────────────────────────────
//
// "How stock is valued" has a three-character Currency field a business owner
// types into. The schema behind it checked `.length(3)` and nothing else, so
// `123` saved cleanly. `Intl.NumberFormat({ style: 'currency', currency: '123' })`
// throws `RangeError: Invalid currency code`, and a delivery pane calls
//
//     formatCents(receipt.goodsValueCents, receipt.baseCurrency)
//
// so three characters in a settings field took the whole screen out as a thrown
// render rather than a wrong number.
//
// MEASURED 2026-09-19: **24 of 27** currency validators across the packages
// checked length without checking letters, and **81 of 88** Intl currency
// formatters were fed from a variable with nothing around them. The validators
// are fixed; this is the floor under them, because a value can also arrive from
// a row written years ago or a file somebody else exported.
// [[feedback_one_outcome_two_causes]]

import { describe, expect, it } from 'vitest';

import { formatAmount, formatCentsAmount, isUsableCurrency } from './money-format';

describe('formatting money never throws', () => {
  it('says a real currency the way a person expects', () => {
    expect(formatAmount(12.5, 'USD')).toContain('12.50');
    expect(formatCentsAmount(1250, 'USD')).toBe(formatAmount(12.5, 'USD'));
    expect(formatCentsAmount(193456, 'USD')).toContain('1,934.56');
  });

  it('accepts a lowercase code, because Intl does', () => {
    // Not a spelling choice to make here: 'usd' and 'USD' are the same currency
    // to the formatter, and refusing one of them would be this module inventing
    // a rule the rest of the system does not have.
    expect(formatAmount(12.5, 'usd')).toBe(formatAmount(12.5, 'USD'));
  });

  it('draws something readable for a code it cannot use', () => {
    // Each of these is a RangeError from a bare Intl.NumberFormat.
    for (const bad of ['123', '$$$', '   ', '', 'US', 'USDD', '1 2']) {
      const drawn = formatAmount(12.5, bad);
      expect(typeof drawn, bad).toBe('string');
      expect(drawn, bad).toContain('12.50');
    }
  });

  it('shows the unusable code rather than pretending it is dollars', () => {
    // Printing "$12.50" for a currency nobody could read is inventing a fact.
    // The raw code is what lets somebody see what is wrong and go and fix it.
    // [[feedback_never_present_absence_as_measurement]]
    expect(formatAmount(12.5, '123')).toBe('123 12.50');
    expect(formatAmount(12.5, '')).toBe('? 12.50');
  });

  it('survives a figure that is not a number', () => {
    // An amount that failed to load is exactly when a formatter gets NaN.
    expect(formatAmount(Number.NaN, 'USD')).toContain('0.00');
    expect(formatCentsAmount(Number.NaN, 'USD')).toContain('0.00');
  });

  it('proves the bare formatter really does throw on these', () => {
    // The guard on the guard: if Intl ever stopped throwing, this module would
    // be protecting against nothing and nobody would know.
    // [[feedback_a_test_that_cannot_go_red]]
    for (const bad of ['123', '$$$', '   ']) {
      expect(
        () => new Intl.NumberFormat(undefined, { style: 'currency', currency: bad }).format(1),
        bad
      ).toThrow(RangeError);
    }
  });

  it('agrees with what the settings field is allowed to accept', () => {
    expect(isUsableCurrency('USD')).toBe(true);
    expect(isUsableCurrency('gbp')).toBe(true);
    expect(isUsableCurrency(' EUR ')).toBe(true);
    expect(isUsableCurrency('123')).toBe(false);
    expect(isUsableCurrency('US')).toBe(false);
    expect(isUsableCurrency('')).toBe(false);
  });
});
