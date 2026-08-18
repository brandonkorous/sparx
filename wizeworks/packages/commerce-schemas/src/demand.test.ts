import { describe, expect, it } from 'vitest';

import {
  backorderStatusFor,
  countsTowardAvailability,
  countsTowardValuation,
  daysUntilExpiry,
  dispositionEffect,
  draftSettlement,
  expiryBucket,
  fillQueue,
  preorderState,
  promiseSlipDays,
  resolvePromisedDate,
  shouldRenotify,
  SetReturnDispositionInput,
  UpsertPreorderWindowInput,
  CreateConsignmentSettlementInput,
  SetStockOwnershipInput,
  type PreorderWindowShape,
} from './demand';

const UUID_A = '11111111-1111-4111-8111-111111111111';
const UUID_B = '22222222-2222-4222-8222-222222222222';

describe('resolvePromisedDate', () => {
  it('refuses to invent a date when nothing has promised one', () => {
    expect(resolvePromisedDate({})).toEqual({ promisedAt: null, source: null });
  });

  it('does not fall back to a lead time with nothing to count from', () => {
    // The trap this whole function exists for: a measured lead time is a
    // duration, not a date, and quietly using "now" as the anchor turns a
    // forecast into a commitment.
    expect(resolvePromisedDate({ measuredLeadTimeDays: 14 })).toEqual({
      promisedAt: null,
      source: null,
    });
  });

  it('does not treat a zero or negative lead time as a promise', () => {
    const from = new Date('2026-03-01T00:00:00Z');
    expect(resolvePromisedDate({ measuredLeadTimeDays: 0, leadTimeFrom: from }).source).toBeNull();
    expect(resolvePromisedDate({ measuredLeadTimeDays: -3, leadTimeFrom: from }).source).toBeNull();
  });

  it('prefers a real purchase order arrival over a measured lead time', () => {
    const po = new Date('2026-03-20T00:00:00Z');
    const result = resolvePromisedDate({
      purchaseOrderArrivalAt: po,
      measuredLeadTimeDays: 30,
      leadTimeFrom: new Date('2026-03-01T00:00:00Z'),
    });
    expect(result).toEqual({ promisedAt: po, source: 'purchase_order' });
  });

  it('lets a person override both — they may have just phoned the supplier', () => {
    const manual = new Date('2026-04-02T00:00:00Z');
    const result = resolvePromisedDate({
      manualAt: manual,
      purchaseOrderArrivalAt: new Date('2026-03-20T00:00:00Z'),
      measuredLeadTimeDays: 10,
      leadTimeFrom: new Date('2026-03-01T00:00:00Z'),
    });
    expect(result).toEqual({ promisedAt: manual, source: 'manual' });
  });

  it('counts a measured lead time forward from the stated anchor', () => {
    const result = resolvePromisedDate({
      measuredLeadTimeDays: 12,
      leadTimeFrom: new Date('2026-03-01T00:00:00Z'),
    });
    expect(result.source).toBe('lead_time');
    expect(result.promisedAt?.toISOString()).toBe('2026-03-13T00:00:00.000Z');
  });

  it('rounds a fractional measured lead time UP', () => {
    // 4.2 days measured means some deliveries took five. Rounding down promises
    // a date a fifth of deliveries have never once hit.
    const result = resolvePromisedDate({
      measuredLeadTimeDays: 4.2,
      leadTimeFrom: new Date('2026-03-01T00:00:00Z'),
    });
    expect(result.promisedAt?.toISOString()).toBe('2026-03-06T00:00:00.000Z');
  });
});

describe('promise slippage', () => {
  it('treats the first date as always worth telling the customer', () => {
    expect(shouldRenotify(null, new Date('2026-03-10T00:00:00Z'))).toBe(true);
  });

  it('says nothing when there is still no date to tell them', () => {
    expect(shouldRenotify(null, null)).toBe(false);
  });

  it('stays quiet about a day of drift', () => {
    expect(shouldRenotify(new Date('2026-03-10T00:00:00Z'), new Date('2026-03-11T00:00:00Z'))).toBe(
      false
    );
  });

  it('speaks up once the date moves by the threshold', () => {
    expect(shouldRenotify(new Date('2026-03-10T00:00:00Z'), new Date('2026-03-13T00:00:00Z'))).toBe(
      true
    );
  });

  it('treats an EARLIER date as just as notable as a later one', () => {
    // Somebody planned around the old date. Arriving early can be as disruptive
    // as arriving late when there is nowhere to put it.
    expect(shouldRenotify(new Date('2026-03-20T00:00:00Z'), new Date('2026-03-14T00:00:00Z'))).toBe(
      true
    );
    expect(
      promiseSlipDays(new Date('2026-03-20T00:00:00Z'), new Date('2026-03-14T00:00:00Z'))
    ).toBe(-6);
  });

  it('reports no slip when either side is missing', () => {
    expect(promiseSlipDays(null, new Date())).toBe(0);
    expect(promiseSlipDays(new Date(), null)).toBe(0);
  });
});

