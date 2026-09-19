import { describe, expect, it } from 'vitest';
import { explainEmptyPeriod, periodCountLine } from './export-period-words';

describe('what the export says about its period', () => {
  it('counts the costs when there are some', () => {
    expect(periodCountLine({ inPeriod: 5, everRecorded: 5 })).toBe('5 costs');
  });

  it('reads differently at one than at two', () => {
    const one = periodCountLine({ inPeriod: 1, everRecorded: 1 }) ?? '';
    const two = periodCountLine({ inPeriod: 2, everRecorded: 2 }) ?? '';
    expect(one).toBe('1 cost');
    expect(one.replace(/\d+/g, 'N')).not.toBe(two.replace(/\d+/g, 'N'));
  });

  it('tells an empty period apart from an empty business', () => {
    // THE DEFECT. Both of these used to read "no costs recorded". The first is a
    // shop that has recorded five costs this month looking at last month's
    // export, which is the default; being told it has no costs is how a person
    // decides their records have gone missing.
    const emptyPeriod = periodCountLine({ inPeriod: 0, everRecorded: 5 });
    const emptyBusiness = periodCountLine({ inPeriod: 0, everRecorded: 0 });
    expect(emptyPeriod).toBe('nothing in this period, though you have 5 costs recorded');
    expect(emptyBusiness).toBe('no costs recorded yet');
    expect(emptyPeriod).not.toBe(emptyBusiness);
  });

  it('says nothing at all until the counts arrive', () => {
    // "No costs recorded" printed while the answer is still loading is the
    // alarming reading, shown for free, on every single load.
    expect(periodCountLine(null)).toBeNull();
    expect(periodCountLine(undefined)).toBeNull();
  });
});

describe('explaining why the period is empty', () => {
  it('explains the default when that is what is showing', () => {
    const line = explainEmptyPeriod({ inPeriod: 0, everRecorded: 5 }, true);
    expect(line).toContain('Last month');
    expect(line).toContain('Change the period above');
  });

  it('drops the bit about the default when she picked the period herself', () => {
    // She chose "This quarter" and it is empty. Telling her about a default she
    // is not looking at is an explanation of something that did not happen.
    const line = explainEmptyPeriod({ inPeriod: 0, everRecorded: 5 }, false);
    expect(line).toBe('Change the period above to send a different one.');
  });

  it('stays quiet when the period has costs in it', () => {
    expect(explainEmptyPeriod({ inPeriod: 5, everRecorded: 5 }, true)).toBeNull();
  });

  it('stays quiet when there is nothing recorded anywhere', () => {
    // Changing the period will not help a shop that has never recorded a cost.
    // It needs to record one, and the empty state above says so.
    expect(explainEmptyPeriod({ inPeriod: 0, everRecorded: 0 }, true)).toBeNull();
  });

  it('stays quiet while the counts are loading', () => {
    expect(explainEmptyPeriod(null, true)).toBeNull();
  });
});
