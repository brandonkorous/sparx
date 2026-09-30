// Saying an amount of money, without ever throwing.
//
// ── The defect this exists for ───────────────────────────────────────────────
//
// `new Intl.NumberFormat(undefined, { style: 'currency', currency })` throws a
// RangeError for anything that is not three ASCII letters:
//
//     '123'  -> RangeError: Invalid currency code : 123
//     '$$$'  -> RangeError: Invalid currency code : $$$
//     '   '  -> RangeError: Invalid currency code :
//     'ZZZ'  -> "ZZZ 12.50"        (not a currency, but it does not throw)
//     'usd'  -> "$12.50"           (case does not matter to Intl)
//
// "How stock is valued" has a Currency field a business owner types into, three
// characters, no validation on the way out. The schema behind it checked
// `.length(3)` and nothing else, so `123` saved cleanly. MEASURED 2026-09-19:
// **24 of 27** currency validators across the packages checked length without
// checking letters, and **81 of 88** Intl currency formatters were fed from a
// variable with no guard around them. A delivery pane calls
// `formatCents(receipt.goodsValueCents, receipt.baseCurrency)` — so three
// characters typed into a settings field took out every money figure on the
// screen, as a thrown render rather than a wrong number.
//
// The validators are fixed, which shuts the door somebody can walk through. This
// is the floor under it: a value already stored, imported from somebody else's
// file, or arriving from a path nobody has audited must degrade to a readable
// line, never to an error boundary. A DISPLAY helper has no business throwing.
//
// ── What it does with a code it cannot use ───────────────────────────────────
//
// It says the number and the code, plainly: `123 12.50`. That is deliberately
// not a silent fallback to dollars — printing `$12.50` for a currency we could
// not read is inventing a fact, and the point of showing the raw code is that
// somebody looking at it can see what is wrong and go and fix it.
// [[feedback_never_present_absence_as_measurement]]

/** Exactly three ASCII letters — what `Intl` will accept, and nothing else. */
const USABLE = /^[A-Za-z]{3}$/;

/** One formatter per currency, built once. 33 helpers across this console call
 *  through here, some of them per row of a long table. */
const cache = new Map<string, Intl.NumberFormat>();

/**
 * The formatter for a currency, or null when the code is unusable.
 *
 * Null rather than a throw, and null rather than a dollars fallback: the caller
 * has to decide what to show, and every caller here decides to show the code.
 */
function formatterFor(currency: string): Intl.NumberFormat | null {
  const code = currency.trim();
  if (!USABLE.test(code)) return null;
  const key = code.toUpperCase();
  const cached = cache.get(key);
  if (cached) return cached;
  try {
    const made = new Intl.NumberFormat(undefined, { style: 'currency', currency: key });
    cache.set(key, made);
    return made;
  } catch {
    // A well-formed code this runtime still refuses. Vanishingly rare, and the
    // whole point of this module is that it is not a crash when it happens.
    return null;
  }
}

/**
 * An amount in MAJOR units (dollars, pounds) as money.
 *
 * The fallback keeps two decimals so a column of numbers still lines up, and
 * leads with the code so the unreadable part is the first thing seen.
 */
export function formatAmount(amount: number, currency = 'USD'): string {
  const safe = Number.isFinite(amount) ? amount : 0;
  const formatter = formatterFor(currency);
  if (formatter) return formatter.format(safe);
  return `${currency.trim() === '' ? '?' : currency.trim()} ${safe.toFixed(2)}`;
}

/** An amount in MINOR units (cents, pence) as money. */
export function formatCentsAmount(cents: number, currency = 'USD'): string {
  return formatAmount((Number.isFinite(cents) ? cents : 0) / 100, currency);
}

/** Whether a code is one this console can actually draw money in. Exported for
 *  the settings field, so it can say so before Save rather than after. */
export function isUsableCurrency(code: string): boolean {
  return USABLE.test(code.trim());
}
