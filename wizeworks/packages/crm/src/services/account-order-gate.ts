// Whether a trade account's order goes ahead, waits for somebody to sign it off,
// or cannot be taken at all.
//
// ── WHY THIS IS ONE FILE ────────────────────────────────────────────────────
//
// Two paths write a trade account's order: the site checkout, and a quote the
// buyer accepted. Each used to decide this for itself, and they disagreed. The
// checkout held an order over a spending limit and REFUSED one over the credit
// limit; an accepted quote did neither, because accepting never made an order
// at all (sparx persona issue 085). The /b2b page promises one rule for both:
//
//     "When an account would run over, the order holds for your approval."
//     "Orders above a configured amount hold for staff approval before they're
//      placed, and so do orders that would push an account over its credit
//      limit."
//
// So the credit limit HOLDS rather than refuses, and both writers ask here.
// [[feedback_a_promise_in_copy_is_a_contract]]
//
// ── WHAT STILL REFUSES ──────────────────────────────────────────────────────
//
// The account's own standing. Credit hold, suspended and not trading are
// decisions the business has already made about this buyer, so there is
// nothing for a person to sign off: the order is refused, with the reason.
//
// ── A LIMIT NOBODY SET ──────────────────────────────────────────────────────
//
// `companies.credit_limit` is `NUMERIC NOT NULL DEFAULT 0`, so an account
// nobody gave a limit has no credit, and every order it places on terms waits
// for a person. That used to be a flat refusal at checkout. Waiting is the
// promise, and it is also the kinder failure: the owner sees the order and can
// say yes, where a refusal reached only the buyer.
//
// A figure that cannot be read counts as no credit, never as unlimited: every
// comparison against NaN is false, and the old `order > available` test waved
// an unreadable limit straight through.

import type { TxClient } from '@wizeworks/db';

/** The three fields of an account the decision reads. */
export interface AccountStanding {
  status: string;
  creditLimit: unknown;
  creditUsed: unknown;
}

/** Why an order is waiting for somebody to sign it off. An order can wait for
 *  both reasons at once, and the person signing should see both. */
export type HoldReason =
  | {
      kind: 'over_credit_limit';
      /** Major units. */
      orderTotal: number;
      /** Major units; never below zero. */
      creditLeft: number;
      currency: string;
    }
  | { kind: 'approval_rule'; ruleId: string };

export type TermsDecision =
  | { kind: 'refuse'; message: string }
  | { kind: 'hold'; reason: Extract<HoldReason, { kind: 'over_credit_limit' }> }
  | { kind: 'place' };

/** The account states that stop an order on terms outright, in the buyer's
 *  words. Null when the account is trading. */
export function accountStandingRefusal(status: string): string | null {
  if (status === 'credit_hold') {
    return 'Account is on credit hold: payment required before placing new orders';
  }
  if (status === 'suspended') {
    return 'Account is suspended: contact your account manager';
  }
  if (status === 'inactive') {
    return 'Account is not currently trading: contact your account manager';
  }
  return null;
}

/**
 * May this order go on the account's terms now, must it wait, or is it refused.
 *
 * Pure, so the rule can be stated in a test without a database. The limit is a
 * ceiling, not a wall a cent below it: an order of exactly the remaining credit
 * goes ahead.
 */
export function termsDecision(
  account: AccountStanding,
  orderCents: number,
  currency: string
): TermsDecision {
  const refusal = accountStandingRefusal(account.status);
  if (refusal) return { kind: 'refuse', message: refusal };

  const available = Number(account.creditLimit) - Number(account.creditUsed);
  const orderTotal = orderCents / 100;
  // Asked this way round so that anything which is not a number waits.
  if (orderTotal <= available) return { kind: 'place' };
  return {
    kind: 'hold',
    reason: {
      kind: 'over_credit_limit',
      orderTotal,
      // To the cent: $5,000.00 less $4,753.60 is 246.39999999999964 in floating
      // point, and this figure is printed to the person signing.
      creditLeft:
        Number.isFinite(available) && available > 0 ? Math.round(available * 100) / 100 : 0,
      currency,
    },
  };
}

