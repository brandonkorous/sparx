// A RULE CHANGE REFRESHES THE HELD ORDERS (sparx persona issue 087).
//
// Who a held order waits on is worked out from the rules every time the queue
// is read. Doty set Wasatch's limit to "Wasatch's approvers (Teodora)", the row
// saved, and the queue above it still showed O-000014 with an Approve button
// until she pressed refresh. Saving, adding, removing and switching a rule all
// go through `invalidateAfterRuleChange`, so this pins what it reaches.

import { describe, expect, it } from 'vitest';
import { QueryClient } from '@wizeworks/query';
import { approvalKeys, heldOrderKey, invalidateAfterRuleChange } from './approvals-data';

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
