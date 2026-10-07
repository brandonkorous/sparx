// The late-payment ladder tells the business what it did.
//
// MEASURED 2026-10-06 on Gillett: "Chase overdue wholesale invoices" suspended
// O'Malley Ranch over a bill 40 days late, published `b2b.account.suspended`,
// and nothing listened. No task, nothing in the bell, and the account page read
// "Suspended" with no reason (sparx persona issue 101).

import { describe, expect, it } from 'vitest';

import { installBuiltinResolvers, registeredResolverEvents } from '@wizeworks/automation';

import { installEntityResolvers } from '../resolvers.js';
import { B2B_ACCOUNT_CREDIT_HOLD_NOTICE, B2B_ACCOUNT_SUSPENDED_NOTICE } from './b2b.js';
import { SYSTEM_AUTOMATIONS } from './index.js';

// Both halves, the way the worker installs them.
installBuiltinResolvers();
installEntityResolvers();

describe('a wholesale customer stopped for paying late', () => {
  it.each([
    [B2B_ACCOUNT_SUSPENDED_NOTICE, 'b2b.account.suspended'],
    [B2B_ACCOUNT_CREDIT_HOLD_NOTICE, 'b2b.account.credit_hold'],
  ])('tells the owners, naming the business and how late', (spec, eventType) => {
    expect(spec.trigger).toEqual({ kind: 'event', eventType });
    expect(spec.actions[0]).toMatchObject({
      type: 'platform.notify',
      config: { audience: 'owners', entityType: 'b2b_account', entityId: '{{b2bAccount.id}}' },
    });
    const title = (spec.actions[0]?.config as { title: string }).title;
    expect(title).toContain('{{b2bAccount.companyName}}');
    expect(title).toContain('{{b2bAccount.overdueDays}}');
    expect(SYSTEM_AUTOMATIONS.some((seed) => seed.spec.key === spec.key)).toBe(true);
  });

  it('can read the event it listens to', () => {
    const events = registeredResolverEvents();
    expect(events).toContain('b2b.account.suspended');
    expect(events).toContain('b2b.account.credit_hold');
  });
});

// The general form of the gap: a built-in automation whose event nothing can
// read runs with no fields, so a title like "{{b2bAccount.companyName}}" prints
// empty, or a condition never matches.
describe('every built-in automation that reads fields from an event', () => {
  it('listens to an event the engine can read', () => {
    const events = new Set(registeredResolverEvents());
    const unread = SYSTEM_AUTOMATIONS.filter(
      ({ spec }) =>
        spec.trigger.kind === 'event' &&
        JSON.stringify(spec.actions).includes('{{') &&
        !events.has(spec.trigger.eventType)
    ).map(({ spec }) => (spec.trigger.kind === 'event' ? spec.trigger.eventType : ''));
    expect(unread).toEqual([]);
  });
});
