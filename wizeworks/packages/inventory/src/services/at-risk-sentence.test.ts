// The At risk sentence, read as a shop owner would (persona issue 277): Gillett's
// rows said "-1 left is only 0 days of cover", "0 left is only 0 days of cover"
// and "about 1 orders would have nothing to come from".

import { describe, expect, it } from 'vitest';

import { explainRisk } from './planning-reports';

const base = {
  onOrder: 0,
  velocity: 0.25,
  leadTimeDays: 14,
  leadTimeSource: 'assumed',
  cover: 0,
  unitsAtRisk: 4,
};

describe('the At risk sentence', () => {
  it('says an oversold item is already short, not "-1 left"', () => {
    const said = explainRisk({ ...base, available: -1 });
    expect(said).toContain('Already 1 short');
    expect(said).not.toContain('-1');
    expect(said).not.toContain('0 days of cover');
  });

  it('says none left, with no "0 days of cover"', () => {
    const said = explainRisk({ ...base, available: 0 });
    expect(said).toContain('None left');
    expect(said).not.toContain('0 days of cover');
  });

  it('says one order, not "1 orders"', () => {
    const said = explainRisk({ ...base, available: 1, cover: 7, unitsAtRisk: 1 });
    expect(said).toContain('about 1 order would');
    expect(said).toContain('1 left is only 7 days of cover');
  });
});
