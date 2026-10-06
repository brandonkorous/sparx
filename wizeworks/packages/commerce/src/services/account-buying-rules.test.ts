import { describe, expect, it } from 'vitest';

import type { TxClient } from '@wizeworks/db';

import {
  cartAccountRules,
  firstCartRefusal,
  goodsCents,
  isAllowedQuantity,
  minimumOrderSentence,
  nearestAllowed,
  orderingRefusal,
  quantityProblem,
  quantityRuleWords,
  resolveAccountOrdering,
  startingQuantity,
  quantityStep,
  type QuantityRule,
} from './account-buying-rules';

// What a trade account may order, and who on it may order (sparx persona
// issue 086). The /b2b page promised minimums, maximums, case packs, a minimum
// order value and view-only contacts; none of it was enforced anywhere a buyer
// ordered.

const WASATCH = { account: 'Wasatch Fleet Services', product: 'FPPF 90343' };
const CASE_OF_12: QuantityRule = { minimum: null, maximum: null, caseOf: 12 };

describe('quantity rules', () => {
  it('refuses 5 of a case-of-12 item rather than rounding it, and names what would work', () => {
    expect(isAllowedQuantity(CASE_OF_12, 5)).toBe(false);
    expect(quantityProblem(CASE_OF_12, 5, WASATCH)).toBe(
      'Wasatch Fleet Services buys FPPF 90343 in cases of 12. Choose 12, 24 or 36.'
    );
  });

  it('offers one amount either side of a quantity between two cases', () => {
    expect(nearestAllowed(CASE_OF_12, 30)).toEqual([24, 36]);
    expect(quantityProblem(CASE_OF_12, 30, WASATCH)).toMatch(/Choose 24 or 36\.$/);
  });

  it('accepts whole cases', () => {
    expect(quantityProblem(CASE_OF_12, 24, WASATCH)).toBeNull();
  });

  it('says what the basket already held when an add makes the line break the rule', () => {
    expect(quantityProblem(CASE_OF_12, 17, WASATCH, 12)).toBe(
      'Wasatch Fleet Services buys FPPF 90343 in cases of 12. You already have 12 in your cart, so that would make 17. Choose 12 or 24.'
    );
  });

  it('holds a minimum, and lists cases from it when there is a case pack', () => {
    const rule: QuantityRule = { minimum: 24, maximum: null, caseOf: 12 };
    expect(quantityProblem(rule, 12, WASATCH)).toBe(
      'Wasatch Fleet Services buys at least 24 of FPPF 90343 at a time, in cases of 12. Choose 24, 36 or 48.'
    );
    expect(quantityProblem({ minimum: 10, maximum: null, caseOf: null }, 3, WASATCH)).toBe(
      'Wasatch Fleet Services buys at least 10 of FPPF 90343 at a time. Choose 10 or more.'
    );
  });

  it('holds a maximum', () => {
    const rule: QuantityRule = { minimum: null, maximum: 96, caseOf: 12 };
    expect(quantityProblem(rule, 108, WASATCH)).toBe(
      'Wasatch Fleet Services can order up to 96 of FPPF 90343 at a time, in cases of 12. Choose 96 or fewer.'
    );
    expect(quantityProblem(rule, 96, WASATCH)).toBeNull();
  });

  it('says plainly when the rules leave no amount at all', () => {
    const rule: QuantityRule = { minimum: 30, maximum: 32, caseOf: 12 };
    expect(quantityProblem(rule, 30, WASATCH)).toMatch(/There is no amount of FPPF 90343/);
  });

  it('starts a quantity box at the smallest allowed amount and steps by the case', () => {
    expect(startingQuantity({ minimum: 24, maximum: null, caseOf: 12 })).toBe(24);
    expect(startingQuantity(CASE_OF_12)).toBe(12);
    expect(startingQuantity(null)).toBe(1);
    expect(quantityStep(CASE_OF_12)).toBe(12);
    expect(quantityStep(null)).toBe(1);
  });

  it('writes the rule as short phrases, without saying a minimum twice', () => {
    expect(quantityRuleWords({ minimum: 24, maximum: 96, caseOf: 12 })).toEqual([
      'Sold in cases of 12',
      'Minimum 24',
      'Up to 96 per order',
    ]);
    expect(quantityRuleWords({ minimum: 12, maximum: null, caseOf: 12 })).toEqual([
      'Sold in cases of 12',
    ]);
  });
});

describe('minimum order value', () => {
  it('counts goods after savings, before delivery and tax', () => {
    expect(goodsCents({ subtotalCents: 41_260, discountTotalCents: 3_500 })).toBe(37_760);
  });

  it('says how much more is needed', () => {
    expect(minimumOrderSentence(50_000, 38_760, 'USD')).toMatch(
      /^Add \$112\.40 more to reach your \$500\.00 minimum\./
    );
    expect(minimumOrderSentence(50_000, 50_000, 'USD')).toBeNull();
    expect(minimumOrderSentence(null, 10, 'USD')).toBeNull();
  });
});

