// A rebuilt part sold at the counter (sparx persona issue 061). The sparx
// console's copy of this file pins the same rule; this one adds how a core
// deposit sits beside a made-to-order deposit, which only this console sells.
//
// The till took neither the core deposit nor the "old part first" choice, so a
// walk-in buying a rebuilt part paid list for it and no core was ever owed. These
// pin the three things that go wrong silently if any piece of this slips: the
// line posted to the order spine, the total the till asks for, and what is
// handed over on the spot.

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  CORE_DEPOSITS_ROW,
  coreDepositOnly,
  coreOfferFrom,
  corePayLabel,
  handedOverNow,
  lineCoreDeposit,
  saleItem,
  saleTotals,
} from './sale-core';
import { depositDue } from './sale-made-to-order';
import type { SaleLine } from './sale-data';

function line(over: Partial<SaleLine> = {}): SaleLine {
  return {
    id: 'l_1',
    name: 'Rebuilt injector · 6.7L',
    quantity: 1,
    price: '400.00',
    sku: 'INJ-67',
    productId: 'p1',
    variantId: 'v1',
    orderAheadDays: null,
    priceTouched: false,
    ...over,
  };
}

const DEPOSIT = { depositCents: 15000, firstOffered: true };
const DEPOSIT_ONLY = { depositCents: 15000, firstOffered: false };

describe('coreOfferFrom', () => {
  it('reads the deposit and the choice off a catalog version', () => {
    expect(coreOfferFrom({ coreChargeCents: 15000, coreFirstOffered: true })).toEqual(DEPOSIT);
  });

  it('is nothing on a version that takes no core', () => {
    expect(coreOfferFrom({ coreChargeCents: null, coreFirstOffered: false })).toBeUndefined();
  });

  it('treats a zero deposit as no deposit, as the order spine does', () => {
    // `coreCharge` must be more than $0 on the server. A zero carried through
    // would fail the whole sale on a part that takes no core at all.
    expect(coreOfferFrom({ coreChargeCents: 0, coreFirstOffered: true })).toBeUndefined();
  });
});

describe('saleItem', () => {
  it('posts the deposit on a line that pays it, in whole dollars', () => {
    expect(saleItem(line({ core: DEPOSIT, coreFirst: false }))).toEqual({
      sku: 'INJ-67',
      name: 'Rebuilt injector · 6.7L',
      quantity: 1,
      unitPrice: 400,
      productId: 'p1',
      variantId: 'v1',
      coreCharge: 150,
    });
  });

  it('pays the deposit by default', () => {
    // A line added off the list before anybody touches the choice.
    expect(saleItem(line({ core: DEPOSIT })).coreCharge).toBe(150);
  });

  it('posts the old part first and NO deposit when that was chosen', () => {
    const item = saleItem(line({ core: DEPOSIT, coreFirst: true }));
    expect(item.coreFirst).toBe(true);
    // Never both: the server refuses it, and it would take a deposit from
    // somebody promised there would not be one.
    expect(item).not.toHaveProperty('coreCharge');
  });

  it('takes the deposit when the version does not offer the old part first', () => {
    // A choice that is not on offer is never honored, even if the line says so.
    const item = saleItem(line({ core: DEPOSIT_ONLY, coreFirst: true }));
    expect(item.coreCharge).toBe(150);
    expect(item).not.toHaveProperty('coreFirst');
  });

  it('carries no core at all on a line without one', () => {
    const item = saleItem(line());
    expect(item).not.toHaveProperty('coreCharge');
    expect(item).not.toHaveProperty('coreFirst');
  });

  it('leaves a hand-typed line unlinked', () => {
    const item = saleItem(
      line({ name: 'Diagnosis', productId: null, variantId: null, price: '95.00' })
    );
    expect(item).toEqual({ sku: 'INJ-67', name: 'Diagnosis', quantity: 1, unitPrice: 95 });
  });
});

describe('saleTotals', () => {
  it('adds the deposits to the total, on their own row', () => {
    // Two injectors at $400 with a $150 deposit each, and an hour of labor.
    const totals = saleTotals([
      line({ quantity: 2, core: DEPOSIT }),
      line({ id: 'l_2', name: 'Fitting', price: '120.00', productId: null, variantId: null }),
    ]);
    expect(totals).toEqual({ goods: 920, coreDeposits: 300, total: 1220 });
  });

  it('takes no deposit on a part whose old part comes first', () => {
    const totals = saleTotals([line({ core: DEPOSIT, coreFirst: true })]);
    expect(totals).toEqual({ goods: 400, coreDeposits: 0, total: 400 });
  });

  it('is the lines alone when nothing takes a core', () => {
    expect(saleTotals([line(), line({ id: 'l_2', price: '19.99', quantity: 3 })])).toEqual({
      goods: 459.97,
      coreDeposits: 0,
      total: 459.97,
    });
  });

  it('counts a half-typed price as nothing rather than as NaN', () => {
    expect(saleTotals([line({ price: '4.', core: DEPOSIT })]).total).toBe(154);
    expect(saleTotals([line({ price: 'abc' })]).total).toBe(0);
  });

  it('scales the deposit with how many', () => {
    expect(lineCoreDeposit(line({ quantity: 3, core: DEPOSIT }))).toBe(450);
  });
});

