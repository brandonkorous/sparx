// What a Currency picker offers, and what it must never drop.
//
// Five Currency fields were an empty box with `maxLength={3}` and no validation
// past the schema's "three letters", so a stored value can be a code this
// platform cannot name. Opening a picker must not change her data: an unknown
// value is offered back, marked, rather than quietly resolving to whatever sorts
// first. Issue 730. [[feedback_honor_the_users_choice]]

import { describe, expect, it } from 'vitest';

import { currencyItems, currencyName, currencyOptions } from './currency';

describe('currencyItems', () => {
  it('names a currency rather than showing its code alone', () => {
    const usd = currencyOptions().find((item) => item.value === 'USD');
    expect(usd?.label).toBe('US Dollar (USD)');
    expect(currencyName('GBP')).toBe('British Pound');
  });

  it('offers every currency, in name order', () => {
    const labels = currencyOptions().map((item) => item.label);
    expect(labels.length).toBeGreaterThan(100);
    expect([...labels].sort((a, b) => a.localeCompare(b))).toEqual(labels);
  });

  it('keeps a stored value it cannot name, and says so', () => {
    const items = currencyItems('ZZZ', true);
    expect(items[0]).toEqual({ value: 'ZZZ', label: 'ZZZ (not a currency we know)' });
    expect(items.some((item) => item.value === 'USD')).toBe(true);
  });

  it('does not repeat a stored value it CAN name', () => {
    const items = currencyItems('GBP', true);
    expect(items.filter((item) => item.value === 'GBP')).toHaveLength(1);
    expect(items[0]?.label).not.toContain('not a currency');
  });

  it('offers a way back to blank only when the field is optional', () => {
    expect(currencyItems('USD', false)[0]).toEqual({ value: '', label: 'No currency' });
    expect(currencyItems('USD', true).some((item) => item.value === '')).toBe(false);
  });
});
