// Working out what a sale actually earned someone.
//
// `commissions.ts` is the LEDGER — it records and lists what was earned. This is
// the part that decides the number, and it is the piece docs/149 §10 called "the
// missing piece, not the screen": the service, the API and the person pane had
// all shipped, and nothing anywhere calculated a commission.
//
// It was missing for two reasons that were both schema, not code:
//
//   • `staff_pay_rates.basis` accepted 'commission' with no percentage column.
//     `amount_cents` is per-hour under 'hourly' and per-YEAR under 'salary', so
//     'commission' was a basis the rate model could name and could not describe.
//     `commission_percent` (migration 20270324000000) is that number.
//   • An order recorded NO salesperson. `staff_sale_attributions` is who sold it.
//
// ── THE RULES THIS ENCODES, AND WHY ──────────────────────────────────────────
//
// EARNED WHEN PAID, not when placed. A commission on an order nobody has paid
// for is a promise, and paying it out of a promise is how a business funds its
// staff from cash it has not received. `order.paid` is the trigger.
//
// THE BASIS IS WHAT THE BUSINESS SOLD — subtotal less discount. Not tax (that is
// the state's money passing through), not shipping (the carrier's), not
// surcharges (the card processor's). Commission on any of the three pays someone
// a share of money the business never had.
//
// A REFUND REDUCES IT, PROPORTIONALLY. A half-refunded order earned half the
// commission. This recomputes rather than reverses, and `recordCommission`
// upserts on (person, sale), so the row moves to the new number instead of a
// second correcting row appearing beside it.
//
// IT NEVER TOUCHES A ROW SOMEBODY DECIDED ABOUT. `recordCommission`'s update
// deliberately leaves `status` alone, so a recalculation cannot resurrect a
// voided commission or push a paid one back to pending — those are decisions a
// human made about money that has already moved.

import { withTenant, type TxClient } from '@wizeworks/db';

import { commissionCents, recordCommission, type CommissionSource } from './commissions.js';

/**
 * What a calculation did, so a caller can log something true.
 *
 * `no-rate` and `rate-not-in-force` are deliberately two outcomes, not one.
 * They look identical from inside the calculation — no rate came back — and they
 * are fixed in opposite ways, so collapsing them produces advice that is worse
 * than silence. Found by clicking it: a salesperson was put on 7.5% commission
 * today, an order paid a fortnight ago was credited to her, and the screen said
 * "they are not on commission — set a commission rate on their pay record."
 * She was on commission. The rate simply started after the sale, and the owner
 * was being sent to do the exact thing they had just done.
 */
export interface CommissionOutcome {
  outcome:
    | 'recorded'
    | 'no-attribution'
    | 'no-rate'
    | 'rate-not-in-force'
    | 'not-payable'
    | 'unknown-sale';
  staffMemberId?: string;
  basisCents?: number;
  ratePercent?: number;
  amountCents?: number;
  /** `rate-not-in-force` only: when their commission actually starts, and the day
   *  the sale earned on. Both, because the sentence a person needs is the
   *  comparison — "their commission started on the 16th; this was paid on the
   *  4th" — and neither date means anything without the other. ISO days. */
  rateStartsOn?: string;
  earnedOn?: string;
}

/**
 * A `Decimal(12,2)` of MAJOR units as integer cents, without ever touching a
 * float.
 *
 * Order money is stored in major units (`total Decimal(12,2)`), and every other
 * money path in this platform is integer cents. `Number('123.45') * 100` is
 * 12344.999999999998, so the bridge between the two is done on the STRING —
 * which is exact, and is the whole reason this helper exists rather than a
 * multiply at each call site.
 */
export function decimalToCents(value: { toString(): string }): number {
  const raw = value.toString().trim();
  const negative = raw.startsWith('-');
  const [whole = '0', fraction = ''] = raw.replace(/^[-+]/, '').split('.');
  const cents = `${fraction}00`.slice(0, 2);
  const total = Number(whole) * 100 + Number(cents);
  return negative ? -total : total;
}

/**
 * The share of a sale that survived refunds, in cents.
 *
 * Proportional to what was refunded against the ORDER TOTAL, not against the
 * basis — a refund of the shipping charge is still money returned, and pretending
 * the sale was untouched because the refund happened to land outside the
 * commissionable slice would overpay.
 */
