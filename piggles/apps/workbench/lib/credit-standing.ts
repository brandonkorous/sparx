// What a trade account's credit actually says — one answer, six screens.
//
// ── WHAT A ZERO MEANS, WHICH IS NOT WHAT IT LOOKS LIKE ───────────────────────
//
// `companies.credit_limit` is `NUMERIC NOT NULL DEFAULT 0`, so a company nobody
// has given a limit carries a zero. That zero is not a blank. The checkout
// enforces the limit as a plain subtraction:
//
//     const available = Number(account.creditLimit) - Number(account.creditUsed);
//     if (orderDollars > available) throw …'your account has no credit left'
//
// (wizeworks/packages/commerce/src/services/checkout-service.ts). With a limit
// of zero, `available` is zero or negative, so EVERY order on payment terms is
// refused. A zero does not mean "no ceiling recorded". It means this business
// may not buy on terms at all.
//
// MEASURED 2026-09-25 against the dev database: 11 of 29 companies sit at zero,
// so eleven trade customers are stopped at checkout, and not one screen in
// either console said so.
//
// ── WHAT THE SCREENS SAID INSTEAD ────────────────────────────────────────────
//
// The Customers app's company list printed a flat `$0.00` in a column headed
// "Credit limit", and its header printed
//
//     $1,193.00 of $0.00 used
//
// which is awkward rather than false, and reads to an owner as a rounding
// error. Its editor was worse: it blanks a zero on the way in and offered
// "Leave blank for none", so somebody who never touched the field sees an empty
// box and believes they imposed no restriction. The trade app's list was
// falsest of all — it printed "No credit set" and dropped the outstanding
// balance on the floor.
//
// Four readers elsewhere guard on `> 0` (the trade list, the trade editor, the
// segment projection, the credit-utilization trigger) and that guard is right
// for arithmetic — a percentage of zero is not a number. It is not a licence to
// describe a zero as an absence, and copying it is how this file got written
// the wrong way round the first time.
//
// ── THE THIRD STATE ──────────────────────────────────────────────────────────
//
// Two branches cannot say this, whichever two are picked, because an account
// can be blocked from terms AND still owe money from before it was. One company
// in the database is exactly there: $1,193 outstanding, nothing more allowed.
//
//   'limit'    a ceiling is recorded — say how much of it is used
//   'owing'    no credit on terms, money still outstanding — say both
//   'noTerms'  no credit on terms, nothing outstanding — say that plainly
//
// ── WHY THE WORDS ARE NOT IN HERE ────────────────────────────────────────────
//
// A list cell has a column to sit in, a toolbar has a sentence, and a field
// description is talking to somebody halfway through typing. They need the same
// FACT and different words for it. This file settles the fact; each screen says
// it in its own register. What it must never do is let two screens disagree
// about which of the three is true.

/** Which of the three things this account's credit is saying. */
export type CreditStanding = 'limit' | 'owing' | 'noTerms';

/**
 * Read an account's credit standing.
 *
 * Both arguments must be in the SAME unit — cents and cents, or dollars and
 * dollars. Nothing here converts, on purpose: the two callers store money
 * differently (the trade app in integer cents, the Customers app in decimal
 * strings), and a helper that guessed which it had been handed would be one
 * rename away from reporting a $50 limit as $5,000.
 *
 * Anything unreadable counts as zero, which is what the checkout would do with
 * it: `Number('')` is `NaN`, `NaN` fails every comparison, and the order is
 * refused. A display helper must not throw, and it must not be cheerier than
 * the till.
 */
export function creditStanding(
  limit: number | string | null | undefined,
  used: number | string | null | undefined
): CreditStanding {
  const l = amount(limit);
  const u = amount(used);
  if (l > 0) return 'limit';
  if (u > 0) return 'owing';
  return 'noTerms';
}

function amount(value: number | string | null | undefined): number {
  const n = typeof value === 'string' ? Number(value) : (value ?? 0);
  return Number.isFinite(n) ? n : 0;
}