/** The active spending limit that holds an order, if any. Two independent axes
 *  under an AND (docs/131 §4): a rule covers this order when its ACCOUNT axis
 *  matches (this buyer, or any) and its SITE axis matches (this business, or
 *  any). Collapsing them into one OR would fire a donut-shop rule on a
 *  machine-shop order. */
export async function findHoldingRule(
  tx: TxClient,
  tenantId: string,
  order: { accountId: string; propertyId: string | null; totalCents: number }
): Promise<{ id: string } | null> {
  return tx.purchaseApprovalRule.findFirst({
    where: {
      tenantId,
      isActive: true,
      minAmountCents: { lte: order.totalCents },
      AND: [
        { OR: [{ accountId: order.accountId }, { accountId: null }] },
        { OR: [{ propertyId: order.propertyId }, { propertyId: null }] },
      ],
    },
    select: { id: true },
  });
}

/** Where a held order keeps the reasons it is waiting, on its own metadata. */
export const APPROVAL_HOLD_KEY = 'approvalHold';

/** Merge the hold reasons into an order's metadata. */
export function withApprovalHold(
  metadata: Record<string, unknown>,
  reasons: readonly HoldReason[]
): Record<string, unknown> {
  if (reasons.length === 0) return metadata;
  return { ...metadata, [APPROVAL_HOLD_KEY]: { reasons: [...reasons] } };
}

/** Read the hold reasons back off an order's metadata. Anything that does not
 *  parse is dropped rather than guessed at. */
export function approvalHoldReasons(metadata: unknown): HoldReason[] {
  if (!metadata || typeof metadata !== 'object') return [];
  const hold = (metadata as Record<string, unknown>)[APPROVAL_HOLD_KEY];
  if (!hold || typeof hold !== 'object') return [];
  const reasons = (hold as { reasons?: unknown }).reasons;
  if (!Array.isArray(reasons)) return [];
  return reasons.flatMap((raw): HoldReason[] => {
    if (!raw || typeof raw !== 'object') return [];
    const r = raw as Record<string, unknown>;
    if (
      r.kind === 'over_credit_limit' &&
      typeof r.orderTotal === 'number' &&
      typeof r.creditLeft === 'number' &&
      typeof r.currency === 'string'
    ) {
      return [
        {
          kind: 'over_credit_limit',
          orderTotal: r.orderTotal,
          creditLeft: r.creditLeft,
          currency: r.currency,
        },
      ];
    }
    if (r.kind === 'approval_rule' && typeof r.ruleId === 'string') {
      return [{ kind: 'approval_rule', ruleId: r.ruleId }];
    }
    return [];
  });
}

// ── WHO SIGNS IT OFF ────────────────────────────────────────────────────────
//
// A trade account's contact can hold the role "Can approve orders", and until
// sparx persona issue 087 nothing ever asked them anything: every held order
// went to the business's team, and the approver could look but not approve.
//
// A spending limit is now signed off by one of two sides:
//
//   'business'  the business's own team, as every limit was before;
//   'account'   the account's own approvers, on the site.
//
// A limit the account signs is the buyer's own spending control, so the
// business does not sign it a second time. The credit limit is different: it is
// the business's money on the line, so an order over it always needs the
// business too, whoever else signs. When both sides are asked, either may go
// first, and the order goes ahead when the last one says yes.
//
// An account with nobody who can approve (or whose only approver placed the
// order) falls back to the business. Without that, a limit set to "the account
// signs" on an account with no approver would hold every order it catches with
// nobody able to release it.

/** One side of a sign-off. */
export type SignOffSide = 'account' | 'business';

/** The sides, in the order a person reads them: the buyer's own approver first. */
export const SIGN_OFF_SIDES: readonly SignOffSide[] = ['account', 'business'];

/** Who signed one side, and when. */
export interface SignOffSignature {
  name: string;
  /** ISO timestamp. */
  at: string;
  /** Set when a contact at the account signed. */
  customerId?: string;
  /** Set when somebody on the business's team signed. */
  userId?: string;
}

/** Somebody at the account who can approve its orders. */
export interface AccountApprover {
  customerId: string;
  name: string;
  email: string | null;
}

/** Where a held order stands. `waitingOn` is `needs` less the sides that have
 *  signed; the order goes ahead when it is empty. */
