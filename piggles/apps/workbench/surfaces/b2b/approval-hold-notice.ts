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
// whether a wholesale customer can spend without a person saying yes; "nothing has
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
  /** The one wholesale customer this limit is for, or null when it covers
   *  everybody. A limit on one shop holds nothing of anybody else's. */
  accountName: string | null;
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
const NOBODY_ELSE = ' No other customer’s order is held, however large.';

export function holdQueueNotice(rules: HoldRule[]): HoldNotice {
  if (rules.length === 0) {
    return {
      title: 'Nothing waiting, and nothing set to wait',
      detail:
        'No order will be held for sign-off, because you have not set a limit yet. ' +
        'Add one below and any order over it waits here for your yes.',
    };
  }

  const live = rules.filter((rule) => rule.isActive);

  if (live.length === 0) {
    if (rules.length === 1) {
      return {
        title: 'Your limit is switched off',
        detail:
          'You have one limit set below and it is switched off, so no order is being held for ' +
          'sign-off, however large. Use the switch beside it to turn it on.',
      };
    }
    return {
      title: 'Your limits are switched off',
      detail:
        `All ${String(rules.length)} of the limits set below are switched off, so no order is ` +
        'being held for sign-off, however large. Use the switch beside a limit to turn it on.',
    };
  }

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
    return { title: 'Nothing waiting', detail };
  }

  if (named.length === 0) {
    return { title: 'Nothing waiting', detail: `${opening}${overWhat(blanket)}${closing}` };
  }

  const extra =
    onlyNamed !== null
      ? `, and ${overWhatFrom(onlyNamed)}`
      : `, and ${String(named.length)} wholesale customers have a limit of their own`;
  return { title: 'Nothing waiting', detail: `${opening}${overWhat(blanket)}${extra}${closing}` };
}