export function refundAdjustedBasis(
  basisCents: number,
  totalCents: number,
  refundedCents: number
): number {
  if (basisCents <= 0) return 0;
  if (refundedCents <= 0 || totalCents <= 0) return Math.max(0, basisCents);
  if (refundedCents >= totalCents) return 0;
  const keptBps = Math.round(((totalCents - refundedCents) * 10_000) / totalCents);
  return Math.max(0, Math.round((basisCents * keptBps) / 10_000));
}

/** The commission rate in force on a given day, or null when the person is not
 *  on commission at all. A rate window that has closed does not apply, and a
 *  person on `hourly` earns no commission however the sale went — the two are
 *  alternatives, which is why the labour deriver skips a commission basis. */
async function commissionRateOn(
  client: TxClient,
  staffMemberId: string,
  day: Date
): Promise<{ percent: number; currency: string } | null> {
  const rate = await client.staffPayRate.findFirst({
    where: {
      staffMemberId,
      basis: 'commission',
      effectiveFrom: { lte: day },
      OR: [{ effectiveTo: null }, { effectiveTo: { gte: day } }],
    },
    orderBy: { effectiveFrom: 'desc' },
  });
  if (!rate) return null;
  const percent = Number(rate.commissionPercent.toString());
  return percent > 0 ? { percent, currency: rate.currency } : null;
}

/**
 * Why no rate applied — the difference between "never on commission" and "not on
 * commission YET".
 *
 * Only asked once the day lookup has already failed, so it costs a query only on
 * the path that is about to tell somebody something, and never on the hot path.
 * A rate with a zero percentage counts as not being on commission at all: the
 * basis says commission and the share says nothing, which is the same practical
 * state as no rate, and calling it "starts later" would be a lie.
 */
async function whyNoRate(
  client: TxClient,
  staffMemberId: string,
  earnedOn: Date
): Promise<CommissionOutcome> {
  const earliest = await client.staffPayRate.findFirst({
    where: { staffMemberId, basis: 'commission', commissionPercent: { gt: 0 } },
    orderBy: { effectiveFrom: 'asc' },
    select: { effectiveFrom: true },
  });
  if (!earliest || earliest.effectiveFrom <= earnedOn) {
    // No commission rate at all, or one that had already ENDED by this day —
    // "set a rate" is honest advice for the first and close enough for the
    // second, which is rare and visible on the pay history either way.
    return { outcome: 'no-rate', staffMemberId };
  }
  return {
    outcome: 'rate-not-in-force',
    staffMemberId,
    // Days, not instants. `effectiveFrom` is a stored calendar day and `paidAt`
    // is a real moment; formatting either in local time renders it a day early
    // west of Greenwich, so both are cut in UTC.
    rateStartsOn: earliest.effectiveFrom.toISOString().slice(0, 10),
    earnedOn: earnedOn.toISOString().slice(0, 10),
  };
}

/**
 * Who gets credited for a sale.
 *
 * An explicit attribution always wins — including over a deal's own
 * `assignedRepId`, because the rep who owns a deal in the pipeline is not always
 * the person who should be paid for closing it. Falling back to the rep is what
 * makes deals work with no extra data entry; orders have no equivalent, which is
 * exactly why `staff_sale_attributions` had to exist before an order could ever
 * earn anybody anything.
 */
async function attributedStaffMemberId(
  client: TxClient,
  sourceType: CommissionSource,
  sourceId: string,
  fallbackUserId: string | null
): Promise<string | null> {
  const explicit = await client.staffSaleAttribution.findFirst({
    where: { sourceType, sourceId },
    select: { staffMemberId: true },
  });
  if (explicit) return explicit.staffMemberId;

  if (!fallbackUserId) return null;
  const member = await client.staffMember.findFirst({
    where: { userId: fallbackUserId, archivedAt: null },
    select: { id: true },
  });
  return member?.id ?? null;
}

/**
 * Calculate and record the commission on one order.
 *
 * Idempotent: safe on a redelivered `order.paid`, and safe to re-run after a
 * refund — the same (person, sale) row is updated to the new figure.
 */
