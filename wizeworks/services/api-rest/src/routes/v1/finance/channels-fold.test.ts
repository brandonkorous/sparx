import { describe, expect, it } from 'vitest';
import { channelKey, foldChannels, owedOn, type FoldableOrder } from './channels-fold.js';

function order(over: Partial<FoldableOrder> = {}): FoldableOrder {
  return {
    channel: 'storefront',
    source: null,
    total: 100,
    amountPaid: 100,
    refundTotal: 0,
    ...over,
  };
}

describe('what one order is still owed', () => {
  it('is nothing when it was paid in full', () => {
    expect(owedOn(order({ total: 170, amountPaid: 170 }))).toBe(0);
  });

  it('is the whole total when nobody has paid', () => {
    expect(owedOn(order({ total: 170, amountPaid: 0 }))).toBe(170);
  });

  it('is nothing when the money came back', () => {
    // A refunded order: paid nothing, refunded everything. Not a debt.
    expect(owedOn(order({ total: 170, amountPaid: 0, refundTotal: 170 }))).toBe(0);
  });

  it('is what is left after a part payment and a part refund', () => {
    expect(owedOn(order({ total: 147, amountPaid: 105, refundTotal: 42 }))).toBe(0);
    expect(owedOn(order({ total: 200, amountPaid: 100, refundTotal: 42 }))).toBe(58);
  });

  it('never goes below zero, so an overpayment cannot cancel a real debt', () => {
    const overpaid = order({ total: 100, amountPaid: 150 });
    const unpaid = order({ total: 100, amountPaid: 0 });
    expect(owedOn(overpaid)).toBe(0);
    // Netted on the total this pair would read "$50 owed". They are two
    // separate facts and the debt is $100.
    const { totals } = foldChannels([overpaid, unpaid]);
    expect(totals.owed).toBe(100);
  });
});

describe('folding orders into channel rows', () => {
  it('keeps each marketplace apart but folds the native channels whole', () => {
    expect(channelKey('marketplace', 'etsy')).toBe('etsy');
    expect(channelKey('marketplace', 'amazon')).toBe('amazon');
    expect(channelKey('marketplace', null)).toBe('marketplace');
    expect(channelKey('storefront', null)).toBe('storefront');
    expect(channelKey(null, null)).toBe('other');
  });

  it('sorts by money actually received, biggest first', () => {
    const { rows } = foldChannels([
      order({ channel: 'admin', total: 500, amountPaid: 10 }),
      order({ channel: 'storefront', total: 20, amountPaid: 20 }),
    ]);
    expect(rows.map((r) => r.key)).toEqual(['storefront', 'admin']);
  });

  it('counts an order once per channel', () => {
    const { rows, totals } = foldChannels([
      order({ channel: 'storefront' }),
      order({ channel: 'storefront' }),
      order({ channel: 'admin' }),
    ]);
    expect(rows.find((r) => r.key === 'storefront')?.orders).toBe(2);
    expect(totals.orders).toBe(3);
  });
});

describe('the invariant the whole screen rests on', () => {
  // Sales − Refunds − Still owed = Received. The pane prints all four side by
  // side; if they stop adding up, the reader is left guessing at the gap, which
  // is exactly the state this replaced.
  const closes = (r: { gross: number; refunds: number; owed: number; net: number }): void => {
    expect(Number((r.gross - r.refunds - r.owed).toFixed(2))).toBe(r.net);
  };

  it('closes on the shop that found the defect', () => {
    // Juniper Row, 90 days: 11 website orders, seven of them never paid for,
    // one refunded outright and one refunded in part.
    const website: FoldableOrder[] = [
      order({ total: 1576.5, amountPaid: 0 }), // the seven unpaid, summed
      order({ total: 170, amountPaid: 0, refundTotal: 170 }),
      order({ total: 147, amountPaid: 105, refundTotal: 42 }),
      order({ total: 247, amountPaid: 220 }),
    ];
    const { rows, totals } = foldChannels(website);
    expect(totals.gross).toBe(2140.5);
    expect(totals.refunds).toBe(212);
    expect(totals.owed).toBe(1603.5);
    expect(totals.net).toBe(325);
    closes(totals);
    for (const row of rows) closes(row);
  });

  it('closes when everything is paid on the spot', () => {
    const { rows, totals } = foldChannels([
      order({ channel: 'pos', total: 96, amountPaid: 96 }),
      order({ channel: 'pos', total: 114, amountPaid: 114 }),
    ]);
    expect(totals.owed).toBe(0);
    expect(totals.refunds).toBe(0);
    closes(totals);
    for (const row of rows) closes(row);
  });

  it('closes on every row of a mixed set, not just the total', () => {
    const { rows, totals } = foldChannels([
      order({ channel: 'storefront', total: 200, amountPaid: 0 }),
      order({ channel: 'storefront', total: 100, amountPaid: 100 }),
      order({ channel: 'b2b_portal', total: 900, amountPaid: 300, refundTotal: 50 }),
      order({ channel: 'marketplace', source: 'etsy', total: 60, amountPaid: 60 }),
      order({
        channel: 'marketplace',
        source: 'amazon',
        total: 40,
        amountPaid: 0,
        refundTotal: 40,
      }),
    ]);
    expect(rows).toHaveLength(4);
    for (const row of rows) closes(row);
    closes(totals);
  });

  it('closes on decimals that do not divide cleanly', () => {
    // Thirds of a cent are where a running total drifts away from its parts.
    const { rows, totals } = foldChannels([
      order({ total: 33.33, amountPaid: 11.11 }),
      order({ total: 66.67, amountPaid: 0.01, refundTotal: 33.33 }),
    ]);
    for (const row of rows) closes(row);
    closes(totals);
  });

  it('reads a Decimal the same as a number', () => {
    // Prisma hands back Decimal objects, not numbers. A fold that stringified
    // them would concatenate instead of adding.
    const asDecimal = { toString: () => '10.50', valueOf: () => 10.5 } as unknown as number;
    const { totals } = foldChannels([order({ total: asDecimal, amountPaid: asDecimal })]);
    expect(totals.gross).toBe(10.5);
    expect(totals.net).toBe(10.5);
  });

  it('treats a missing amount as zero rather than as a hole', () => {
    const { totals } = foldChannels([order({ total: 80, amountPaid: null, refundTotal: null })]);
    expect(totals.net).toBe(0);
    expect(totals.owed).toBe(80);
    closes(totals);
  });
});
