import { describe, expect, it } from 'vitest';

import {
  MIN_SCORED_COMPONENTS,
  canSignOff,
  gradeFor,
  matchBillLine,
  resolveApprovalRule,
  resolvePurchasePrice,
  scoreSupplier,
} from './procurement';

describe('resolvePurchasePrice', () => {
  const ladder = [
    { minQuantity: 10, unitCostCents: 390 },
    { minQuantity: 50, unitCostCents: 360 },
    { minQuantity: 200, unitCostCents: 330 },
  ];

  it('uses the base price below the first break', () => {
    const r = resolvePurchasePrice(4, 410, ladder);
    expect(r.unitCostCents).toBe(410);
    expect(r.source).toBe('base');
    expect(r.appliedAtQuantity).toBeNull();
  });

  it('takes the largest break the quantity clears, not the cheapest in the ladder', () => {
    const r = resolvePurchasePrice(60, 410, ladder);
    expect(r.unitCostCents).toBe(360);
    expect(r.appliedAtQuantity).toBe(50);
  });

  it('applies exactly at the break quantity — a floor, not a threshold to exceed', () => {
    expect(resolvePurchasePrice(10, 410, ladder).unitCostCents).toBe(390);
  });

  it('volunteers the next break, which is the reason anyone reads a ladder', () => {
    const r = resolvePurchasePrice(45, 410, ladder);
    expect(r.unitCostCents).toBe(390);
    expect(r.nextBreakAtQuantity).toBe(50);
    expect(r.nextBreakUnitCostCents).toBe(360);
  });

  it('reports no next break at the top of the ladder', () => {
    const r = resolvePurchasePrice(500, 410, ladder);
    expect(r.unitCostCents).toBe(330);
    expect(r.nextBreakAtQuantity).toBeNull();
  });

  it('never substitutes a cheaper tier the order has not reached', () => {
    // A supplier may publish a MORE expensive break — a pallet surcharge, or a
    // mis-key. Quoting the cheaper tier below it would promise a price they
    // will not honour.
    const odd = [
      { minQuantity: 10, unitCostCents: 300 },
      { minQuantity: 20, unitCostCents: 350 },
    ];
    expect(resolvePurchasePrice(25, 410, odd).unitCostCents).toBe(350);
  });

  it('resolves an unsorted ladder the same way', () => {
    const shuffled = [ladder[2]!, ladder[0]!, ladder[1]!];
    expect(resolvePurchasePrice(60, 410, shuffled).unitCostCents).toBe(360);
  });

  it('falls back to the base price on an empty ladder', () => {
    expect(resolvePurchasePrice(1000, 410, []).unitCostCents).toBe(410);
  });
});

describe('scoreSupplier', () => {
  it('publishes NO score when only one component could be measured', () => {
    // The whole point: a letter grade standing on a single metric is the most
    // actionable-looking output the platform can produce, and it would be built
    // on nothing.
    const r = scoreSupplier({
      onTimeRate: 1,
      fillRate: null,
      priceVariancePct: null,
      damageRate: null,
    });
    expect(r.score).toBeNull();
    expect(r.grade).toBeNull();
    expect(r.scoredComponents).toBe(1);
    expect(r.scoredComponents).toBeLessThan(MIN_SCORED_COMPONENTS);
  });

  it('scores NULL, not zero, for a supplier nobody can measure at all', () => {
    const r = scoreSupplier({
      onTimeRate: null,
      fillRate: null,
      priceVariancePct: null,
      damageRate: null,
    });
    expect(r.score).toBeNull();
    expect(r.scoredComponents).toBe(0);
  });

  it('drops unmeasured components rather than zeroing or defaulting them', () => {
    // Two perfect measured components must read as 100, not as 50 diluted by
    // two absent ones.
    const r = scoreSupplier({
      onTimeRate: 1,
      fillRate: 1,
      priceVariancePct: null,
      damageRate: null,
    });
    expect(r.score).toBe(100);
    expect(r.grade).toBe('A');
    expect(r.scoredComponents).toBe(2);
  });

  it('does not penalise a supplier for invoicing BELOW the agreed price', () => {
    const under = scoreSupplier({
      onTimeRate: 1,
      fillRate: 1,
      priceVariancePct: -5,
      damageRate: 0,
    });
    const exact = scoreSupplier({
      onTimeRate: 1,
      fillRate: 1,
      priceVariancePct: 0,
      damageRate: 0,
    });
    expect(under.score).toBe(exact.score);
    expect(under.score).toBe(100);
  });

  it('zeroes the price component at a 10% overcharge', () => {
    const r = scoreSupplier({
      onTimeRate: 1,
      fillRate: 1,
      priceVariancePct: 10,
      damageRate: 0,
    });
    // 0.3 + 0.3 + 0.2 damage at full, price at zero → 80.
    expect(r.score).toBe(80);
    expect(r.scoredComponents).toBe(4);
  });

  it('grades on the published bands', () => {
    expect(gradeFor(100)).toBe('A');
    expect(gradeFor(90)).toBe('A');
    expect(gradeFor(89)).toBe('B');
    expect(gradeFor(75)).toBe('B');
    expect(gradeFor(60)).toBe('C');
    expect(gradeFor(59)).toBe('D');
    expect(gradeFor(0)).toBe('D');
  });

  it('renormalises weights so a partial scorecard is not dragged toward zero', () => {
    // Fill (0.3) perfect and price (0.2) perfect, nothing else known. Without
    // renormalisation this would be 50/100 on a total weight of 1.0.
    const r = scoreSupplier({
      onTimeRate: null,
      fillRate: 1,
      priceVariancePct: 0,
      damageRate: null,
    });
    expect(r.score).toBe(100);
  });
});

