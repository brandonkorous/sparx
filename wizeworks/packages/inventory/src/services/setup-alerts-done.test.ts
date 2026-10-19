// Stock setup's last step is not "already done" for 3 of 685 lines (persona
// issue 281). Gillett's setup said "You have already done this somewhere else:
// tick it off" under "Set the level at which an item counts as running low",
// while Reorder said 682 of 685 stock lines had no level.

import { describe, expect, it } from 'vitest';

import { buildView } from './setup-progress';

const world = (levelsWithAlerts: number) => ({
  locations: 2,
  items: 653,
  stockedPositions: 685,
  openingCounts: 0,
  levelsWithAlerts,
  importsApplied: 1,
  stockLines: 685,
});
const alerts = (levels: number) =>
  buildView(null, world(levels)).stepViews.find((s) => s.key === 'alerts');

describe('the alerts step', () => {
  it('is not done with 3 of 685 lines set, and says how far it has got', () => {
    const step = alerts(3);
    expect(step?.satisfied).toBe(false);
    expect(step?.discrepancy).toBe('3 of your 685 stock lines have a level so far.');
  });

  it('is done once every stocked line has a level', () => {
    const step = alerts(685);
    expect(step?.satisfied).toBe(true);
    expect(step?.discrepancy).toContain('already done this');
  });

  it('says nothing when no line has a level yet', () => {
    expect(alerts(0)?.discrepancy).toBeNull();
  });
});