describe('fillQueue', () => {
  const queue = [
    { id: 'a', outstanding: 10 },
    { id: 'b', outstanding: 10 },
    { id: 'c', outstanding: 10 },
  ];

  it('fills in strict order rather than spreading a delivery thin', () => {
    // 15 units across three customers who each want 10. Pro-rata would give
    // everyone 5 and ship nobody.
    const result = fillQueue(15, queue);
    expect(result.fills).toEqual([
      { id: 'a', quantity: 10 },
      { id: 'b', quantity: 5 },
    ]);
    expect(result.remaining).toBe(0);
    expect(result.stillOwed).toBe(15);
  });

  it('reports the surplus when the arrival covers everyone', () => {
    const result = fillQueue(40, queue);
    expect(result.fills).toHaveLength(3);
    expect(result.remaining).toBe(10);
    expect(result.stillOwed).toBe(0);
  });

  it('gives nothing away when nothing arrived', () => {
    const result = fillQueue(0, queue);
    expect(result.fills).toEqual([]);
    expect(result.stillOwed).toBe(30);
  });

  it('skips commitments that are already covered', () => {
    const result = fillQueue(5, [
      { id: 'a', outstanding: 0 },
      { id: 'b', outstanding: 5 },
    ]);
    expect(result.fills).toEqual([{ id: 'b', quantity: 5 }]);
  });

  it('never invents units from a fractional arrival', () => {
    const result = fillQueue(7.9, [{ id: 'a', outstanding: 10 }]);
    expect(result.fills).toEqual([{ id: 'a', quantity: 7 }]);
  });

  it('treats a negative arrival as nothing rather than as a debt', () => {
    const result = fillQueue(-5, queue);
    expect(result.fills).toEqual([]);
    expect(result.remaining).toBe(0);
  });
});

describe('backorderStatusFor', () => {
  it('names the three states', () => {
    expect(backorderStatusFor(10, 0)).toBe('open');
    expect(backorderStatusFor(10, 4)).toBe('partial');
    expect(backorderStatusFor(10, 10)).toBe('allocated');
  });
});

describe('preorderState', () => {
  const base: PreorderWindowShape = {
    status: 'open',
    startsAt: null,
    endsAt: null,
    isCapped: false,
    maxQuantity: 0,
    soldQuantity: 0,
  };
  const now = new Date('2026-06-15T12:00:00Z');

  it('renders an uncapped window with NO number rather than a fake one', () => {
    // "999999 left" on a storefront is the failure this null exists to prevent.
    expect(preorderState(base, now).remaining).toBeNull();
    expect(preorderState(base, now).isTakingOrders).toBe(true);
  });

  it('is not yet taking orders before it starts', () => {
    const state = preorderState({ ...base, startsAt: new Date('2026-07-01T00:00:00Z') }, now);
    expect(state).toMatchObject({
      isTakingOrders: false,
      effectiveStatus: 'scheduled',
      blockedBy: 'not_started',
    });
  });

  it('lets the DATES override a stale stored status', () => {
    const state = preorderState(
      { ...base, status: 'scheduled', startsAt: new Date('2026-06-01T00:00:00Z') },
      now
    );
    expect(state.effectiveStatus).toBe('open');
    expect(state.isTakingOrders).toBe(true);
  });

  it('closes once the window ends', () => {
    const state = preorderState({ ...base, endsAt: new Date('2026-06-10T00:00:00Z') }, now);
    expect(state).toMatchObject({ isTakingOrders: false, blockedBy: 'ended' });
  });

  it('sells out at the cap', () => {
    const state = preorderState(
      { ...base, isCapped: true, maxQuantity: 100, soldQuantity: 100 },
      now
    );
    expect(state).toMatchObject({ isTakingOrders: false, remaining: 0, blockedBy: 'sold_out' });
  });

  it('never reports negative headroom when a cap was overshot', () => {
    const state = preorderState(
      { ...base, isCapped: true, maxQuantity: 100, soldQuantity: 105 },
      now
    );
    expect(state.remaining).toBe(0);
  });

  it('stays shut when cancelled, whatever the dates say', () => {
    const state = preorderState({ ...base, status: 'cancelled' }, now);
    expect(state).toMatchObject({ isTakingOrders: false, blockedBy: 'cancelled' });
  });
});

