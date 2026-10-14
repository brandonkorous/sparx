import { describe, expect, it } from 'vitest';
import { evaluateConditions } from '@wizeworks/automation-schemas';
import { startingGoal } from './library';
import { FUNNEL_KINDS } from './schemas';

// A new campaign of a kind starts with the goal that kind waits for (sparx
// persona issue 158). "Filling the calendar" came with no goal, so it could not
// be turned on, and the picker had no way to say "they booked". Its last step,
// "Booked it in", says it is "recorded on its own when the success rule below
// comes true", over an empty rule.

const PERSON = { 'customer.id': 'c1', 'customer.email': 'renee.castaneda@wasatchutility.test' };

/** What each kind's last step is about, as the automation resolvers render it. */
const DONE: Record<string, Record<string, unknown>> = {
  lead: { ...PERSON, 'customer.lifecycleStage': 'customer' },
  recovery: { ...PERSON, 'order.paymentStatus': 'paid', 'customer.orderCount': 1 },
  purchase: { ...PERSON, 'order.paymentStatus': 'paid', 'customer.orderCount': 1 },
  booking: { ...PERSON, 'booking.status': 'confirmed' },
  winback: { ...PERSON, 'order.paymentStatus': 'paid', 'customer.orderCount': 3 },
};

describe('a new campaign', () => {
  for (const kind of FUNNEL_KINDS) {
    if (kind === 'custom') continue;
    it(`of kind "${kind}" starts with a goal its own success meets`, () => {
      const goal = startingGoal(kind);
      expect(goal, kind).toBeDefined();
      expect(evaluateConditions(goal!, DONE[kind] ?? {})).toBe(true);
      expect(evaluateConditions(goal!, PERSON)).toBe(false);
    });
  }

  it('of kind "custom" starts with none, because nobody can know what it measures', () => {
    expect(startingGoal('custom')).toBeUndefined();
  });
});
