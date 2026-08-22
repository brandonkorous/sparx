// The price, in exactly one place.
//
// Exported from `@piggles/config/pricing` and deliberately NOT from the package
// index. `index.ts` states that the console never knows a price (RULE #2), and
// that stays true: anything importing `@piggles/config` gets no route to this
// file. The two surfaces that legitimately STATE a price — the marketing site
// and the account app — reach for the subpath by name, which makes every one of
// them greppable.
//
// Every "$99" a visitor reads resolves here. A price change is this file plus
// `piggles/config/billing-plan.json` (the Stripe catalog), in that order.

/** Dollars a month. The arithmetic form — comparisons, count-ups, receipts. */
export const PRICE_MONTHLY = 99;

/** The prose form. Used inline in copy so a sentence never carries a literal. */
export const PRICE_LABEL = '$99';

/** Days of trial, no card. */
export const TRIAL_DAYS = 14;

// ── FOUNDING MEMBERS ────────────────────────────────────────────────────────
//
// There is no founding-member RATE in this file, and that is the point. The
// offer is a moment, not a plan: it is announced on the header notice, which is
// authored in the WizeWorks admin console and lives in the database, so it can
// be changed or ended without a deploy. Baking a second price into the product
// would make it a second plan, which RULE #2 forbids outright.
//
// What is stable enough to hardcode is the door: where an enquiry goes.

/** Where a founding-member enquiry goes. */
export const FOUNDING_EMAIL = 'hello@meetpiggles.com';

/** `mailto:` for the same, with the subject already written. */
export const FOUNDING_MAILTO = `mailto:${FOUNDING_EMAIL}?subject=${encodeURIComponent(
  'Becoming a founding member'
)}`;
