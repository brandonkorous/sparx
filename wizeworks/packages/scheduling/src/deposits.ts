// Deposit + fee math (docs/79 §9) — the PURE policy arithmetic behind booking
// payments: what to hold/charge at booking time, and what to capture on a
// no-show or late cancellation. No DB, no payment gateway — just the numbers, so
// it's fully unit-testable and the same rules apply on every transport.
//
// The side-effecting orchestration (creating/capturing/voiding the actual
// PaymentIntent through @wizeworks/payments) lives in api-rest's scheduling-payments
// lib, which feeds these results to the gateway.

const HOUR_MS = 60 * 60 * 1000;

export type DepositType = 'none' | 'card_hold' | 'deposit' | 'prepay';

/** The deposit/fee-relevant fields of a BookingPolicy (a plain shape so callers
 *  can pass a Prisma row or a literal — the math doesn't touch the DB). */
export interface DepositPolicyInput {
  depositType: string;
  depositAmountCents?: number | null;
  depositPercent?: number | null;
  cancellationWindowHours: number;
  lateCancelFeeType?: string | null; // 'fixed' | 'percent'
  lateCancelFeeValue?: number | null;
  noShowFeeType?: string | null;
  noShowFeeValue?: number | null;
}

/** What to do with money at booking time. */
export interface DepositPlan {
  type: DepositType;
  /** Cents to authorize (card_hold) or charge (deposit/prepay) up front. */
  amountCents: number;
  /** manual = authorize-now/capture-later (card_hold); automatic = charge now. */
  captureMethod: 'automatic' | 'manual';
}

/** A fee from a {type, value} pair: `fixed` is cents, `percent` is a whole
 *  percent of the service price. Unknown/absent → 0. Never negative. */
export function computeFee(
  feeType: string | null | undefined,
  feeValue: number | null | undefined,
  servicePriceCents: number
): number {
  if (feeValue == null || feeValue <= 0) return 0;
  if (feeType === 'fixed') return Math.round(feeValue);
  if (feeType === 'percent') return Math.max(0, Math.round((servicePriceCents * feeValue) / 100));
  return 0;
}

export function computeNoShowFee(policy: DepositPolicyInput, servicePriceCents: number): number {
  return computeFee(policy.noShowFeeType, policy.noShowFeeValue, servicePriceCents);
}

export function computeLateCancelFee(
  policy: DepositPolicyInput,
  servicePriceCents: number
): number {
  return computeFee(policy.lateCancelFeeType, policy.lateCancelFeeValue, servicePriceCents);
}

/** The configured deposit amount: an explicit cents value wins, else a percent of
 *  the service price, else 0. */
function depositAmount(policy: DepositPolicyInput, servicePriceCents: number): number {
  if (policy.depositAmountCents != null && policy.depositAmountCents > 0) {
    return Math.round(policy.depositAmountCents);
  }
  if (policy.depositPercent != null && policy.depositPercent > 0) {
    return Math.max(0, Math.round((servicePriceCents * policy.depositPercent) / 100));
  }
  return 0;
}

/**
 * What to collect at booking time for a service under this policy.
 *
 * - `none`     → nothing.
 * - `prepay`   → charge the full service price now (automatic capture).
 * - `deposit`  → charge the deposit amount now (automatic capture).
 * - `card_hold`→ AUTHORIZE (manual capture) enough to cover the worst-case fee —
 *   the larger of the no-show fee, the late-cancel fee, and any deposit amount —
 *   so a later no-show/late-cancel can be captured from the same hold and the
 *   rest released. With no fees + no deposit configured there's nothing to hold,
 *   so it collapses to `none`.
 *
 * Any type whose computed amount is 0 collapses to `none` (nothing to collect).
 */
export function resolveDepositPlan(
  policy: DepositPolicyInput,
  servicePriceCents: number
): DepositPlan {
  const none: DepositPlan = { type: 'none', amountCents: 0, captureMethod: 'automatic' };
  switch (policy.depositType) {
    case 'prepay': {
      const amountCents = Math.max(0, Math.round(servicePriceCents));
      return amountCents > 0 ? { type: 'prepay', amountCents, captureMethod: 'automatic' } : none;
    }
    case 'deposit': {
      const amountCents = depositAmount(policy, servicePriceCents);
      return amountCents > 0 ? { type: 'deposit', amountCents, captureMethod: 'automatic' } : none;
    }
    case 'card_hold': {
      const amountCents = Math.max(
        computeNoShowFee(policy, servicePriceCents),
        computeLateCancelFee(policy, servicePriceCents),
        depositAmount(policy, servicePriceCents)
      );
      return amountCents > 0 ? { type: 'card_hold', amountCents, captureMethod: 'manual' } : none;
    }
    default:
      return none;
  }
}

/** Is a cancellation at `now` inside the policy's notice window (i.e. "late")?
 *  True when the booking starts within `cancellationWindowHours` of now (or has
 *  already started). A 0-hour window means no late-cancel concept → never late. */
export function isLateCancellation(
  policy: DepositPolicyInput,
  startAt: Date,
  now: Date = new Date()
): boolean {
  if (policy.cancellationWindowHours <= 0) return false;
  const cutoff = startAt.getTime() - policy.cancellationWindowHours * HOUR_MS;
  return now.getTime() >= cutoff;
}