describe('UpsertPreorderWindowInput', () => {
  it('refuses a cap of zero', () => {
    expect(UpsertPreorderWindowInput.safeParse({ isCapped: true, maxQuantity: 0 }).success).toBe(
      false
    );
  });

  it('refuses a window that closes before it opens', () => {
    const result = UpsertPreorderWindowInput.safeParse({
      startsAt: '2026-06-10T00:00:00Z',
      endsAt: '2026-06-01T00:00:00Z',
    });
    expect(result.success).toBe(false);
  });

  it('refuses an availability date earlier than the offer itself', () => {
    const result = UpsertPreorderWindowInput.safeParse({
      startsAt: '2026-06-10T00:00:00Z',
      availableAt: '2026-06-01T00:00:00Z',
    });
    expect(result.success).toBe(false);
  });

  it('accepts a window with no date at all — "to be confirmed" is honest', () => {
    expect(
      UpsertPreorderWindowInput.safeParse({ availabilityNote: 'Ships with the spring run' }).success
    ).toBe(true);
  });
});

describe('ownership', () => {
  it('keeps only owned stock on the balance sheet', () => {
    expect(countsTowardValuation('owned')).toBe(true);
    expect(countsTowardValuation('consignment')).toBe(false);
    expect(countsTowardValuation('customer_owned')).toBe(false);
    expect(countsTowardValuation('3pl_owned')).toBe(false);
  });

  it('treats an unstamped historic movement as owned for valuation', () => {
    // Null predates the axis. Every level that existed then WAS owned, so
    // counting it is recording history rather than assuming.
    expect(countsTowardValuation(null)).toBe(true);
  });

  it('keeps every ownership sellable — that is the whole point of consignment', () => {
    for (const o of ['owned', 'consignment', 'customer_owned', '3pl_owned', null]) {
      expect(countsTowardAvailability(o)).toBe(true);
    }
  });

  it('refuses two owners', () => {
    const result = SetStockOwnershipInput.safeParse({
      variantId: UUID_A,
      warehouseId: UUID_B,
      ownership: 'consignment',
      ownerSupplierId: UUID_A,
      ownerCustomerId: UUID_B,
    });
    expect(result.success).toBe(false);
  });

  it('refuses an external owner on stock you own', () => {
    const result = SetStockOwnershipInput.safeParse({
      variantId: UUID_A,
      warehouseId: UUID_B,
      ownership: 'owned',
      ownerSupplierId: UUID_A,
    });
    expect(result.success).toBe(false);
  });
});

describe('draftSettlement', () => {
  it('groups by item, location and agreed cost', () => {
    const draft = draftSettlement([
      { variantId: 'v1', warehouseId: 'w1', units: 3, unitCostCents: 500, movementId: 'm1' },
      { variantId: 'v1', warehouseId: 'w1', units: 2, unitCostCents: 500, movementId: 'm2' },
      { variantId: 'v1', warehouseId: 'w1', units: 4, unitCostCents: 600, movementId: 'm3' },
    ]);
    expect(draft.lines).toHaveLength(2);
    expect(draft.totalCents).toBe(5 * 500 + 4 * 600);
    expect(draft.unitsSold).toBe(9);
    expect(draft.lines[0]?.movementIds).toEqual(['m1', 'm2']);
  });

  it('does NOT collapse two agreed costs into a weighted average', () => {
    // A supplier checks a settlement against their own paperwork. A blended
    // unit cost matches nothing they hold and gets the whole document disputed.
    const draft = draftSettlement([
      { variantId: 'v1', warehouseId: 'w1', units: 1, unitCostCents: 400, movementId: 'm1' },
      { variantId: 'v1', warehouseId: 'w1', units: 1, unitCostCents: 800, movementId: 'm2' },
    ]);
    expect(draft.lines.map((l) => l.unitCostCents).sort()).toEqual([400, 800]);
  });

  it('reports uncosted sales instead of valuing them at nothing', () => {
    const draft = draftSettlement([
      { variantId: 'v1', warehouseId: 'w1', units: 2, unitCostCents: 500, movementId: 'm1' },
      { variantId: 'v1', warehouseId: 'w1', units: 7, unitCostCents: 0, movementId: 'm2' },
    ]);
    expect(draft.totalCents).toBe(1000);
    expect(draft.unitsSold).toBe(2);
    expect(draft.unpricedUnits).toBe(7);
    expect(draft.unpricedMovementIds).toEqual(['m2']);
  });

  it('reads a sale movement whether its units arrive signed or not', () => {
    const draft = draftSettlement([
      { variantId: 'v1', warehouseId: 'w1', units: -4, unitCostCents: 250, movementId: 'm1' },
    ]);
    expect(draft.unitsSold).toBe(4);
    expect(draft.totalCents).toBe(1000);
  });

  it('settles an empty period to zero, with no lines', () => {
    const draft = draftSettlement([]);
    expect(draft).toMatchObject({ lines: [], totalCents: 0, unitsSold: 0, unpricedUnits: 0 });
  });
});

