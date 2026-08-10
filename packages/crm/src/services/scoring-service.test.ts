// computeScore — the arithmetic, in isolation (docs/144 §10).
//
// Pure and DB-free, so every edge of the scoring model can be pinned without a
// database: the sum, the clamp at both ends, decay, and the interaction between
// them. The service's DB behaviour (idempotence, the event rows, the site-scoped
// model lookup) is tested in `test/integration/scoring.test.ts`.

import { describe, expect, it } from 'vitest';
import type { ConditionGroup } from '@sparx/automation-schemas';

import { computeScore } from './scoring-service';

function rule(field: string, operator: string, value: unknown, points: number, label: string) {
  return {
    condition: { logic: 'AND', conditions: [{ field, operator, value }] } as ConditionGroup,
    points,
    label,
  };
}

/** A model shaped the way Prisma hands one back. */
function model(rules: unknown[], opts: { decayPerDay?: number | null; maxScore?: number } = {}) {
  return {
    rules: rules as never,
    decayPerDay: (opts.decayPerDay ?? null) as never,
    maxScore: opts.maxScore ?? 100,
  };
}

const FIELDS = {
  'customer.orderCount': 3,
  'customer.totalSpent': 1200,
  'customer.lifecycleStage': 'customer',
  'customer.doNotContact': false,
  'customer.tags': ['vip', 'trade'],
};

describe('computeScore', () => {
  it('adds up EVERY rule that fits, not just the first', () => {
    // The whole design: rules are independent statements, so order cannot
    // change the answer and each one can be read on its own.
    const result = computeScore(
      model([
        rule('customer.orderCount', 'gt', 0, 20, 'Has bought before'),
        rule('customer.totalSpent', 'gte', 1000, 30, 'Spends a lot'),
        rule('customer.lifecycleStage', 'eq', 'customer', 10, 'Already a customer'),
      ]),
      FIELDS,
      null
    );
    expect(result.score).toBe(60);
    expect(result.reasons.map((r) => r.label)).toEqual([
      'Has bought before',
      'Spends a lot',
      'Already a customer',
    ]);
  });

  it('gives the same answer whatever order the rules are in', () => {
    const rules = [
      rule('customer.orderCount', 'gt', 0, 20, 'Bought'),
      rule('customer.totalSpent', 'gte', 1000, 30, 'Spends'),
    ];
    const forwards = computeScore(model(rules), FIELDS, null);
    const backwards = computeScore(model([...rules].reverse()), FIELDS, null);
    expect(backwards.score).toBe(forwards.score);
  });

  it('skips a rule that does not fit, and says nothing about it', () => {
    const result = computeScore(
      model([
        rule('customer.orderCount', 'gt', 100, 50, 'Buys constantly'),
        rule('customer.orderCount', 'gt', 0, 20, 'Has bought before'),
      ]),
      FIELDS,
      null
    );
    expect(result.score).toBe(20);
    expect(result.reasons).toHaveLength(1);
  });

  it('subtracts a negative rule — the thing that keeps a hot list honest', () => {
    const result = computeScore(
      model([
        rule('customer.orderCount', 'gt', 0, 50, 'Has bought before'),
        rule('customer.doNotContact', 'eq', false, -20, 'Cannot be contacted'),
      ]),
      FIELDS,
      null
    );
    expect(result.score).toBe(30);
  });

  it('never goes below zero, however negative the rules get', () => {
    const result = computeScore(
      model([rule('customer.orderCount', 'gt', 0, -500, 'Something very bad')]),
      FIELDS,
      null
    );
    expect(result.score).toBe(0);
  });

  it('never goes above the ceiling, so the number means the same thing everywhere', () => {
    const result = computeScore(
      model(
        [
          rule('customer.orderCount', 'gt', 0, 90, 'A'),
          rule('customer.totalSpent', 'gt', 0, 90, 'B'),
        ],
        { maxScore: 100 }
      ),
      FIELDS,
      null
    );
    expect(result.score).toBe(100);
  });

  it('honours a ceiling that is not 100', () => {
    const result = computeScore(
      model([rule('customer.orderCount', 'gt', 0, 40, 'A')], { maxScore: 25 }),
      FIELDS,
      null
    );
    expect(result.score).toBe(25);
  });

  it('bleeds points off for every quiet day', () => {
    const result = computeScore(
      model([rule('customer.orderCount', 'gt', 0, 50, 'Has bought')], { decayPerDay: 2 }),
      FIELDS,
      10
    );
    expect(result.score).toBe(30);
    expect(result.decayed).toBe(20);
  });

  it('decays from the EARNED total, not from the clamped one', () => {
    // Two records both sitting at the 100 ceiling can be very differently keen
    // underneath. Clamping first would age them identically, which is exactly
    // the distinction decay exists to preserve.
    const veryKeen = computeScore(
      model(
        [
          rule('customer.orderCount', 'gt', 0, 100, 'A'),
          rule('customer.totalSpent', 'gt', 0, 100, 'B'),
        ],
        { decayPerDay: 5 }
      ),
      FIELDS,
      10
    );
    const justKeen = computeScore(
      model([rule('customer.orderCount', 'gt', 0, 100, 'A')], { decayPerDay: 5 }),
      FIELDS,
      10
    );
    expect(veryKeen.score).toBe(100); // 200 − 50, still over the ceiling
    expect(justKeen.score).toBe(50); // 100 − 50
  });

  it('does not decay a record that has never done anything', () => {
    // Null idle days means "no activity on record", which is the state of a
    // contact added this morning. Treating that as infinitely stale would zero
    // every new lead the moment it arrived.
    const result = computeScore(
      model([rule('customer.orderCount', 'gt', 0, 50, 'Has bought')], { decayPerDay: 5 }),
      FIELDS,
      null
    );
    expect(result.score).toBe(50);
    expect(result.decayed).toBe(0);
  });

  it('does not decay on day zero', () => {
    const result = computeScore(
      model([rule('customer.orderCount', 'gt', 0, 50, 'Has bought')], { decayPerDay: 5 }),
      FIELDS,
      0
    );
    expect(result.score).toBe(50);
  });

  it('scores zero with no rules — an unconfigured model ranks nobody', () => {
    const result = computeScore(model([]), FIELDS, null);
    expect(result.score).toBe(0);
    expect(result.reasons).toEqual([]);
  });

  it('treats an empty condition as a baseline everybody earns', () => {
    // Legitimate and the author's choice: "every contact starts at 10".
    const result = computeScore(
      model([{ condition: { logic: 'AND', conditions: [] }, points: 10, label: 'Baseline' }]),
      FIELDS,
      null
    );
    expect(result.score).toBe(10);
  });

  it('matches a value inside a list field', () => {
    const result = computeScore(
      model([rule('customer.tags', 'contains', 'vip', 25, 'Marked VIP')]),
      FIELDS,
      null
    );
    expect(result.score).toBe(25);
  });

  it('ignores a stored rule set that cannot be read rather than throwing', () => {
    // A model edited by hand, or written before a schema change, must not stop
    // the evaluator dead on every record it touches.
    const result = computeScore(model(['not-a-rule']), FIELDS, null);
    expect(result.score).toBe(0);
  });

  it('reports decay no larger than what was actually earned', () => {
    // The panel reads "inactivity −N". Showing a bigger drop than the record
    // ever had would be arithmetic nobody could follow.
    const result = computeScore(
      model([rule('customer.orderCount', 'gt', 0, 10, 'Has bought')], { decayPerDay: 100 }),
      FIELDS,
      5
    );
    expect(result.score).toBe(0);
    expect(result.decayed).toBe(10);
  });
});