describe('resolveApprovalRule', () => {
  const order = { supplierId: 'sup-1', warehouseId: 'wh-1', totalCents: 2_000_000 };

  it('routes to the highest threshold the order clears, not the first match', () => {
    const rule = resolveApprovalRule(order, [
      {
        id: 'small',
        supplierId: null,
        warehouseId: null,
        minAmountCents: 50_000,
        sortOrder: 0,
        createdAt: '2026-01-01T00:00:00.000Z',
      },
      {
        id: 'big',
        supplierId: null,
        warehouseId: null,
        minAmountCents: 1_000_000,
        sortOrder: 0,
        createdAt: '2026-02-01T00:00:00.000Z',
      },
    ]);
    expect(rule?.id).toBe('big');
  });

  it('ignores a rule for another supplier', () => {
    const rule = resolveApprovalRule(order, [
      {
        id: 'other',
        supplierId: 'sup-2',
        warehouseId: null,
        minAmountCents: 0,
        sortOrder: 0,
        createdAt: '2026-01-01T00:00:00.000Z',
      },
    ]);
    expect(rule).toBeNull();
  });

  it('lets a location-specific rule match when the location agrees', () => {
    const rule = resolveApprovalRule(order, [
      {
        id: 'wh',
        supplierId: null,
        warehouseId: 'wh-1',
        minAmountCents: 0,
        sortOrder: 0,
        createdAt: '2026-01-01T00:00:00.000Z',
      },
    ]);
    expect(rule?.id).toBe('wh');
  });

  it('breaks a threshold tie on sortOrder, then on age — never arbitrarily', () => {
    const rules = [
      {
        id: 'late',
        supplierId: null,
        warehouseId: null,
        minAmountCents: 0,
        sortOrder: 5,
        createdAt: '2026-01-01T00:00:00.000Z',
      },
      {
        id: 'early',
        supplierId: null,
        warehouseId: null,
        minAmountCents: 0,
        sortOrder: 1,
        createdAt: '2026-03-01T00:00:00.000Z',
      },
    ];
    expect(resolveApprovalRule(order, rules)?.id).toBe('early');
    expect(resolveApprovalRule(order, [...rules].reverse())?.id).toBe('early');
  });

  it('holds nothing when no threshold is cleared', () => {
    const rule = resolveApprovalRule({ ...order, totalCents: 1000 }, [
      {
        id: 'big',
        supplierId: null,
        warehouseId: null,
        minAmountCents: 500_000,
        sortOrder: 0,
        createdAt: '2026-01-01T00:00:00.000Z',
      },
    ]);
    expect(rule).toBeNull();
  });
});

