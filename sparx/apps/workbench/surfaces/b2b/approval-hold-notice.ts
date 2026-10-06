// WHAT AN EMPTY SIGN-OFF QUEUE ACTUALLY MEANS.
//
// The queue said, whenever it was empty:
//
//     Nothing waiting
//     No orders are held for sign-off right now. When one goes over a limit you
//     set below, it lands here.
//
// Four lines under that sentence sat a limit of $5,000 with an Off badge beside
// it. The sentence promises a thing the screen below it has switched off.
//
// That is not a rare corner. Of the 38 tenants with a spending limit written
// down, 34 have every one of them switched off — and each of those owners is
// told their orders will be held. An approval rule is the control that decides
// whether a trade account can spend without a person saying yes; "nothing has
// hit it yet" and "it is not switched on" are the same empty screen and
// opposite facts.
//
// So the sentence has to read the rules. Three states, three sets of words, no
// ternaries inside a sentence: a plural-only phrase ("they are all") reads fine
// in source and only breaks on screen.
//
// ── WHO A LIMIT IS FOR (issue 752) ──────────────────────────────────────────
//
// A limit can name ONE wholesale customer. The sentence used to take the lowest
// live limit whoever it was for and call it "every order over $2,500.00", so a
// limit set on one shop was reported as covering the lot. MEASURED on screen
// 2026-09-20: a $2,500 limit on Loom and Larder, beside a $5,000 limit on
// everybody, and the queue said every order over $2,500 was held. A different
// shop ordering $4,000 would have gone straight through, unheld, with the
// screen having said otherwise. [[feedback_a_promise_in_copy_is_a_contract]]
//
// A limit for one customer therefore says whose it is, and where there is no
// blanket limit at all the sentence says so out loud: nobody else is covered,
// however large the order. [[feedback_never_present_absence_as_measurement]]

export interface HoldNotice {
  title: string;
  detail: string;
}

export interface HoldRule {
  isActive: boolean;
  minAmountCents: number;
  minAmountFormatted: string;
  /** The one account this limit is for, or null when it covers
   *  everybody. A limit on one account holds nothing of anybody else's. */
  accountName: string | null;
  /** Who signs what this limit holds: the business's team, or the account's
   *  own approvers on the site (sparx persona issue 087). Absent reads as the
   *  team, which is what every limit did before. */
  signOffBy?: 'business' | 'account';
}

/** "every order" rather than "over $0.00" — a zero limit holds everything, and
 *  the schema says so (`0 = all B2B orders`). */
function overWhat(rule: HoldRule): string {
  return rule.minAmountCents <= 0 ? 'every order' : `every order over ${rule.minAmountFormatted}`;
}

/** The same phrase for a limit that names one customer. Their name is the whole
 *  point of it, so it is never dropped. */
function overWhatFrom(rule: HoldRule): string {
  const who = rule.accountName ?? 'that customer';
  return rule.minAmountCents <= 0
    ? `everything from ${who}`
    : `anything over ${rule.minAmountFormatted} from ${who}`;
}

/** The lowest live limit is the one that actually bites: an order over it is
 *  held whatever the others say. */
function lowestLive(rules: HoldRule[]): HoldRule | null {
  const live = rules.filter((rule) => rule.isActive);
  if (live.length === 0) return null;
  return live.reduce((low, rule) => (rule.minAmountCents < low.minAmountCents ? rule : low));
}

/** The second sentence for a set of limits that covers nobody in general. It is
 *  the fact she is most likely to get wrong, so it is said rather than implied. */
const NOBODY_ELSE = ' No other account’s order is held for its size, however large.';

// ── THE CREDIT LIMIT HOLDS TOO (sparx persona issue 085) ────────────────────
//
// An order that would take an account past its credit limit waits here for a
// yes, whatever the limits below say: the /b2b page promises it, and the
// checkout and an accepted quote both do it now. So every one of these
// sentences ends by saying so. "No order is being held, however large" was
// true of the spending limits and false of the queue, and the queue is what
// the sentence is about.
const CREDIT_TOO =
  ' An order that would take an account past its credit limit still waits here for your yes.';