describe('who may order', () => {
  it('lets a buyer and the main contact order', () => {
    expect(orderingRefusal('buyer', 'Wasatch', 'Renée')).toBeNull();
    expect(orderingRefusal('primary_contact', 'Wasatch', null)).toBeNull();
  });

  it('refuses a view-only contact and names who to ask', () => {
    expect(orderingRefusal('viewer', 'Wasatch', 'Renée')).toBe(
      'Your account lets you see invoices and orders. Ask Renée to place orders.'
    );
  });

  it('refuses an approver, who signs orders off rather than places them', () => {
    expect(orderingRefusal('approver', 'Wasatch', 'Renée')).toMatch(
      /you approve orders rather than place them/
    );
  });
});

// ─── The database half, against a fake that answers the `where` it is given ──

interface Contact {
  customerId: string;
  accountId: string;
  role: string;
  isActive: boolean;
  firstName: string;
}

function fakeTx(opts: {
  contacts: Contact[];
  primaryAccountId: string | null;
  overrides?: {
    variantId: string;
    minOrderQty: number | null;
    maxOrderQty: number | null;
    orderMultiple: number | null;
  }[];
  minOrderCents?: number;
}): TxClient {
  const match = (c: Contact, where: Record<string, unknown>) =>
    (where.customerId === undefined ||
      (typeof where.customerId === 'string'
        ? c.customerId === where.customerId
        : c.customerId !== (where.customerId as { not: string }).not)) &&
    c.accountId === where.accountId &&
    c.isActive === where.isActive &&
    (where.role === undefined || (where.role as { in: string[] }).in.includes(c.role));
  const shape = (c: Contact) => ({
    role: c.role,
    account: { companyName: 'Wasatch Fleet Services' },
    customer: { firstName: c.firstName, lastName: null },
  });
  return {
    b2bAccountContact: {
      findFirst: ({ where }: { where: Record<string, unknown> }) =>
        Promise.resolve(opts.contacts.filter((c) => match(c, where)).map(shape)[0] ?? null),
      findMany: ({ where }: { where: Record<string, unknown> }) =>
        Promise.resolve(opts.contacts.filter((c) => match(c, where)).map(shape)),
    },
    customer: { findFirst: () => Promise.resolve({ companyId: opts.primaryAccountId }) },
    b2bAccountProductOverride: {
      findMany: () => Promise.resolve(opts.overrides ?? []),
    },
    company: {
      findFirst: () =>
        Promise.resolve({
          pricingTierFk:
            opts.minOrderCents === undefined
              ? null
              : { minOrderCents: opts.minOrderCents, deletedAt: null },
        }),
    },
  } as unknown as TxClient;
}

const CONTACTS: Contact[] = [
  {
    customerId: 'renee',
    accountId: 'wasatch',
    role: 'primary_contact',
    isActive: true,
    firstName: 'Renée',
  },
  { customerId: 'ap', accountId: 'wasatch', role: 'viewer', isActive: true, firstName: 'Dale' },
];

describe('resolveAccountOrdering', () => {
  it('finds the main contact by name for a view-only contact', async () => {
    const ordering = await resolveAccountOrdering(
      fakeTx({ contacts: CONTACTS, primaryAccountId: 'wasatch' }),
      'ap',
      'wasatch'
    );
    expect(ordering?.canOrder).toBe(false);
    expect(ordering?.refusal).toBe(
      'Your account lets you see invoices and orders. Ask Renée to place orders.'
    );
  });

  it('asks nothing of a shopper with no account', async () => {
    await expect(
      resolveAccountOrdering(fakeTx({ contacts: [], primaryAccountId: null }), 'walk-in', null)
    ).resolves.toBeNull();
  });
});

describe('cartAccountRules', () => {
  const line = (id: string, variantId: string, quantity: number) => ({
    id,
    variantId,
    quantity,
    variant: { title: null, product: { title: 'FPPF 90343' } },
  });

  it('marks the line that breaks a case pack and the shortfall under the minimum', async () => {
    const rules = await cartAccountRules(
      fakeTx({
        contacts: CONTACTS,
        primaryAccountId: 'wasatch',
        overrides: [
          { variantId: 'filter', minOrderQty: null, maxOrderQty: null, orderMultiple: 12 },
        ],
        minOrderCents: 50_000,
      }),
      {
        customerId: 'renee',
        currency: 'USD',
        subtotalCents: 38_760,
        discountTotalCents: 0,
        items: [line('line-1', 'filter', 5), line('line-2', 'belt', 3)],
      }
    );
    expect(rules?.canOrder).toBe(true);
    expect(rules?.lines).toHaveLength(1);
    expect(rules?.lines[0]?.problem).toBe(
      'Wasatch Fleet Services buys FPPF 90343 in cases of 12. Choose 12, 24 or 36.'
    );
    expect(rules?.lines[0]?.words).toEqual(['Sold in cases of 12']);
    expect(rules?.shortfallCents).toBe(11_240);
    expect(firstCartRefusal(rules)).toBe(rules?.lines[0]?.problem);
  });

  it('is nothing at all for a guest basket', async () => {
    await expect(
      cartAccountRules(fakeTx({ contacts: CONTACTS, primaryAccountId: null }), {
        customerId: null,
        currency: 'USD',
        subtotalCents: 1,
        discountTotalCents: 0,
        items: [],
      })
    ).resolves.toBeNull();
  });
});