export interface SignOffState {
  needs: SignOffSide[];
  signed: Partial<Record<SignOffSide, SignOffSignature>>;
  waitingOn: SignOffSide[];
}

/** The fields of a spending limit the decisions below read. */
export interface GoverningRuleFields {
  accountId: string | null;
  propertyId: string | null;
  minAmountCents: number;
  createdAt: Date | string;
}

/**
 * The one rule that holds a given order, out of every active rule.
 *
 * Checkout only has to know whether ANY rule matches; deciding has to know
 * WHICH one, because the rule says who signs: a named person on the business's
 * team, anyone on it, or the account's own approvers.
 *
 * Precedence is the inventory side's, deliberately: the strictest threshold the
 * order clears wins, and age breaks a tie. A $20,000 order routes to the
 * $10,000 approver, not the $500 one. The two spending controls in this product
 * are read by the same person on the same afternoon, and a precedence that
 * differed between them would be a thing to learn twice.
 *
 * Pure, so the rule can be stated in a test without a database.
 */
export function ruleGoverningOrder<T extends GoverningRuleFields>(
  order: { accountId: string | null; propertyId: string | null; totalCents: number },
  rules: readonly T[]
): T | null {
  // Two independent axes, matched the way checkout matches them (docs/131 §4):
  // a null on either axis is "any", never "none".
  const matching = rules.filter(
    (rule) =>
      (rule.accountId === null || rule.accountId === order.accountId) &&
      (rule.propertyId === null || rule.propertyId === order.propertyId) &&
      order.totalCents >= rule.minAmountCents
  );
  if (matching.length === 0) return null;

  const age = (value: Date | string) => (typeof value === 'string' ? value : value.toISOString());

  return [...matching].sort(
    (a, b) =>
      b.minAmountCents - a.minAmountCents || age(a.createdAt).localeCompare(age(b.createdAt))
  )[0]!;
}

/**
 * Who has to say yes before a held order goes ahead.
 *
 * Pure. `rule` is the rule governing the order now (null when none does, for
 * instance because it was removed after the order was held); `accountApprovers`
 * excludes the person who placed the order, since nobody signs off their own.
 */
export function signOffState(input: {
  reasons: readonly HoldReason[];
  rule: { signOffBy: string } | null;
  accountApprovers: readonly AccountApprover[];
  signed: Partial<Record<SignOffSide, SignOffSignature>>;
}): SignOffState {
  const overCredit = input.reasons.some((reason) => reason.kind === 'over_credit_limit');
  // Only an order a spending limit held is the account's to sign. One held for
  // credit alone is not, even if a limit set to the account has been added since.
  // An order held before the reasons were recorded has none, and the rule speaks.
  const heldByLimit =
    input.reasons.length === 0 || input.reasons.some((reason) => reason.kind === 'approval_rule');
  const accountAsked =
    heldByLimit && input.rule?.signOffBy === 'account' && input.accountApprovers.length > 0;
  // The business signs when the credit limit is involved, and is the fallback
  // for everything else: a held order nobody is asked about would wait forever.
  const businessAsked = overCredit || !accountAsked;
  const needs = SIGN_OFF_SIDES.filter((side) =>
    side === 'account' ? accountAsked : businessAsked
  );
  const signed: Partial<Record<SignOffSide, SignOffSignature>> = {};
  for (const side of needs) {
    const signature = input.signed[side];
    if (signature) signed[side] = signature;
  }
  return { needs, signed, waitingOn: needs.filter((side) => !signed[side]) };
}

/** Read the signatures already on a held order. Anything that does not parse is
 *  dropped, which reads as "not signed yet" rather than as a signature. */
export function approvalSignatures(
  metadata: unknown
): Partial<Record<SignOffSide, SignOffSignature>> {
  if (!metadata || typeof metadata !== 'object') return {};
  const hold = (metadata as Record<string, unknown>)[APPROVAL_HOLD_KEY];
  if (!hold || typeof hold !== 'object') return {};
  const raw = (hold as { signed?: unknown }).signed;
  if (!raw || typeof raw !== 'object') return {};
  const out: Partial<Record<SignOffSide, SignOffSignature>> = {};
  for (const side of SIGN_OFF_SIDES) {
    const s = (raw as Record<string, unknown>)[side];
    if (!s || typeof s !== 'object') continue;
    const r = s as Record<string, unknown>;
    if (typeof r.name !== 'string' || typeof r.at !== 'string') continue;
    out[side] = {
      name: r.name,
      at: r.at,
      ...(typeof r.customerId === 'string' ? { customerId: r.customerId } : {}),
      ...(typeof r.userId === 'string' ? { userId: r.userId } : {}),
    };
  }
  return out;
}