describe('CreateConsignmentSettlementInput', () => {
  it('insists on exactly one counterparty', () => {
    const both = CreateConsignmentSettlementInput.safeParse({
      ownerType: 'supplier',
      supplierId: UUID_A,
      customerId: UUID_B,
      periodStart: '2026-01-01T00:00:00Z',
      periodEnd: '2026-02-01T00:00:00Z',
    });
    expect(both.success).toBe(false);

    const neither = CreateConsignmentSettlementInput.safeParse({
      ownerType: 'supplier',
      periodStart: '2026-01-01T00:00:00Z',
      periodEnd: '2026-02-01T00:00:00Z',
    });
    expect(neither.success).toBe(false);
  });

  it('refuses an inside-out period', () => {
    const result = CreateConsignmentSettlementInput.safeParse({
      ownerType: 'supplier',
      supplierId: UUID_A,
      periodStart: '2026-02-01T00:00:00Z',
      periodEnd: '2026-01-01T00:00:00Z',
    });
    expect(result.success).toBe(false);
  });
});

describe('dispositionEffect', () => {
  it('puts only a restock back on a sellable shelf', () => {
    expect(dispositionEffect('restock')).toEqual({
      addsStock: true,
      sellable: true,
      systemBinCode: 'DEFAULT',
      restockable: true,
    });
  });

  it('keeps quarantine and repair on hand but out of reach', () => {
    for (const d of ['quarantine', 'repair'] as const) {
      const effect = dispositionEffect(d);
      expect(effect.addsStock).toBe(true);
      expect(effect.sellable).toBe(false);
      expect(effect.restockable).toBe(false);
    }
    expect(dispositionEffect('quarantine').systemBinCode).toBe('QUARANTINE');
    expect(dispositionEffect('repair').systemBinCode).toBe('REPAIR');
  });

  it('does not re-admit scrapped goods to stock at all', () => {
    expect(dispositionEffect('scrap')).toEqual({
      addsStock: false,
      sellable: false,
      systemBinCode: null,
      restockable: false,
    });
  });

  it('demands a reason before writing off a customer return', () => {
    expect(
      SetReturnDispositionInput.safeParse({ inspectionId: UUID_A, disposition: 'scrap' }).success
    ).toBe(false);
    expect(
      SetReturnDispositionInput.safeParse({
        inspectionId: UUID_A,
        disposition: 'scrap',
        note: 'Cracked housing, no resale value',
      }).success
    ).toBe(true);
  });

  it('needs no reason for the reversible dispositions', () => {
    expect(
      SetReturnDispositionInput.safeParse({ inspectionId: UUID_A, disposition: 'restock' }).success
    ).toBe(true);
  });
});

describe('expiry', () => {
  const now = new Date('2026-06-15T00:00:00Z');

  it('separates undated stock from stock that expires late', () => {
    // A lot with no date is a data-entry problem, not a reassuring green row.
    expect(expiryBucket(null, now)).toBe('undated');
    expect(daysUntilExpiry(null, now)).toBeNull();
  });

  it('buckets by horizon', () => {
    expect(expiryBucket(new Date('2026-06-01T00:00:00Z'), now)).toBe('expired');
    expect(expiryBucket(new Date('2026-06-20T00:00:00Z'), now)).toBe('d30');
    expect(expiryBucket(new Date('2026-07-20T00:00:00Z'), now)).toBe('d60');
    expect(expiryBucket(new Date('2026-08-20T00:00:00Z'), now)).toBe('d90');
    expect(expiryBucket(new Date('2027-01-01T00:00:00Z'), now)).toBe('beyond');
  });

  it('treats the day of expiry as still inside the nearest horizon', () => {
    expect(expiryBucket(new Date('2026-06-15T00:00:00Z'), now)).toBe('d30');
    expect(daysUntilExpiry(new Date('2026-06-15T00:00:00Z'), now)).toBe(0);
  });

  it('counts past expiry as negative days', () => {
    expect(daysUntilExpiry(new Date('2026-06-10T00:00:00Z'), now)).toBe(-5);
  });
});
