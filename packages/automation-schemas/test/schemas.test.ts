import { describe, expect, it } from 'vitest';

import {
  Condition,
  ConditionGroup,
  CreateAutomationInput,
  MAX_CONDITION_DEPTH,
  Trigger,
  isConditionGroup,
  triggerFromColumns,
  triggerToColumns,
} from '../src/index';

describe('automation rule document schemas', () => {
  it('accepts a valid event-triggered automation and applies defaults', () => {
    const parsed = CreateAutomationInput.parse({
      name: 'Welcome new customers',
      trigger: { kind: 'event', eventType: 'crm.customer.created' },
      actions: [{ type: 'crm.create_task', config: { title: 'Welcome {{customer.name}}' } }],
    });
    expect(parsed.conditions).toEqual({ logic: 'AND', conditions: [] });
    expect(parsed.maxDepth).toBe(3);
    expect(parsed.actions[0]?.config).toEqual({ title: 'Welcome {{customer.name}}' });
  });

  it('accepts a scheduled-predicate automation', () => {
    const t = Trigger.parse({
      kind: 'schedule',
      schedule: { cadence: 'daily' },
      predicate: {
        entity: 'customer',
        where: {
          logic: 'AND',
          conditions: [{ field: 'daysSinceLastOrder', operator: 'gte', value: 90 }],
        },
      },
    });
    expect(t.kind).toBe('schedule');
    if (t.kind === 'schedule' && t.schedule.cadence === 'daily') {
      expect(t.schedule.atMinuteUtc).toBe(0);
    }
  });

  it('round-trips a schedule trigger through its stored columns', () => {
    const t = Trigger.parse({
      kind: 'schedule',
      schedule: { cadence: 'weekly', dayOfWeek: 1, atMinuteUtc: 540 },
      predicate: { entity: 'quote', where: { logic: 'AND', conditions: [] } },
    });
    const cols = triggerToColumns(t);
    expect(cols.triggerType).toBe('schedule.weekly');
    expect(triggerFromColumns(cols.triggerType, cols.triggerConfig)).toEqual(t);
  });

  it('round-trips an event trigger through its stored columns', () => {
    const t = Trigger.parse({ kind: 'event', eventType: 'order.placed' });
    expect(triggerToColumns(t)).toEqual({ triggerType: 'order.placed', triggerConfig: {} });
    expect(triggerFromColumns('order.placed', {})).toEqual(t);
  });

  it('rejects an automation with no actions', () => {
    expect(() =>
      CreateAutomationInput.parse({
        name: 'Empty',
        trigger: { kind: 'event', eventType: 'order.placed' },
        actions: [],
      })
    ).toThrow();
  });

  it('requires a value for value-operators but not for presence checks', () => {
    expect(() => Condition.parse({ field: 'customer.type', operator: 'eq' })).toThrow();
    expect(Condition.parse({ field: 'customer.email', operator: 'is_set' }).operator).toBe(
      'is_set'
    );
    expect(Condition.parse({ field: 'customer.type', operator: 'eq', value: 'fleet' }).value).toBe(
      'fleet'
    );
  });

  it('rejects an unknown action type', () => {
    expect(() =>
      CreateAutomationInput.parse({
        name: 'Bad action',
        trigger: { kind: 'event', eventType: 'order.placed' },
        actions: [{ type: 'commerce.delete_everything', config: {} }],
      })
    ).toThrow();
  });

  it('parses a nested condition group (mixed precedence) and flags the sub-group', () => {
    const parsed = ConditionGroup.parse({
      logic: 'AND',
      conditions: [
        { field: 'customer.type', operator: 'eq', value: 'fleet' },
        {
          logic: 'OR',
          conditions: [
            { field: 'customer.totalSpent', operator: 'gt', value: 5000 },
            { field: 'customer.daysSinceLastOrder', operator: 'gte', value: 45 },
          ],
        },
      ],
    });
    expect(isConditionGroup(parsed.conditions[0])).toBe(false); // leaf
    expect(isConditionGroup(parsed.conditions[1])).toBe(true); // sub-group
  });

  it('a flat (all-leaf) group still parses unchanged — backward compatible', () => {
    const parsed = ConditionGroup.parse({
      logic: 'OR',
      conditions: [{ field: 'order.total', operator: 'gte', value: 100 }],
    });
    expect(parsed.logic).toBe('OR');
    expect(isConditionGroup(parsed.conditions[0])).toBe(false);
  });

  it(`rejects nesting deeper than ${MAX_CONDITION_DEPTH} levels`, () => {
    // root → group → group → group (4 levels) exceeds the bound.
    expect(() =>
      ConditionGroup.parse({
        logic: 'AND',
        conditions: [
          {
            logic: 'AND',
            conditions: [
              {
                logic: 'AND',
                conditions: [
                  { logic: 'AND', conditions: [{ field: 'a', operator: 'is_set' }] },
                ],
              },
            ],
          },
        ],
      })
    ).toThrow();
  });
});