/** Record one side's signature on a held order's metadata. */
export function withSignature(
  metadata: Record<string, unknown>,
  side: SignOffSide,
  signature: SignOffSignature
): Record<string, unknown> {
  const hold = metadata[APPROVAL_HOLD_KEY];
  const current = hold && typeof hold === 'object' ? (hold as Record<string, unknown>) : {};
  return {
    ...metadata,
    [APPROVAL_HOLD_KEY]: {
      ...current,
      signed: { ...approvalSignatures(metadata), [side]: signature },
    },
  };
}

/** A person's name as it is signed: their name, else first and last, else the
 *  email. */
export function signerName(person: {
  firstName?: string | null;
  lastName?: string | null;
  name?: string | null;
  email?: string | null;
}): string {
  // Blank counts as missing at every step, so a name saved as "" still falls
  // through to the next thing that can name them.
  const name = person.name?.trim() ?? '';
  if (name !== '') return name;
  const full = [person.firstName, person.lastName].filter(Boolean).join(' ').trim();
  if (full !== '') return full;
  return person.email?.trim() ? person.email : 'Somebody';
}

/** The active spending limits for a tenant, with what deciding needs. */
export async function activeApprovalRules(tx: TxClient, tenantId: string) {
  return tx.purchaseApprovalRule.findMany({
    where: { tenantId, isActive: true },
    select: {
      id: true,
      accountId: true,
      propertyId: true,
      minAmountCents: true,
      createdAt: true,
      signOffBy: true,
      requiredApproverUserId: true,
      requiredApprover: { select: { name: true, email: true } },
    },
  });
}

export type ActiveApprovalRule = Awaited<ReturnType<typeof activeApprovalRules>>[number];

/** The people at an account who can approve its orders, except `exceptCustomerId`
 *  (the person who placed the order: nobody signs off their own). Oldest first,
 *  so the name a sentence leads with does not change from one read to the next. */
export async function accountApprovers(
  tx: TxClient,
  accountId: string,
  exceptCustomerId: string | null
): Promise<AccountApprover[]> {
  const rows = await tx.b2bAccountContact.findMany({
    where: {
      accountId,
      isActive: true,
      role: 'approver',
      ...(exceptCustomerId ? { customerId: { not: exceptCustomerId } } : {}),
    },
    orderBy: { createdAt: 'asc' },
    select: {
      customerId: true,
      customer: { select: { firstName: true, lastName: true, email: true } },
    },
  });
  return rows.map((row) => ({
    customerId: row.customerId,
    name: signerName(row.customer),
    email: row.customer.email ?? null,
  }));
}

/** Everything about one held order's sign-off, read from the database. */
export interface OrderSignOff {
  state: SignOffState;
  rule: ActiveApprovalRule | null;
  /** Who at the account may sign, whether or not the account is asked. */
  approvers: AccountApprover[];
}

/** Where a held order's sign-off stands, as of now. Pass `rules` when reading
 *  many orders, so the rules are read once. */
export async function loadOrderSignOff(
  tx: TxClient,
  tenantId: string,
  order: {
    customerId: string | null;
    accountId: string | null;
    propertyId: string | null;
    totalCents: number;
    metadata: unknown;
  },
  rules?: readonly ActiveApprovalRule[]
): Promise<OrderSignOff> {
  const rule = ruleGoverningOrder(order, rules ?? (await activeApprovalRules(tx, tenantId)));
  const approvers = order.accountId
    ? await accountApprovers(tx, order.accountId, order.customerId)
    : [];
  return {
    rule,
    approvers,
    state: signOffState({
      reasons: approvalHoldReasons(order.metadata),
      rule,
      accountApprovers: approvers,
      signed: approvalSignatures(order.metadata),
    }),
  };
}
