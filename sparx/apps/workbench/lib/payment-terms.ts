// How long a business you supply has to pay you.
//
// ── WHY THIS IS ONE FILE AND NOT A MENU IN EACH PANE ────────────────────────
//
// Payment terms are ONE column on ONE record (`Company.paymentTerms`), and two
// panes edit it: Customers › Companies, and the B2B module's trade account.
// They each carried their own hardcoded list, and the lists disagreed —
// Companies offered `net15`, the trade pane did not. So a company set to 15 days
// in one screen read back as **"No terms set"** in the other, which is not a
// display quirk: it is the screen reporting that no agreement exists when one
// does, about money somebody is owed.
//
// ── AND WHY IT IS NOT A FIXED LIST AT ALL ───────────────────────────────────
//
// Terms are what two businesses AGREED, not what a dropdown offers. A bakery
// supplying two cafés on **Net 14** could not record that: the choices were 15,
// 30, 60, 90. Rounding it to 15 puts a wrong due date on a real invoice and
// mis-ages a real debt, and nothing on the screen admits it happened.
//
// The column is `VarChar(20)` and `netTermsDays()` in @wizeworks/crm already
// parses whatever digits it finds, so any `netN` has always worked end to end.
// The only thing standing in the way was a zod enum and two menus.
//
// `''` (no agreed terms) and `prepay` are genuinely different from a day count:
// the first is "we never agreed anything", the second is "before it leaves".
// Neither is a number of days and neither is zero days.

/** The common agreements, offered first so the usual case stays one click. */
export const PAYMENT_TERM_PRESETS: { value: string; label: string }[] = [
  { value: 'prepay', label: 'Pay before dispatch' },
  { value: 'net7', label: '7 days to pay' },
  { value: 'net14', label: '14 days to pay' },
  { value: 'net15', label: '15 days to pay' },
  { value: 'net30', label: '30 days to pay' },
  { value: 'net45', label: '45 days to pay' },
  { value: 'net60', label: '60 days to pay' },
  { value: 'net90', label: '90 days to pay' },
];

/** The sentinel the picker uses for "a different number of days". Never stored —
 *  choosing it reveals the days box, and what gets saved is `netN`. */
export const PAYMENT_TERMS_CUSTOM = 'custom';

/** Longest agreement anyone is plausibly writing down. A year of credit is a
 *  typo, and a four-digit day count would silently become a due date in 2031. */
export const MAX_TERM_DAYS = 365;

/** Days from a stored value, or null when it is not a day count at all —
 *  `prepay` and "nothing agreed" are both real answers that are not zero days. */
export function paymentTermsDays(terms: string | null | undefined): number | null {
  if (!terms) return null;
  const match = /^net(\d+)$/.exec(terms.trim().toLowerCase());
  if (!match) return null;
  const days = Number(match[1]);
  return days > 0 && days <= MAX_TERM_DAYS ? days : null;
}

export function termsFromDays(days: number): string {
  return `net${String(Math.round(days))}`;
}

/**
 * What the terms say, in words, for ANY stored value.
 *
 * Derived rather than looked up, so a term nobody put in the preset list still
 * reads as itself. A lookup that falls through to "No terms set" is the bug this
 * file exists to stop.
 */
export function paymentTermsLabel(terms: string | null | undefined): string {
  if (!terms) return 'No agreed terms';
  if (terms === 'prepay') return 'Pay before dispatch';
  const days = paymentTermsDays(terms);
  return days === null ? terms : `${String(days)} days to pay`;
}

/** True when the value is real but not one of the presets — the state the days
 *  box has to open in, or the picker would silently re-round it on first edit. */
export function isCustomTerm(terms: string | null | undefined): boolean {
  if (!terms) return false;
  if (PAYMENT_TERM_PRESETS.some((preset) => preset.value === terms)) return false;
  return paymentTermsDays(terms) !== null;
}
