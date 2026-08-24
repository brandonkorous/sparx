import { describe, expect, it } from 'vitest';

import {
  NO_RULE,
  depositForLine,
  deferredForLine,
  isMadeToOrder,
  localDayBounds,
  noticeDays,
  readyOnDate,
  remainingToday,
  splitDue,
  type MadeToOrderLine,
} from './made-to-order';

const cake = (over: Partial<MadeToOrderLine['rule']> = {}): MadeToOrderLine['rule'] => ({
  ...NO_RULE,
  ...over,
});

const line = (
  subtotalCents: number,
  quantity: number,
  rule: MadeToOrderLine['rule']
): MadeToOrderLine => ({ subtotalCents, quantity, rule });

describe('isMadeToOrder', () => {
  it('is silent about an ordinary product', () => {
    expect(isMadeToOrder(NO_RULE)).toBe(false);
  });

  it('is true for any one of the three rules on its own', () => {
    expect(isMadeToOrder(cake({ orderAheadDays: 5 }))).toBe(true);
    expect(isMadeToOrder(cake({ depositType: 'amount', depositAmountCents: 3000 }))).toBe(true);
    expect(isMadeToOrder(cake({ dailyLimit: 24 }))).toBe(true);
  });
});

describe('depositForLine', () => {
  it('takes a fixed amount per unit', () => {
    const rule = cake({ depositType: 'amount', depositAmountCents: 3000 });
    expect(depositForLine(line(12000, 2, rule))).toBe(6000);
  });

  it('takes a percentage of the line', () => {
    const rule = cake({ depositType: 'percent', depositPercent: 25 });
    expect(depositForLine(line(12000, 2, rule))).toBe(3000);
  });

  it('never asks for more than the line is worth', () => {
    const rule = cake({ depositType: 'amount', depositAmountCents: 3000 });
    expect(depositForLine(line(2000, 1, rule))).toBe(2000);
  });

  it('asks for all of an ordinary line', () => {
    expect(depositForLine(line(2000, 1, NO_RULE))).toBe(2000);
  });
});

describe('deferredForLine', () => {
  it('defers nothing on an ordinary line', () => {
    expect(deferredForLine(line(2000, 1, NO_RULE))).toBe(0);
  });

  it('defers the rest of a deposit line', () => {
    const rule = cake({ depositType: 'amount', depositAmountCents: 3000 });
    expect(deferredForLine(line(12000, 1, rule))).toBe(9000);
  });
});

describe('splitDue', () => {
  const deposit = cake({ depositType: 'amount', depositAmountCents: 3000 });

  it('leaves an ordinary basket entirely due now', () => {
    const split = splitDue([line(2000, 1, NO_RULE)], 2200);
    expect(split).toEqual({ dueNowCents: 2200, balanceCents: 0, depositCents: 0 });
  });

  it('takes the deposit plus everything that is not deferred', () => {
    // A $120 cake at $30 deposit, plus $8 delivery and $9.60 tax.
    const split = splitDue([line(12000, 1, deposit)], 13760);
    expect(split.depositCents).toBe(3000);
    expect(split.balanceCents).toBe(9000);
    expect(split.dueNowCents).toBe(4760);
  });

  it('charges the ordinary line in full alongside a deposit line', () => {
    const split = splitDue([line(12000, 1, deposit), line(500, 1, NO_RULE)], 12500);
    expect(split.balanceCents).toBe(9000);
    expect(split.dueNowCents).toBe(3500);
  });

  it('never collects less than the deposits, however the discounts fall', () => {
    // A discount deep enough that the deferral would otherwise eat the deposit.
    const split = splitDue([line(12000, 1, deposit)], 3500);
    expect(split.dueNowCents).toBeGreaterThanOrEqual(split.depositCents);
    expect(split.balanceCents).toBe(500);
  });
});

describe('noticeDays', () => {
  it('is null when nothing asks for notice', () => {
    expect(noticeDays([line(2000, 1, NO_RULE)])).toBeNull();
  });

  it('takes the longest, not the sum — things are made alongside each other', () => {
    const five = cake({ orderAheadDays: 5 });
    const three = cake({ orderAheadDays: 3 });
    expect(noticeDays([line(1, 1, five), line(1, 1, three)])).toBe(5);
  });
});

describe('readyOnDate', () => {
  it('is null when nothing asked, rather than today', () => {
    expect(readyOnDate(new Date('2026-08-24T12:00:00Z'), null, 'America/Denver')).toBeNull();
  });

  it('counts days in the shop zone, not in UTC', () => {
    // 11:30pm on the 24th in Denver is already the 25th in UTC. Five days'
    // notice from a Monday evening is the following Saturday for the baker,
    // and answering Sunday would be a day she did not agree to.
    const lateMonday = new Date('2026-08-25T05:30:00Z');
    expect(readyOnDate(lateMonday, 5, 'America/Denver')).toBe('2026-08-29');
    expect(readyOnDate(lateMonday, 5, 'UTC')).toBe('2026-08-30');
  });

  it('rolls across a month end', () => {
    expect(readyOnDate(new Date('2026-08-30T15:00:00Z'), 5, 'UTC')).toBe('2026-09-04');
  });
});

describe('localDayBounds', () => {
  it('brackets the local calendar day, not the UTC one', () => {
    const lateMonday = new Date('2026-08-25T05:30:00Z');
    const { startUtc, endUtc } = localDayBounds(lateMonday, 'America/Denver');
    expect(startUtc.toISOString()).toBe('2026-08-24T06:00:00.000Z');
    expect(endUtc.toISOString()).toBe('2026-08-25T06:00:00.000Z');
    expect(lateMonday >= startUtc && lateMonday < endUtc).toBe(true);
  });
});

describe('remainingToday', () => {
  it('is null when there is no ceiling — not zero, and not unlimited-looking', () => {
    expect(remainingToday(null, 40)).toBeNull();
  });

  it('counts down and stops at none left', () => {
    expect(remainingToday(24, 20)).toBe(4);
    expect(remainingToday(24, 24)).toBe(0);
    expect(remainingToday(24, 30)).toBe(0);
  });
});
