// A line with no deposit never offers to keep one, and never prints $0.00 (057).

import { describe, expect, it } from 'vitest';

import type { CoreLine, CoreOwed } from './cores-data';
import {
  coreBadges,
  coreMoves,
  coreSummary,
  coresSummary,
  depositBackText,
  moveLabel,
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