// ── NOT EVERY HELD ORDER IS YOURS TO SIGN (sparx persona issue 087) ─────────
//
// A limit can be signed off by the account's own approvers instead of your
// team. Those orders still land here, so you can follow them and turn one
// down, but the yes is theirs. "Waits here for your yes" would be wrong about
// exactly the orders those limits hold, so the sentence says whose it is.
const THEIRS_TOO =
  ' Where a limit is signed off by the account’s own approvers, the order waits here for ' +
  'them instead, so you can follow it.';

export function holdQueueNotice(rules: HoldRule[]): HoldNotice {
  if (rules.length === 0) {
    return {
      title: 'Nothing waiting, and nothing set to wait',
      detail:
        'No order is held for its size, because you have not set a limit yet. ' +
        'Add one below and any order over it waits here for a yes, from your team or from ' +
        'the account’s own approvers.' +
        CREDIT_TOO,
    };
  }

  const live = rules.filter((rule) => rule.isActive);

  if (live.length === 0) {
    if (rules.length === 1) {
      return {
        title: 'Your limit is switched off',
        detail:
          'You have one limit set below and it is switched off, so no order is being held for ' +
          'its size, however large. Use the switch beside it to turn it on.' +
          CREDIT_TOO,
      };
    }
    return {
      title: 'Your limits are switched off',
      detail:
        `All ${String(rules.length)} of the limits set below are switched off, so no order is ` +
        'being held for its size, however large. Use the switch beside a limit to turn it on.' +
        CREDIT_TOO,
    };
  }

  const theirs = live.some((rule) => rule.signOffBy === 'account') ? THEIRS_TOO : '';
  const opening = 'No orders are held for sign-off right now. You are holding ';
  const closing = ', so the next one lands here.';

  const blanket = lowestLive(live.filter((rule) => rule.accountName === null));
  const named = live.filter((rule) => rule.accountName !== null);
  const onlyNamed = named.length === 1 ? lowestLive(named) : null;

  if (blanket === null) {
    // Nothing covers the room. Whatever is held, it is held for named shops
    // only, and everybody else can spend what they like.
    const detail =
      onlyNamed !== null
        ? `${opening}${overWhatFrom(onlyNamed)}${closing}${NOBODY_ELSE}`
        : `${opening}orders from ${String(named.length)} accounts, each over a limit ` +
          `of its own${closing}${NOBODY_ELSE}`;
    return { title: 'Nothing waiting', detail: `${detail}${theirs}${CREDIT_TOO}` };
  }

  if (named.length === 0) {
    return {
      title: 'Nothing waiting',
      detail: `${opening}${overWhat(blanket)}${closing}${theirs}${CREDIT_TOO}`,
    };
  }

  const extra =
    onlyNamed !== null
      ? `, and ${overWhatFrom(onlyNamed)}`
      : `, and ${String(named.length)} accounts have a limit of their own`;
  return {
    title: 'Nothing waiting',
    detail: `${opening}${overWhat(blanket)}${extra}${closing}${theirs}${CREDIT_TOO}`,
  };
}

// ── WHY ONE ORDER IS WAITING ────────────────────────────────────────────────
//
// A held order used to say nothing about why. Now it can be held for two
// reasons, and they ask different things of the person signing: a spending
// limit asks "is an order this big right for them?", the credit limit asks
// "are we happy to be owed this much more?". The order carries both when both
// apply (account-order-gate.ts, sparx persona issue 085).

/** One reason a queued order is waiting, as the API sends it. An order held
 *  before reasons were recorded has none, and says nothing rather than guess. */
export type QueueHoldReason =
  | { kind: 'approval_rule'; limitCents: number | null }
  | { kind: 'over_credit_limit'; orderTotal: number; creditLeft: number; currency: string };

/** The sentence for one reason. `money` formats cents in the order's currency. */
export function holdReasonWords(
  reason: QueueHoldReason,
  money: (cents: number, currency: string) => string,
  currency: string
): string {
  if (reason.kind === 'over_credit_limit') {
    const left =
      reason.creditLeft > 0
        ? `has ${money(Math.round(reason.creditLeft * 100), reason.currency)} of credit left`
        : 'has no credit left';
    return `Over the credit limit: it comes to ${money(
      Math.round(reason.orderTotal * 100),
      reason.currency
    )} and the account ${left}.`;
  }
  if (reason.limitCents === null) return 'Over a spending limit you set.';
  if (reason.limitCents <= 0) return 'You hold every order from them for sign-off.';
  return `Over your ${money(reason.limitCents, currency)} spending limit.`;
}
