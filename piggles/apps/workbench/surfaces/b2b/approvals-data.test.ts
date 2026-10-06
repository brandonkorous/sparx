// A RULE CHANGE REFRESHES THE HELD ORDERS (sparx persona issue 087): who an order
// waits on is worked out from the rules, so every rule write goes through
// `invalidateAfterRuleChange`, and this pins what it reaches.

import { describe, expect, it } from 'vitest';
import { QueryClient } from '@wizeworks/query';
import { approvalKeys, heldOrderKey } from './approvals-data';
import { invalidateAfterRuleChange } from './approvals/rules-data';

function seeded() {
  const client = new QueryClient();
  const keys = {
    rules: approvalKeys.rules,
    queue: [...approvalKeys.queue, { q: '' }],
    searched: [...approvalKeys.queue, { q: 'wasatch' }],
    orderPane: heldOrderKey('O-000014'),
    unrelated: ['b2b', 'invoices'],
  };
  for (const key of Object.values(keys)) client.setQueryData(key, { items: [] });
  return { client, keys };
}

function invalidated(client: QueryClient, key: readonly unknown[]): boolean {
  return client.getQueryState(key)?.isInvalidated ?? false;
}

describe('invalidateAfterRuleChange', () => {
  it('refreshes the queue, whatever it was searched for, and not only the rules', async () => {
    const { client, keys } = seeded();
    await invalidateAfterRuleChange(client);
    expect(invalidated(client, keys.rules)).toBe(true);
    expect(invalidated(client, keys.queue)).toBe(true);
    expect(invalidated(client, keys.searched)).toBe(true);
  });

  it('refreshes the held-order notice on an open order pane', async () => {
    const { client, keys } = seeded();
    await invalidateAfterRuleChange(client);
    expect(invalidated(client, keys.orderPane)).toBe(true);
  });

  it('leaves unrelated lists alone', async () => {
    const { client, keys } = seeded();
    await invalidateAfterRuleChange(client);
    expect(invalidated(client, keys.unrelated)).toBe(false);
  });
});