describe('matchBillLine', () => {
  it('passes a line that was ordered, received and billed identically', () => {
    const r = matchBillLine({
      purchaseOrderLineId: 'pol-1',
      billedQuantity: 10,
      billedUnitCostCents: 400,
      orderedQuantity: 10,
      orderedUnitCostCents: 400,
      receivedQuantity: 10,
    });
    expect(r.verdict).toBe('matched');
    expect(r.needsReview).toBe(false);
    expect(r.amountVarianceCents).toBe(0);
  });

  it('compares against RECEIVED, not ordered — the whole point of three-way', () => {
    // Ten ordered, eight arrived, ten billed. Matching against the order would
    // wave this through; the two missing units are the money.
    const r = matchBillLine({
      purchaseOrderLineId: 'pol-1',
      billedQuantity: 10,
      billedUnitCostCents: 400,
      orderedQuantity: 10,
      orderedUnitCostCents: 400,
      receivedQuantity: 8,
    });
    expect(r.verdict).toBe('over_billed');
    expect(r.quantityVarianceUnits).toBe(2);
    expect(r.amountVarianceCents).toBe(800);
    expect(r.needsReview).toBe(true);
  });

  it('flags a bill for goods that have not turned up at all', () => {
    const r = matchBillLine({
      purchaseOrderLineId: 'pol-1',
      billedQuantity: 10,
      billedUnitCostCents: 400,
      orderedQuantity: 10,
      orderedUnitCostCents: 400,
      receivedQuantity: 0,
    });
    expect(r.verdict).toBe('not_received');
    expect(r.needsReview).toBe(true);
  });

  it('catches the small price drift that repeats every month', () => {
    const r = matchBillLine({
      purchaseOrderLineId: 'pol-1',
      billedQuantity: 100,
      billedUnitCostCents: 412,
      orderedQuantity: 100,
      orderedUnitCostCents: 400,
      receivedQuantity: 100,
    });
    expect(r.verdict).toBe('price_higher');
    expect(r.priceVarianceCents).toBe(12);
    expect(r.amountVarianceCents).toBe(1200);
  });

  it('tolerates a one-cent rounding difference rather than crying wolf', () => {
    const r = matchBillLine({
      purchaseOrderLineId: 'pol-1',
      billedQuantity: 100,
      billedUnitCostCents: 401,
      orderedQuantity: 100,
      orderedUnitCostCents: 400,
      receivedQuantity: 100,
    });
    expect(r.verdict).toBe('matched');
    expect(r.needsReview).toBe(false);
  });

  it('reports an under-bill without blocking the payment', () => {
    // Juniper Row's PO-000001: 40 metres of linen, delivered in two drops of 38
    // and 2, and the supplier invoiced the second drop on its own. The invoice
    // is correct. Blocking it forces the owner either to sign off a variance
    // that never happened or to dispute a supplier who did nothing unusual.
    const r = matchBillLine({
      purchaseOrderLineId: 'pol-1',
      billedQuantity: 2,
      billedUnitCostCents: 1800,
      orderedQuantity: 40,
      orderedUnitCostCents: 1800,
      receivedQuantity: 40,
      alreadyBilledQuantity: 0,
    });
    expect(r.verdict).toBe('under_billed');
    expect(r.needsReview).toBe(false);
    // Nothing is wrongly charged, so nothing is at stake...
    expect(r.amountVarianceCents).toBe(0);
    // ...but the 38 metres still to be invoiced are worth saying out loud.
    expect(r.uninvoicedCents).toBe(38 * 1800);
  });

  it('catches the same delivery invoiced twice', () => {
    // The 38-metre drop, invoiced correctly and then invoiced again. Neither
    // invoice on its own exceeds the 40 that arrived, so nothing but the OTHER
    // invoices can tell the second one apart from the first.
    const duplicate = matchBillLine({
      purchaseOrderLineId: 'pol-1',
      billedQuantity: 38,
      billedUnitCostCents: 1800,
      orderedQuantity: 40,
      orderedUnitCostCents: 1800,
      receivedQuantity: 40,
      alreadyBilledQuantity: 38,
    });
    expect(duplicate.verdict).toBe('over_billed');
    expect(duplicate.quantityVarianceUnits).toBe(36);
    expect(duplicate.amountVarianceCents).toBe(36 * 1800);
    expect(duplicate.needsReview).toBe(true);

    // The same invoice with the other one not counted, which is how this used
    // to behave: it passes, unreviewed, and the shop pays for 76 metres of 40.
    const blind = matchBillLine({
      purchaseOrderLineId: 'pol-1',
      billedQuantity: 38,
      billedUnitCostCents: 1800,
      orderedQuantity: 40,
      orderedUnitCostCents: 1800,
      receivedQuantity: 40,
      alreadyBilledQuantity: 0,
    });
    expect(blind.needsReview).toBe(false);
  });

  it('reports an overcharge on a partial invoice rather than the shortfall', () => {
    // Two metres billed at $20.00 against an agreed $18.00, on a line where all
    // 40 arrived. The shortfall is expected; the $4.00 is the money. Testing
    // quantity first hid this, and once a shortfall stopped blocking, it would
    // have sailed through.
    const r = matchBillLine({
      purchaseOrderLineId: 'pol-1',
      billedQuantity: 2,
      billedUnitCostCents: 2000,
      orderedQuantity: 40,
      orderedUnitCostCents: 1800,
      receivedQuantity: 40,
      alreadyBilledQuantity: 0,
    });
    expect(r.verdict).toBe('price_higher');
    expect(r.priceVarianceCents).toBe(200);
    expect(r.needsReview).toBe(true);
    // Positive. Folding the 38 uninvoiced metres in here made this read as
    // $680.00 in the shop's favour, thanking a supplier for overcharging.
    expect(r.amountVarianceCents).toBe(400);
  });

  it('leaves nothing billable once other invoices have covered the delivery', () => {
    const r = matchBillLine({
      purchaseOrderLineId: 'pol-1',
      billedQuantity: 5,
      billedUnitCostCents: 1800,
      orderedQuantity: 40,
      orderedUnitCostCents: 1800,
      receivedQuantity: 40,
      alreadyBilledQuantity: 40,
    });
    expect(r.verdict).toBe('over_billed');
    expect(r.quantityVarianceUnits).toBe(5);
    expect(r.uninvoicedCents).toBe(0);
  });

  it('behaves exactly as before on a one-drop, one-invoice order', () => {
    // `alreadyBilledQuantity` is optional, and omitting it must change nothing.
    const r = matchBillLine({
      purchaseOrderLineId: 'pol-1',
      billedQuantity: 10,
      billedUnitCostCents: 400,
      orderedQuantity: 10,
      orderedUnitCostCents: 400,
      receivedQuantity: 8,
    });
    expect(r.verdict).toBe('over_billed');
    expect(r.quantityVarianceUnits).toBe(2);
    expect(r.amountVarianceCents).toBe(800);
  });

  it('calls out a line nobody ordered on its own terms', () => {
    const r = matchBillLine({
      purchaseOrderLineId: null,
      billedQuantity: 2,
      billedUnitCostCents: 4500,
      orderedQuantity: null,
      orderedUnitCostCents: null,
      receivedQuantity: null,
    });
    expect(r.verdict).toBe('unordered');
    expect(r.quantityVarianceUnits).toBeNull();
    expect(r.amountVarianceCents).toBe(9000);
    expect(r.needsReview).toBe(true);
  });

  it('does not double-count quantity and price on one line', () => {
    // Billed 12 at 420, agreed 400, received 10. The two extra units are worth
    // the AGREED 400 each; the overcharge applies to the 10 that arrived.
    const r = matchBillLine({
      purchaseOrderLineId: 'pol-1',
      billedQuantity: 12,
      billedUnitCostCents: 420,
      orderedQuantity: 10,
      orderedUnitCostCents: 400,
      receivedQuantity: 10,
    });
    expect(r.amountVarianceCents).toBe(2 * 400 + 20 * 10);
  });
});

