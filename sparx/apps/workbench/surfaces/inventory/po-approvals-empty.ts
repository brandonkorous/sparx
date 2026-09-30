// WHAT AN EMPTY SIGN-OFF QUEUE MEANS.
//
// It said, whenever nothing was waiting:
//
//     Nothing is waiting on you
//     Every order that needed signing off has been dealt with. Orders only
//     appear here when they clear a limit set under Spending limits.
//
// There are ZERO spending limits on the whole platform and ZERO orders have ever
// needed signing off. "Every order that needed signing off has been dealt with"
// is a claim about a set that has always been empty, and it reads as
// reassurance: my buying is under control, everything that needed a look got
// one. Nothing is under control. No limit exists, so no order can ever be held,
// however large.
//
// This is the third screen in one sitting with the same shape — the wholesale
// sign-off queue and the time-off queue were the others. An empty list is two
// opposite facts ("all dealt with" and "nothing was ever asked of it") and only
// something outside the list can tell them apart.
//
// Three states, three sets of words. Branches rather than a ternary inside a
// sentence: a plural-only phrase reads fine in source and only breaks on screen.

export interface PoApprovalsEmpty {
  title: string;
  detail: string;
}

export interface PoApprovalLimit {
  isActive: boolean;
  minAmountCents: number;
}

/**
 * `formatMoney` is passed in rather than imported so this module stays pure and
 * testable without dragging the surface's formatting stack behind it.
 */
export function poApprovalsEmptyWords(
  status: string,
  limits: PoApprovalLimit[],
  formatMoney: (cents: number) => string
): PoApprovalsEmpty {
  if (status === 'all') {
    // Not "nothing has reached this state" — on Everything there is no state to
    // reach. This is the only filter that can say nothing has EVER happened.
    return {
      title: 'No order has ever been held for sign-off',
      detail: 'Nothing has been asked for, signed off, turned down or withdrawn.',
    };
  }

  if (status !== 'pending') {
    return {
      title: 'Nothing here',
      detail: 'No order has reached this state.',
    };
  }

  if (limits.length === 0) {
    return {
      title: 'No order can be held for sign-off',
      detail:
        'You have not set a spending limit, so every order goes straight to the supplier however ' +
        'large it is. Set one under Spending limits and any order that reaches it waits here for your yes.',
    };
  }

  const live = limits.filter((limit) => limit.isActive);

  if (live.length === 0) {
    if (limits.length === 1) {
      return {
        title: 'Your spending limit is switched off',
        detail:
          'You have one limit under Spending limits and it is switched off, so no order is being ' +
          'held, however large. Switch it on to start holding orders here.',
      };
    }
    return {
      title: 'Your spending limits are switched off',
      detail:
        `All ${String(limits.length)} of your limits under Spending limits are switched off, so no ` +
        'order is being held, however large. Switch one on to start holding orders here.',
    };
  }

  // The lowest live limit is the one an order actually has to clear.
  const lowest = live.reduce((low, limit) =>
    limit.minAmountCents < low.minAmountCents ? limit : low
  );
  const over =
    lowest.minAmountCents <= 0
      ? 'every order'
      : `every order of ${formatMoney(lowest.minAmountCents)} or more`;
  return {
    title: 'Nothing is waiting on you',
    detail: `Every order that needed signing off has been dealt with. You are holding ${over}, so the next one lands here.`,
  };
}
