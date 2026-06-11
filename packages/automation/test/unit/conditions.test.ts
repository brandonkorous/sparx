// Condition evaluator — pure unit coverage of all 12 operators + AND/OR.

import type { ConditionGroup } from '@sparx/automation-schemas';
import { describe, expect, it } from 'vitest';

import { evaluateConditions } from '../../src/conditions/evaluate';

const fields = {
  'customer.type': 'fleet',
  'customer.totalSpent': 1500,
  'customer.tags': ['vip', 'wholesale'],
  'customer.email': 'a@b.test',
  'customer.daysSinceLastOrder': 60,
  'customer.company': null,
};

function group(
  conditions: ConditionGroup['conditions'],
  logic: ConditionGroup['logic'] = 'AND'
): ConditionGroup {
  return { logic, conditions };
}

describe('evaluateConditions', () => {
  it('an empty group always passes (no filter)', () => {
    expect(evaluateConditions(group([]), fields)).toBe(true);
  });

  it('eq / neq', () => {
    expect(
      evaluateConditions(
        group([{ field: 'customer.type', operator: 'eq', value: 'fleet' }]),
        fields
      )
    ).toBe(true);
    expect(
      evaluateConditions(
        group([{ field: 'customer.type', operator: 'eq', value: 'retail' }]),
        fields
      )
    ).toBe(false);
    expect(
      evaluateConditions(
        group([{ field: 'customer.type', operator: 'neq', value: 'retail' }]),
        fields
      )
    ).toBe(true);
  });

  it('eq coerces numeric strings', () => {
    expect(
      evaluateConditions(
        group([{ field: 'customer.totalSpent', operator: 'eq', value: '1500' }]),
        fields
      )
    ).toBe(true);
  });

  it('gt / gte / lt / lte', () => {
    expect(
      evaluateConditions(
        group([{ field: 'customer.totalSpent', operator: 'gt', value: 1000 }]),
        fields
      )
    ).toBe(true);
    expect(
      evaluateConditions(
        group([{ field: 'customer.totalSpent', operator: 'gte', value: 1500 }]),
        fields
      )
    ).toBe(true);
    expect(
      evaluateConditions(
        group([{ field: 'customer.totalSpent', operator: 'lt', value: 1000 }]),
        fields
      )
    ).toBe(false);
    expect(
      evaluateConditions(
        group([{ field: 'customer.daysSinceLastOrder', operator: 'lte', value: 60 }]),
        fields
      )
    ).toBe(true);
  });

  it('gt against a non-orderable value is false (not a throw)', () => {
    expect(
      evaluateConditions(group([{ field: 'customer.type', operator: 'gt', value: 5 }]), fields)
    ).toBe(false);
  });

  it('contains / not_contains — string and array', () => {
    expect(
      evaluateConditions(
        group([{ field: 'customer.email', operator: 'contains', value: '@b.test' }]),
        fields
      )
    ).toBe(true);
    expect(
      evaluateConditions(
        group([{ field: 'customer.tags', operator: 'contains', value: 'vip' }]),
        fields
      )
    ).toBe(true);
    expect(
      evaluateConditions(
        group([{ field: 'customer.tags', operator: 'not_contains', value: 'churned' }]),
        fields
      )
    ).toBe(true);
  });

  it('in / not_in', () => {
    expect(
      evaluateConditions(
        group([{ field: 'customer.type', operator: 'in', value: ['fleet', 'b2b'] }]),
        fields
      )
    ).toBe(true);
    expect(
      evaluateConditions(
        group([{ field: 'customer.type', operator: 'not_in', value: ['retail', 'prospect'] }]),
        fields
      )
    ).toBe(true);
    expect(
      evaluateConditions(
        group([{ field: 'customer.type', operator: 'in', value: ['retail'] }]),
        fields
      )
    ).toBe(false);
  });

  it('is_set / is_not_set treat null as unset', () => {
    expect(
      evaluateConditions(group([{ field: 'customer.email', operator: 'is_set' }]), fields)
    ).toBe(true);
    expect(
      evaluateConditions(group([{ field: 'customer.company', operator: 'is_not_set' }]), fields)
    ).toBe(true);
    expect(
      evaluateConditions(group([{ field: 'customer.missing', operator: 'is_not_set' }]), fields)
    ).toBe(true);
    expect(
      evaluateConditions(group([{ field: 'customer.email', operator: 'is_not_set' }]), fields)
    ).toBe(false);
  });

  it('AND requires all; OR requires any', () => {
    const both = [
      { field: 'customer.type', operator: 'eq' as const, value: 'fleet' },
      { field: 'customer.totalSpent', operator: 'gt' as const, value: 5000 },
    ];
    expect(evaluateConditions(group(both, 'AND'), fields)).toBe(false);
    expect(evaluateConditions(group(both, 'OR'), fields)).toBe(true);
  });
});
