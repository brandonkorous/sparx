// A LINE WITH NO DEPOSIT NEVER OFFERS TO KEEP ONE, AND NEVER PRINTS "$0.00".
//
// A rebuilt part bought by sending the old part first holds no money (sparx
// persona issue 057). The server refuses "keep the deposit" on it, so offering
// the button is offering an error; and a "Deposit back" of $0.00 on the Cores
// owed list reads as a deposit of nothing owed back, a measurement nobody took.
// The order pane and the list read the same functions, so they are tested here
// once for both.

import { describe, expect, it } from 'vitest';

import type { CoreLine, CoreOwed } from './cores-data';
import {
  coreBadges,
  coreMoves,
  coreSummary,
  coresSummary,
  depositBackText,
  moveLabel,
  receiveCoreWords,
} from './core-line-words';
import type { OrderItem } from './data';

function core(over: Partial<CoreLine>): CoreLine {
  return {
    orderItemId: 'line-1',
    name: 'Bosch injector',
    currency: 'USD',
    customerName: 'Doty',
    quantity: 1,
    depositCents: 15000,
    coreFirst: false,
    owed: 1,
    outstanding: 1,
    waiting: 0,
    released: false,
    ...over,
  };
}

function owedRow(over: Partial<CoreOwed>): CoreOwed {
  return {
    orderItemId: 'line-1',
    orderId: 'order-1',
    orderNumber: 'O-1',
    placedAt: '2026-09-01T00:00:00Z',
    customerId: 'c',
    customerName: 'Doty',
    companyId: null,
    companyName: null,
    sku: '0986435621',
    name: 'Bosch injector',
    quantity: 1,
    coreChargeCents: 15000,
    coreFirst: false,
    waitingToShip: 0,
    holdReleasedAt: null,
    coresOwed: 1,
    coresReturned: 0,
    coresKept: 0,
    owedCents: 15000,
    openInvoice: null,
    daysOut: 3,
    currency: 'USD',
    ...over,
  };
}

describe('the moves a core offers', () => {
  it('offers both moves on a deposit line still owed', () => {
    expect(coreMoves(core({}))).toEqual(['receive', 'keep']);
    expect(moveLabel(core({}), 'receive')).toBe('Core came back');
  });

  it('never offers to keep a deposit on a send-first line', () => {
    const first = core({ coreFirst: true, depositCents: 0, waiting: 1 });
    expect(coreMoves(first)).toEqual(['receive', 'release']);
    expect(moveLabel(first, 'receive')).toBe('Old part arrived');
  });

  it('stops offering "ship without waiting" once it was chosen', () => {
    const released = core({ coreFirst: true, depositCents: 0, waiting: 0, released: true });
    expect(coreMoves(released)).toEqual(['receive']);
    expect(coreBadges(released).map((badge) => badge.label)).toEqual([
      'Not waiting for the old part',
      '1 old part still to come',
    ]);
  });

  it('says a send-first part waits for its old part', () => {
    expect(coreBadges(core({ coreFirst: true, depositCents: 0, waiting: 2, owed: 2 }))).toEqual([
      { label: '2 parts wait for the old part', tone: 'warning' },
    ]);
  });
});

describe('the Cores owed list', () => {
  it('prints no deposit amount for a send-first line', () => {
    expect(depositBackText(owedRow({ coreFirst: true, coreChargeCents: 0, owedCents: 0 }))).toBe(
      'No deposit'
    );
    expect(depositBackText(owedRow({}))).toBe('$150.00');
  });

  it('counts only deposits in the money it would give back', () => {
    const rows = [
      owedRow({}),
      owedRow({
        orderItemId: 'line-2',
        coreFirst: true,
        coreChargeCents: 0,
        owedCents: 0,
        waitingToShip: 1,
      }),
    ];
    expect(coresSummary(rows, 200)).toBe(
      "2 cores owed on 2 order lines. If every deposit came back, you would give back $150.00. 1 part is held until the customer's old part arrives."
    );
  });

  it('says nothing about money when every line was sent first', () => {
    const rows = [owedRow({ coreFirst: true, coreChargeCents: 0, owedCents: 0, waitingToShip: 1 })];
    expect(coresSummary(rows, 200)).not.toContain('give back');
  });
});