describe('who a spending limit lets sign off', () => {
  it('lets an owner sign what the owner must sign', () => {
    expect(canSignOff('owner', 'owner')).toBe(true);
  });

  it('refuses the editor who raised it', () => {
    // The hole this closes: the decide endpoint gates on `editor`, so a rule
    // reading "The owner signs it off" was satisfied by the most junior person
    // who could raise the order in the first place.
    expect(canSignOff('editor', 'owner')).toBe(false);
    expect(canSignOff('editor', 'admin')).toBe(false);
    expect(canSignOff('admin', 'owner')).toBe(false);
  });

  it('lets anyone senior enough sign a looser rule', () => {
    expect(canSignOff('owner', 'editor')).toBe(true);
    expect(canSignOff('admin', 'editor')).toBe(true);
    expect(canSignOff('editor', 'editor')).toBe(true);
  });

  it('is a yes when the rule named nobody', () => {
    // No role means "anyone who can edit buying", which the endpoint has already
    // established. A no here would hold every such order forever.
    expect(canSignOff('editor', null)).toBe(true);
    expect(canSignOff(undefined, undefined)).toBe(true);
    expect(canSignOff('editor', '')).toBe(true);
  });

  it('refuses a caller whose role is unknown when the rule names one', () => {
    // A spending control that assumes when it cannot tell is not a control.
    expect(canSignOff(null, 'owner')).toBe(false);
    expect(canSignOff(undefined, 'admin')).toBe(false);
  });

  it('does not strand an order behind a role nobody recognises', () => {
    // `viewer` and `member` are deliberately outside ApproverRole. A rule
    // carrying one could never be satisfied, and holding an order forever is
    // worse than admitting whoever the endpoint already let in.
    expect(canSignOff('owner', 'viewer')).toBe(true);
    expect(canSignOff('editor', 'member')).toBe(true);
  });
});