export async function commissionForOrder(
  tenantId: string,
  orderId: string,
  tx?: TxClient
): Promise<CommissionOutcome> {
  const run = async (client: TxClient): Promise<CommissionOutcome> => {
    const order = await client.order.findFirst({
      where: { id: orderId },
      select: {
        id: true,
        orderNumber: true,
        propertyId: true,
        currency: true,
        subtotal: true,
        discountTotal: true,
        total: true,
        refundTotal: true,
        paidAt: true,
      },
    });
    if (!order) return { outcome: 'unknown-sale' };

    // Unpaid earns nothing — see the header. This is also what makes a
    // `order.refunded` on a never-paid order a no-op rather than a negative.
    if (!order.paidAt) return { outcome: 'not-payable' };

    const staffMemberId = await attributedStaffMemberId(client, 'order', order.id, null);
    if (!staffMemberId) return { outcome: 'no-attribution' };

    const earnedOn = order.paidAt;
    const rate = await commissionRateOn(client, staffMemberId, earnedOn);
    if (!rate) return whyNoRate(client, staffMemberId, earnedOn);

    const grossBasis = decimalToCents(order.subtotal) - decimalToCents(order.discountTotal);
    const basisCents = refundAdjustedBasis(
      grossBasis,
      decimalToCents(order.total),
      decimalToCents(order.refundTotal)
    );
    const amountCents = commissionCents(basisCents, rate.percent);

    await recordCommission(
      tenantId,
      {
        staffMemberId,
        sourceType: 'order',
        sourceId: order.id,
        // Snapshotted so the row still reads after the order is gone.
        sourceLabel: order.orderNumber ? `Order ${order.orderNumber}` : 'Order',
        basisCents,
        ratePercent: rate.percent,
        amountCents,
        currency: order.currency,
        earnedOn,
        propertyId: order.propertyId,
      },
      client
    );

    return {
      outcome: 'recorded',
      staffMemberId,
      basisCents,
      ratePercent: rate.percent,
      amountCents,
    };
  };

  return tx ? run(tx) : withTenant({ tenantId }, run);
}

/**
 * Calculate and record the commission on one won deal.
 *
 * The basis is the deal's own `value`, which is the only number a deal carries —
 * there is no line detail to strip tax or shipping out of, so unlike an order
 * what you typed is what it is.
 */
export async function commissionForDeal(
  tenantId: string,
  dealId: string,
  tx?: TxClient
): Promise<CommissionOutcome> {
  const run = async (client: TxClient): Promise<CommissionOutcome> => {
    const deal = await client.deal.findFirst({
      where: { id: dealId },
      select: {
        id: true,
        title: true,
        value: true,
        currency: true,
        propertyId: true,
        assignedRepId: true,
        closedAt: true,
        // `stageType` is the vocabulary — open | won | lost | resolved | closed.
        // There is no `isWon` boolean; reading the stage's TYPE rather than its
        // name is what keeps this working for a tenant who renamed "Won" to
        // "Signed".
        stage: { select: { stageType: true } },
      },
    });
    if (!deal) return { outcome: 'unknown-sale' };
    if (deal.stage.stageType !== 'won') return { outcome: 'not-payable' };

    const staffMemberId = await attributedStaffMemberId(
      client,
      'deal',
      deal.id,
      deal.assignedRepId
    );
    if (!staffMemberId) return { outcome: 'no-attribution' };

    const earnedOn = deal.closedAt ?? new Date();
    const rate = await commissionRateOn(client, staffMemberId, earnedOn);
    if (!rate) return whyNoRate(client, staffMemberId, earnedOn);

    const basisCents = Math.max(0, decimalToCents(deal.value));
    const amountCents = commissionCents(basisCents, rate.percent);

    await recordCommission(
      tenantId,
      {
        staffMemberId,
        sourceType: 'deal',
        sourceId: deal.id,
        sourceLabel: deal.title,
        basisCents,
        ratePercent: rate.percent,
        amountCents,
        currency: deal.currency,
        earnedOn,
        // A deal carries its own site, denormalised at creation — so a
        // commission lands against the business the deal belonged to rather
        // than nowhere.
        propertyId: deal.propertyId,
      },
      client
    );

    return {
      outcome: 'recorded',
      staffMemberId,
      basisCents,
      ratePercent: rate.percent,
      amountCents,
    };
  };

  return tx ? run(tx) : withTenant({ tenantId }, run);
}
