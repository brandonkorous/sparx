import { describe, expect, it } from 'vitest';
import { ConditionGroup, EMPTY_CONDITION_GROUP, evaluateConditions } from './index';

// The thing these tests exist to stop is not "an invalid condition parses". It
// is that an invalid condition used to parse into the ONE value that changes
// the answer for everybody: the empty group, which matches everything.
//
// Found from the other end. A shipped campaign recipe used the operator
// `is_not_empty`, which exists in no schema, no evaluator and no dropdown. The
// write succeeded, the editor drew a raw slug next to a value box the operator
// does not take, and the goal it saved was "no filter" — so a campaign written
// to count the people who finished would have counted every person who started
// and reported a perfect conversion rate.
describe('a condition group refuses what it cannot evaluate', () => {
  it('rejects an operator nothing implements, instead of quietly dropping it', () => {
    const parsed = ConditionGroup.safeParse({
      logic: 'AND',
      conditions: [{ field: 'email', operator: 'is_not_empty' }],
    });
    expect(parsed.success).toBe(false);
  });

  it('never turns a malformed condition into an empty group', () => {
    // The specific regression, asserted on the VALUE rather than on success:
    // this used to come back `{logic:'AND', conditions:[{logic:'AND',
    // conditions:[]}]}`, and a caller checking only `success` would have
    // written it to the database.
    const parsed = ConditionGroup.safeParse({
      logic: 'AND',
      conditions: [{ field: 'email', operator: 'is_not_empty' }],
    });
    expect(parsed.data).toBeUndefined();
  });

  it('rejects a condition missing the field it compares', () => {
    expect(ConditionGroup.safeParse({ conditions: [{ operator: 'is_set' }] }).success).toBe(false);
  });

  it('still accepts the shapes that were always valid', () => {
    expect(
      ConditionGroup.safeParse({
        logic: 'OR',
        conditions: [
          { field: 'email', operator: 'is_set' },
          { field: 'order.total', operator: 'gt', value: 100 },
        ],
      }).success
    ).toBe(true);
  });

  it('still accepts a nested group, which is what strictness could have broken', () => {
    const parsed = ConditionGroup.safeParse({
      logic: 'AND',
      conditions: [
        { field: 'customer.type', operator: 'eq', value: 'trade' },
        { logic: 'OR', conditions: [{ field: 'email', operator: 'is_set' }] },
      ],
    });
    expect(parsed.success).toBe(true);
  });

  it('still accepts the empty group written deliberately', () => {
    // Empty is a legitimate value — "no filter" is a real thing to mean. The
    // bug was never that it exists; it was arriving at it by accident.
    expect(ConditionGroup.safeParse(EMPTY_CONDITION_GROUP).success).toBe(true);
    expect(evaluateConditions(EMPTY_CONDITION_GROUP, {})).toBe(true);
  });
});
