// Evaluator tests — focused on the date-comparison fix.
//
// Dates live in the projection as ISO strings, so before `toComparable` a date
// `gt`/`between` coerced to NaN and always returned false. These lock in that a
// date rule now compares by timestamp, while numeric rules keep numeric
// semantics (a bare numeric string must NOT be parsed as a date).

import { describe, expect, it } from 'vitest';

import { evaluateSegmentRule, type RuleProjection } from './evaluate-segment-rule';
import type { SegmentRule } from './segment-rule';

const projection: RuleProjection = {
  customer: {
    type: 'retail',
    email: 'sam@example.com',
    tags: ['vip'],
    lastOrderAt: '2026-06-15T12:00:00.000Z',
    createdAt: '2026-01-10T00:00:00.000Z',
    totalSpent: 500,
    orderCount: 4,
    daysSinceLastOrder: 40,
  },
  b2bAccount: null,
  email: { subscribed: true, unsubscribed: false, openedLast30d: 3, clickedLast30d: 1 },
};

describe('evaluateSegmentRule — date comparisons (regression: NaN → false)', () => {
  it('matches a date "after" when the ISO field is later than the rule date', () => {
    const rule: SegmentRule = {
      kind: 'predicate',
      field: 'customer.lastOrderAt',
      op: 'gt',
      value: '2026-01-01',
    };
    expect(evaluateSegmentRule(rule, projection)).toBe(true);
  });

  it('does not match a date "after" when the field is earlier than the rule date', () => {
    const rule: SegmentRule = {
      kind: 'predicate',
      field: 'customer.lastOrderAt',
      op: 'gt',
      value: '2026-12-01',
    };
    expect(evaluateSegmentRule(rule, projection)).toBe(false);
  });

  it('matches a date "between" a range that contains the field', () => {
    const rule: SegmentRule = {
      kind: 'predicate',
      field: 'customer.createdAt',
      op: 'between',
      value: ['2026-01-01', '2026-12-31'],
    };
    expect(evaluateSegmentRule(rule, projection)).toBe(true);
  });

  it('excludes a date "between" a range that does not contain the field', () => {
    const rule: SegmentRule = {
      kind: 'predicate',
      field: 'customer.createdAt',
      op: 'between',
      value: ['2026-02-01', '2026-12-31'],
    };
    expect(evaluateSegmentRule(rule, projection)).toBe(false);
  });
});

describe('evaluateSegmentRule — numeric comparisons keep numeric semantics', () => {
  it('compares a numeric field with a numeric value', () => {
    const rule: SegmentRule = {
      kind: 'predicate',
      field: 'customer.totalSpent',
      op: 'gte',
      value: 500,
    };
    expect(evaluateSegmentRule(rule, projection)).toBe(true);
  });

  it('parses a bare numeric STRING as a number, not a date', () => {
    const rule: SegmentRule = {
      kind: 'predicate',
      field: 'customer.daysSinceLastOrder',
      op: 'gt',
      value: '30',
    };
    expect(evaluateSegmentRule(rule, projection)).toBe(true);
  });
});
