// "Your settings" only when they are hers (persona issue 279). Pressing "Work it
// out now" stamped the sweep time by creating the settings row with the standard
// values, and from then on the screen said "Your settings" and Cost to keep stopped
// saying it used the standard 25%, though Doty had chosen nothing.

import { describe, expect, it } from 'vitest';

import { DEFAULT_PLANNING_POLICY, loadPlanningPolicy } from './planning-policy';

const row = (over: Record<string, unknown>) => ({
  tenantId: 'gillett',
  ...DEFAULT_PLANNING_POLICY,
  holdingCostRatePct: { toString: () => '25.00' },
  lastSweepAt: new Date('2026-10-14T08:36:50Z'),
  updatedAt: new Date('2026-10-14T08:36:50Z'),
  ...over,
});
const tx = (found: unknown) =>
  ({ inventoryPlanningPolicy: { findFirst: () => Promise.resolve(found) } }) as never;

describe('whose planning settings these are', () => {
  it('are the standard ones when the row only stamps a sweep', async () => {
    const policy = await loadPlanningPolicy(tx(row({})), 'gillett');
    expect(policy.configured).toBe(false);
    expect(policy.lastSweepAt).toBe('2026-10-14T08:36:50.000Z');
  });

  it('are hers once any value differs from the standard', async () => {
    const policy = await loadPlanningPolicy(tx(row({ holdingCostRatePct: 30 })), 'gillett');
    expect(policy.configured).toBe(true);
  });

  it('are the standard ones when there is no row at all', async () => {
    expect((await loadPlanningPolicy(tx(null), 'gillett')).configured).toBe(false);
  });
});
