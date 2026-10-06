// The seed reconcile's own events reach the broker.
//
// The reconcile closes tasks whose reason is gone, and each close is a crm.*
// event: `crm.task.completed`, or `crm.task.updated` when it was canceled. Those
// events go to whatever publisher @wizeworks/crm holds, and that is a
// LoggingPublisher that DISCARDS until `installCrmPubSubBridge` swaps it out.
// Only the engine's own paths installed the bridge, and the release runs the
// reconcile on a fresh pod before any tick has.
//
// MEASURED 2026-10-06 on Gillett Diesel Service: the reconcile closed three
// "Order ... is waiting for your sign-off" tasks, and the search box went on
// listing all three as open, one of them under its old blank-name title.
//
// What is pinned: the bridge is installed before the reconcile runs.

import { beforeEach, describe, expect, it, vi } from 'vitest';

const calls: string[] = [];

vi.mock('@wizeworks/crm/pubsub', () => ({
  installCrmPubSubBridge: () => {
    calls.push('bridge');
  },
}));
vi.mock('@wizeworks/automation-actions', () => ({
  installModuleActions: () => undefined,
  seedSystemAutomations: () => Promise.resolve(),
  reconcileSystemSeeds: () => {
    calls.push('reconcile');
    return Promise.resolve({ modules: [], tenantsSeeded: 0, tenantsSkipped: 0 });
  },
}));
vi.mock('@wizeworks/automation', () => ({
  getScanner: () => undefined,
  handleTrigger: () => Promise.resolve(),
  installBuiltins: () => undefined,
  resolveFields: () => Promise.resolve({}),
  runAutomationTick: () => Promise.resolve({}),
  runScheduleTick: () => Promise.resolve({}),
}));
vi.mock('@wizeworks/db', () => ({ prisma: {}, withTenant: () => Promise.resolve() }));

const { reconcileSeeds } = await import('./runtime.js');

const logger = { info: () => undefined, warn: () => undefined, error: () => undefined };

beforeEach(() => {
  calls.length = 0;
});

describe('the seed reconcile', () => {
  it('installs the crm bridge before it closes any task', async () => {
    await reconcileSeeds(logger as never);
    expect(calls).toEqual(['bridge', 'reconcile']);
  });
});
