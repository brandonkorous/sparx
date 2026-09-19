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

export interface HoldNotice {
  title: string;
  detail: string;
}

export interface HoldRule {
  isActive: boolean;
  minAmountCents: number;
  minAmountFormatted: string;
}

/** "every order" rather than "over $0.00" — a zero limit holds everything, and
 *  the schema says so (`0 = all B2B orders`). */
function overWhat(rule: HoldRule): string {
  return rule.minAmountCents <= 0 ? 'every order' : `every order over ${rule.minAmountFormatted}`;
}

/** The lowest live limit is the one that actually bites: an order over it is
 *  held whatever the others say. */
function lowestLive(rules: HoldRule[]): HoldRule | null {
  const live = rules.filter((rule) => rule.isActive);
  if (live.length === 0) return null;
  return live.reduce((low, rule) => (rule.minAmountCents < low.minAmountCents ? rule : low));
}

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

  const lowest = lowestLive(rules);
  const holds = lowest === null ? 'a limit you set below' : overWhat(lowest);
  return {
    title: 'Nothing waiting',
    detail: `No orders are held for sign-off right now. You are holding ${holds}, so the next one lands here.`,
  };
}
