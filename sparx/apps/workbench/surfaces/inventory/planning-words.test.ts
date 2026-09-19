import { describe, expect, it } from 'vitest';
import { forecastLine } from './planning-data';

describe('the sentence saying where the forecast came from', () => {
  it('names the window it measured', () => {
    expect(forecastLine({ forecastBasis: '30d', daysWithDemand: 4, historyDays: 62 }, '1.2')).toBe(
      'The forecast uses the last 30 days, at 1.2 a day. Sales landed on 4 days out of the last 90, and there are 62 days of history for it.'
    );
  });

  it('does not say "uses the nothing sold" when nothing sold', () => {
    // Measured as P03 on Juniper Row: the pane whose own heading promises
    // "nothing here is a black box" printed "The forecast uses the nothing
    // sold, at 0 a day." on the account's only reorder line.
    const line = forecastLine({ forecastBasis: 'none', daysWithDemand: 0, historyDays: 25 }, '0');
    expect(line).not.toContain('uses the nothing sold');
    expect(line).toBe(
      'Nothing has sold, so the forecast is 0 a day, and there are 25 days of history for it.'
    );
  });

  it('does not repeat itself about the 90 days when nothing sold', () => {
    // "Sales landed on 0 days out of the last 90" is the same fact a second
    // time, in a longer sentence.
    expect(
      forecastLine({ forecastBasis: 'none', daysWithDemand: 0, historyDays: 25 }, '0')
    ).not.toContain('out of the last 90');
  });

  it('does not say "uses the not measured" when the rate is unknown', () => {
    const line = forecastLine({ forecastBasis: '', daysWithDemand: 0, historyDays: 3 }, '0');
    expect(line).not.toContain('uses the not measured');
    expect(line).toContain('has not been measured');
  });

  it('says one day in the singular', () => {
    expect(forecastLine({ forecastBasis: 'none', daysWithDemand: 0, historyDays: 1 }, '0')).toBe(
      'Nothing has sold, so the forecast is 0 a day, and there is 1 day of history for it.'
    );
    expect(
      forecastLine({ forecastBasis: '7d', daysWithDemand: 1, historyDays: 1 }, '0.5')
    ).toContain('Sales landed on 1 day out of the last 90, and there is 1 day of history');
  });
});
