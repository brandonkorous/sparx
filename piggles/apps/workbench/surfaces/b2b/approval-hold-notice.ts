// WHAT AN EMPTY SIGN-OFF QUEUE MEANS: "nothing has hit a limit" and "no limit is
// on" are the same empty screen and opposite facts, and a limit for one customer
// says whose it is (issue 752). [[feedback_a_promise_in_copy_is_a_contract]]

export interface HoldNotice {
  title: string;
  detail: string;
}

export interface HoldRule {
  isActive: boolean;
  minAmountCents: number;
  minAmountFormatted: string;
  /** The one wholesale customer this limit is for, or null when it covers
   *  everybody. A limit on one shop holds nothing of anybody else's. */
  accountName: string | null;
  /** Who signs what this limit holds: your team, or the customer's own
   *  approvers on the site (sparx persona issue 087). Absent reads as the
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
const NOBODY_ELSE = ' No other customer’s order is held for its size, however large.';

// THE CREDIT LIMIT HOLDS TOO (sparx persona issue 085): an order past its credit
// limit waits here whatever the limits say, so every sentence ends by saying so.
const CREDIT_TOO =
  ' An order that would take an account past its credit limit still waits here for your yes.';

// NOT EVERY HELD ORDER IS YOURS TO SIGN (sparx persona issue 087): a limit the
// customer's own approvers sign still lands here, but the yes is theirs.
const THEIRS_TOO =
  ' Where a limit is signed off by the customer’s own approvers, the order waits here for ' +
  'them instead, so you can follow it.';

// No limit, or none switched on: nothing is held for its size, however large.
function unheldNotice(rules: HoldRule[]): HoldNotice | null {
  if (rules.length === 0) {
    return {
      title: 'Nothing waiting, and nothing set to wait',
      detail:
        'No order is held for its size, because you have not set a limit yet. ' +
        'Add one below and any order over it waits here for a yes, from your team or from ' +
        'the customer’s own approvers.' +
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
  return null;
}

export function holdQueueNotice(rules: HoldRule[]): HoldNotice {
  const unheld = unheldNotice(rules);
  if (unheld !== null) return unheld;

  const live = rules.filter((rule) => rule.isActive);
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
        : `${opening}orders from ${String(named.length)} wholesale customers, each over a limit ` +
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
      : `, and ${String(named.length)} wholesale customers have a limit of their own`;
  return {
    title: 'Nothing waiting',
    detail: `${opening}${overWhat(blanket)}${extra}${closing}${theirs}${CREDIT_TOO}`,
  };
}

// WHY ONE ORDER IS WAITING: a spending limit and the credit limit ask different
// things of the signer; both are carried when both apply (sparx persona issue 085).

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
