import { describe, expect, it } from 'vitest';
import { bucketTone, lateness, type LatenessInput } from './receivables-words';

function invoice(over: Partial<LatenessInput> = {}): LatenessInput {
  return { dueAt: '2026-09-08T12:00:00.000Z', overdueDays: 9, bucket: 'd1_30', ...over };
}

describe('how late an invoice is', () => {
  it('counts the days once it is past its date', () => {
    expect(lateness(invoice({ overdueDays: 9 })).label).toBe('9 days late');
  });

  it('reads differently at one day than at two', () => {
    // The property a hand-written expectation cannot fake: the noun itself has
    // to change. "1 days late" passes any test that only looks for the number.
    const one = lateness(invoice({ overdueDays: 1 })).label;
    const two = lateness(invoice({ overdueDays: 2 })).label;
    expect(one).toBe('1 day late');
    expect(one.replace(/\d+/g, 'N')).not.toBe(two.replace(/\d+/g, 'N'));
  });

  it('says it is not yet due when the date has not arrived', () => {
    const l = lateness(invoice({ dueAt: '2026-09-22T12:00:00.000Z', overdueDays: 0 }));
    expect(l).toEqual({ label: 'Not yet due', tone: 'info' });
  });

  it('will not call an invoice with no date "not yet due"', () => {
    // The whole reason this module exists. `overdueDays` is 0 for an invoice
    // that is not yet due AND for one that has no agreed date at all, so the
    // number cannot tell them apart. Told that a debt with no deadline is "not
    // yet due", she is told the money is fine when nobody has ever said when it
    // stops being fine — and it can never turn red, so she will never be told
    // otherwise.
    const l = lateness(invoice({ dueAt: null, overdueDays: 0 }));
    expect(l.label).not.toBe('Not yet due');
    expect(l).toEqual({ label: 'No date agreed', tone: 'warning' });
  });

  it('keeps the no-date warning even when the bucket says everything is current', () => {
    const l = lateness(invoice({ dueAt: null, overdueDays: 0, bucket: 'current' }));
    expect(l.tone).toBe('warning');
  });

  it('wears the color of its aging bucket once it is late', () => {
    expect(lateness(invoice({ overdueDays: 9, bucket: 'd1_30' })).tone).toBe('warning');
    expect(lateness(invoice({ overdueDays: 45, bucket: 'd31_60' })).tone).toBe('error');
    expect(lateness(invoice({ overdueDays: 200, bucket: 'd90_plus' })).tone).toBe('error');
  });
});

describe('the color a bucket wears', () => {
  it('never paints a late bucket the same as a current one', () => {
    // Two badges that mean different things must not render the same color.
    const current = bucketTone('current');
    for (const key of ['d1_30', 'd31_60', 'd61_90', 'd90_plus'] as const) {
      expect(bucketTone(key)).not.toBe(current);
    }
  });

  it('gets louder as the debt gets older', () => {
    expect(bucketTone('current')).toBe('info');
    expect(bucketTone('d1_30')).toBe('warning');
    expect(bucketTone('d61_90')).toBe('error');
  });
});
