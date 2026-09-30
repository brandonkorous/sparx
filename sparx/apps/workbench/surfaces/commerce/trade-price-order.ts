// WHICH WHOLESALE PRICE ACTUALLY GETS CHARGED.
//
// Four kinds of rule can set what a business pays for one product, and only one
// of them wins. The pane lists them in that order and says the order out loud,
// so the whole point of this file is that the sentence and the list cannot
// drift apart from each other — or from the code that does the charging.
//
// ── IT WAS SAYING THE OPPOSITE OF WHAT IT CHARGED ───────────────────────────
//
// The pane said, in its own subtitle: "a price agreed with one business wins
// over a signed agreement". It listed them that way too. `pricingService.resolve`
// does the reverse — it looks for a contract price FIRST and returns the moment
// it finds one, before `resolve_b2b_price()` is consulted at all.
//
// MEASURED 2026-09-19, Juniper Row, with both rules on one variant:
//
//   Loom and Larder, standing price          $72.00   resolve_b2b_price → 7200
//   Loom and Larder, agreed until Mar 2027   $52.00   contract price, returns first
//
// The screen said she was charging $72.00. She was charging $52.00. A wholesale
// screen that reports the wrong price is worse than one that reports none.
// Issue 742. [[feedback_a_promise_in_copy_is_a_contract]]
//
// ── AND THE SERVER IS THE ONE THAT IS RIGHT ─────────────────────────────────
//
// An agreement has a date on it and was signed. A standing price is an ongoing
// arrangement with no promise attached. If a shop agreed $52 until March, $52 is
// what it agreed, and a later standing price must not quietly undo that. So the
// screen was changed to match the server, not the other way round.

/** Strongest first — the order `pricingService.resolve` consults them in. */
export const TRADE_PRICE_STRENGTH = ['agreement', 'one business', 'a group'] as const;

/**
 * The subtitle over the list, and the list's own order. One string, because the
 * two disagreeing is the defect this file was written for.
 */
export const STRENGTH_ORDER_SENTENCE =
  'Listed strongest first: a signed agreement wins for as long as it runs, then a price ' +
  'set for one business, then a whole group’s price.';