describe('cores on parts not handed over yet (sparx persona issue 184)', () => {
  it('does not say a core is owed for a part still on the shelf', () => {
    expect(coreBadges(core({ owed: 6, outstanding: 0 }))).toEqual([
      { label: '6 cores due once handed over', tone: 'info' },
    ]);
  });

  it('splits a part-sent line into owed now and due later', () => {
    expect(coreBadges(core({ owed: 6, outstanding: 2 }))).toEqual([
      { label: '2 cores still owed', tone: 'warning' },
      { label: '4 cores due once handed over', tone: 'info' },
    ]);
  });

  it('still says owed once every part is handed over', () => {
    expect(coreBadges(core({ owed: 2, outstanding: 2 }))).toEqual([
      { label: '2 cores still owed', tone: 'warning' },
    ]);
  });
});

describe('a deposit that sits on an unpaid invoice (sparx persona issue 183)', () => {
  const inv = { number: 'INV-000001', balanceCents: 67_800 };

  it('names the invoice in the list instead of an amount to give back', () => {
    expect(depositBackText(owedRow({ openInvoice: inv }))).toBe('$150.00 off INV-000001');
  });

  it('splits the list total into invoice credit and money given back', () => {
    const rows = [
      owedRow({ openInvoice: inv }),
      owedRow({ orderItemId: 'line-2', orderId: 'order-2' }),
    ];
    expect(coresSummary(rows, 200)).toBe(
      '2 cores owed on 2 order lines. If every deposit came back, $150.00 would come off open invoices and you would give back $150.00.'
    );
  });

  it('lets two lines on one order share what its invoice still owes', () => {
    const shared = { number: 'INV-000020', balanceCents: 20_000 };
    const rows = [
      owedRow({ openInvoice: shared }),
      owedRow({ orderItemId: 'line-2', openInvoice: shared }),
    ];
    expect(coresSummary(rows, 200)).toBe(
      '2 cores owed on 2 order lines. If every deposit came back, $200.00 would come off open invoices and you would give back $100.00.'
    );
  });

  it('takes the deposit off the invoice, and says so before the click', () => {
    const w = receiveCoreWords(core({}), { usable: 1, unusable: 0, invoice: inv });
    expect(w.description).toContain('off invoice INV-000001');
    expect(w.description).not.toContain('If this order');
    expect(w.submitLabel).toBe('Take $150.00 off INV-000001');
    expect(w.submitColor).toBe('module');
    expect(w.asksWhereMoneyGoes).toBe(false);
  });

  it('gives back only what the invoice cannot take', () => {
    const w = receiveCoreWords(core({ owed: 6 }), {
      usable: 6,
      unusable: 0,
      invoice: { number: 'INV-000003', balanceCents: 30_000 },
    });
    expect(w.submitLabel).toBe('Take $300.00 off INV-000003, give back $600.00');
    expect(w.submitColor).toBe('danger');
    expect(w.asksWhereMoneyGoes).toBe(true);
  });

  it('gives the deposit back when no invoice is open', () => {
    const w = receiveCoreWords(core({}), { usable: 1, unusable: 0, invoice: null });
    expect(w.submitLabel).toBe('Give back $150.00');
    expect(w.asksWhereMoneyGoes).toBe(true);
  });

  it('claims nothing until it knows whether an invoice is open', () => {
    const w = receiveCoreWords(core({}), { usable: 1, unusable: 0, invoice: undefined });
    expect(w.ready).toBe(false);
    expect(w.submitLabel).not.toContain('Give back');
  });
});

describe('the line under a send-first part', () => {
  const item = (over: Partial<OrderItem>): OrderItem =>
    ({
      quantity: 1,
      coreFirst: true,
      coreCharge: null,
      coresReturned: 0,
      coresKept: 0,
      coreHoldReleasedAt: null,
      ...over,
    }) as OrderItem;

  it('says the part is held while it is', () => {
    expect(coreSummary(item({}), 'USD')).toBe(
      'Old part first, no deposit. Held until the old part arrives.'
    );
  });

  it('stops saying "held" once the business chose not to wait', () => {
    expect(coreSummary(item({ coreHoldReleasedAt: '2026-10-01T21:30:00Z' }), 'USD')).toBe(
      'Old part first, no deposit. You chose not to wait for it.'
    );
  });
});

describe('the core dialog uses the invoice words (sparx persona issue 183)', () => {
  it('words itself from receiveCoreWords, never the old hedge', async () => {
    const { readFileSync } = await import('node:fs');
    const { fileURLToPath } = await import('node:url');
    const source = readFileSync(
      fileURLToPath(new URL('./order-cores.tsx', import.meta.url)),
      'utf8'
    );
    expect(source).toContain('receiveCoreWords(line, { usable: good, unusable: bad, invoice })');
    expect(source).not.toContain('If this order has an invoice still open');
  });
});
