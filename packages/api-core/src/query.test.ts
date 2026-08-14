// The two query-string parsers, pinned.
//
// `queryBool` exists because `z.coerce.boolean()` had been written 63 times
// across 42 route files, and it is `Boolean(value)` — so `?include_archived=false`
// INCLUDED archived records on every one of them. `queryInt` exists because
// `z.int()` in a query schema rejects "50", which made `GET /v1/finance/expenses`
// answer 422 to every caller that sent a limit.

import { describe, expect, it } from 'vitest';
import { queryBool, queryInt } from './query';

describe('queryBool', () => {
  it('reads "false" as false — the whole reason this exists', () => {
    // `z.coerce.boolean().parse('false')` is `true`. That is the bug.
    expect(queryBool.parse('false')).toBe(false);
  });

  it('reads "true" as true', () => {
    expect(queryBool.parse('true')).toBe(true);
  });

  it('passes a real boolean through, for a programmatic caller', () => {
    expect(queryBool.parse(true)).toBe(true);
    expect(queryBool.parse(false)).toBe(false);
  });

  it('rejects anything else rather than guessing', () => {
    // `?paid=yes` is a caller mistake worth a 422. Coercing it to `true` is how
    // a filter silently does the opposite of what someone asked for.
    for (const bad of ['yes', 'no', '1', '0', '', 'TRUE', null, 1]) {
      expect(queryBool.safeParse(bad).success).toBe(false);
    }
  });

  it('is absent when absent, so a filter can tell "unset" from "false"', () => {
    const schema = queryBool.optional();
    expect(schema.parse(undefined)).toBeUndefined();
    expect(schema.parse('false')).toBe(false);
  });
});

describe('queryInt', () => {
  it('accepts the string a query string actually carries', () => {
    expect(queryInt.parse('50')).toBe(50);
  });

  it('accepts a real number too', () => {
    expect(queryInt.parse(50)).toBe(50);
  });

  it('still rejects a non-integer', () => {
    expect(queryInt.safeParse('12.5').success).toBe(false);
    expect(queryInt.safeParse('abc').success).toBe(false);
  });

  it('carries its bounds and default through', () => {
    const limit = queryInt.min(1).max(200).default(50);
    expect(limit.parse(undefined)).toBe(50);
    expect(limit.parse('200')).toBe(200);
    expect(limit.safeParse('201').success).toBe(false);
    expect(limit.safeParse('0').success).toBe(false);
  });
});
