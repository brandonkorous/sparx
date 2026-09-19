import { describe, expect, it } from 'vitest';
import { describeRule, NO_CONDITIONS } from './segment-summary';

/**
 * "NUMBER OF ORDERS IS AT LEAST 1, AND 2 MORE" — OVER A COUNT OF ZERO.
 *
 * Customers -> Groups of customers, 2026-09-16. The seeded "At Risk" group read:
 *
 *     At Risk    No members yet    Number of orders is at least 1, and 2 more
 *
 * A shop owner reads that as "everyone who has ever bought from me", sees zero
 * beside it, and concludes the software is broken. It is not: the group is
 * "has ordered AND has not ordered for ninety days", and she has six customers
 * who all bought within the week. The one condition that explains the zero was
 * one of the two the line hid.
 *
 * The column printed the FIRST condition and counted the rest, on the reasoning
 * that the first is usually what the group was named after. Checked against what
 * the platform actually seeds, that holds for three of five and fails on the two
 * that matter most.
 *
 * The other half: `not` was dropped in silence, so a group built on "not
 * subscribed" rendered as "Subscribed to marketing is yes" — the exact opposite
 * of the group, with nothing to suggest a word was missing.
 */
describe('describeRule', () => {
  const pred = (field: string, op: string, value: unknown) => ({
    kind: 'predicate',
    field,
    op,
    value,
  });

  it('spells out every condition, not just the first', () => {
    const atRisk = {
      kind: 'and',
      children: [
        pred('customer.orderCount', 'gte', 1),
        pred('customer.daysSinceLastOrder', 'gte', 90),
      ],
    };
    const line = describeRule(atRisk);
    expect(line).not.toContain('1 more');
    expect(line).toContain('90');
    expect(line).toContain(' and ');
  });

  it('says a single condition on its own, with no connector', () => {
    const line = describeRule(pred('customer.totalSpent', 'gte', 5000));
    expect(line).toContain('5000');
    expect(line).not.toContain(' and ');
    expect(line).not.toContain(',');
  });

  it('reads three conditions the way they would be said out loud', () => {
    const line = describeRule({
      kind: 'and',
      children: [
        pred('customer.orderCount', 'gte', 1),
        pred('customer.daysSinceLastOrder', 'gte', 90),
        pred('customer.doNotContact', 'eq', false),
      ],
    });
    // "A, B, and C" — not "A and B and C".
    expect(line).toMatch(/, and /);
    expect(line.match(/ and /g)?.length).toBe(1);
  });

  it('brackets a nested group of the other kind, so the grouping survives', () => {
    // "(opened or clicked) and subscribed". Without the brackets an English
    // reader binds the `and` tighter and gets the wrong group.
    const line = describeRule({
      kind: 'and',
      children: [
        {
          kind: 'or',
          children: [pred('email.openedLast30d', 'gte', 1), pred('email.clickedLast30d', 'gte', 1)],
        },
        pred('email.subscribed', 'eq', true),
      ],
    });
    expect(line.startsWith('(')).toBe(true);
    expect(line).toContain(' or ');
    expect(line).toContain(') and ');
  });

  it('says NOT out loud instead of dropping it', () => {
    const line = describeRule({
      kind: 'not',
      child: pred('email.subscribed', 'eq', true),
    });
    // The old version rendered this as the plain predicate, which is its
    // opposite. Whatever else it says, it must not read as the bare rule.
    expect(line).toContain('not');
    expect(line).not.toBe(describeRule(pred('email.subscribed', 'eq', true)));
  });

  it('falls back to a count once a rule is too long to be a sentence', () => {
    const many = {
      kind: 'and',
      children: [
        pred('customer.orderCount', 'gte', 1),
        pred('customer.totalSpent', 'gte', 10),
        pred('customer.daysSinceLastOrder', 'lte', 90),
        pred('customer.daysSinceCreated', 'lte', 30),
        pred('email.subscribed', 'eq', true),
      ],
    };
    expect(describeRule(many)).toContain('4 more');
  });

  it('says so plainly when there is nothing readable in the tree', () => {
    expect(describeRule({})).toBe(NO_CONDITIONS);
    expect(describeRule(null)).toBe(NO_CONDITIONS);
  });
});
