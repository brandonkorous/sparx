// Every delivery event a business's emails produced had no customer: email-worker and
// the delivery webhook read a `customer_id` tag that no sender set (sparx persona
// issue 161). The queue knows the customer, so its sends carry the tag.

import { describe, expect, it } from 'vitest';

import { sendVariables } from './email-dispatch';

describe('the tags a queued send carries', () => {
  it('names the customer the queued row names', () => {
    expect(sendVariables({ broadcast_id: 'b1', campaign: 'winter' }, 'c1')).toEqual({
      broadcast_id: 'b1',
      campaign: 'winter',
      customer_id: 'c1',
    });
  });

  it('names the customer even when the enqueuer set no tags', () => {
    expect(sendVariables(undefined, 'c1')).toEqual({ customer_id: 'c1' });
  });

  it('leaves the tags alone when the row names no customer', () => {
    expect(sendVariables({ automation_key: 'welcome' }, null)).toEqual({
      automation_key: 'welcome',
    });
    expect(sendVariables(undefined, null)).toBeUndefined();
  });
});