describe('depositDue', () => {
  it('still offers the whole total when nothing is made to order', () => {
    // Null sends the till to the total, which already holds the deposits.
    expect(depositDue([line({ core: DEPOSIT })])).toBeNull();
  });

  it('asks for the core deposit on top of a made-to-order deposit', () => {
    // A $40 deposit on a $100 made-to-order piece, and a rebuilt part paid in
    // full with its $150 core deposit: $40 + $400 + $150.
    expect(
      depositDue([
        line({
          id: 'l_2',
          name: 'Custom bracket',
          price: '100.00',
          orderAheadDays: 5,
          deposit: { type: 'amount', amountCents: 4000 },
        }),
        line({ core: DEPOSIT }),
      ])
    ).toBe(590);
  });

  it('asks for no core deposit on a part whose old part comes first', () => {
    expect(
      depositDue([
        line({
          id: 'l_2',
          price: '100.00',
          orderAheadDays: 5,
          deposit: { type: 'amount', amountCents: 4000 },
        }),
        line({ core: DEPOSIT, coreFirst: true }),
      ])
    ).toBe(440);
  });
});

describe('handedOverNow', () => {
  it('hands over everything except a part held for its old part', () => {
    // The order spine refuses to record a held part as handed over, and that
    // refusal would read as the whole sale failing.
    expect(
      handedOverNow([
        { id: 'i1', quantity: 2, coreFirst: false },
        { id: 'i2', quantity: 1, coreFirst: true },
        { id: 'i3', quantity: 1, coreFirst: false },
      ])
    ).toEqual([
      { orderItemId: 'i1', quantity: 2 },
      { orderItemId: 'i3', quantity: 1 },
    ]);
  });

  it('hands over nothing when every part waits', () => {
    expect(handedOverNow([{ id: 'i1', quantity: 1, coreFirst: true }])).toEqual([]);
  });
});

describe('the words', () => {
  it('names the deposit the way the website does', () => {
    expect(corePayLabel(15000, 1, 'USD')).toBe('Pay the $150.00 core deposit now');
    expect(corePayLabel(15000, 2, 'USD')).toBe('Pay the $150.00 core deposit on each one now');
    expect(CORE_DEPOSITS_ROW).toBe('Refundable core deposits');
  });

  it('says the deposit is paid back when there is no choice to make', () => {
    expect(coreDepositOnly(15000, 1, 'USD')).toBe(
      'Plus the $150.00 refundable core deposit, paid back when their old part comes back.'
    );
  });
});

/* ── The pane actually uses it ───────────────────────────────────────────── */

function repoRoot(): string {
  let dir = dirname(fileURLToPath(import.meta.url));
  for (let i = 0; i < 12; i += 1) {
    try {
      readFileSync(join(dir, 'pnpm-workspace.yaml'));
      return dir;
    } catch {
      dir = dirname(dir);
    }
  }
  throw new Error('pnpm-workspace.yaml not found above this test');
}

describe('the till', () => {
  const read = (file: string) =>
    readFileSync(join(repoRoot(), 'piggles/apps/workbench/surfaces/commerce', file), 'utf8');

  it('posts every line through saleItem', () => {
    expect(read('sale-data.ts')).toContain('items: input.lines.map(saleItem)');
  });

  it('hands over only what is not waiting for its old part', () => {
    expect(read('sale-data.ts')).toContain('handedOverNow(order.items ?? [])');
  });

  it('asks for the total WITH the deposits', () => {
    expect(read('sale-lines.tsx')).toContain('return saleTotals(lines).total;');
    expect(read('sale-detail.tsx')).toContain('salesTotal(lines)');
  });

  it('adds the core deposit into what a made-to-order sale asks for', () => {
    expect(read('sale-made-to-order.ts')).toContain('asked += lineCoreDeposit(line);');
  });

  it('carries the core onto a line picked off the list', () => {
    expect(read('sale-detail.tsx')).toContain('core: sellable.core');
  });
});
