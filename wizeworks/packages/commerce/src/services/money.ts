// Money, written the way a person reads it.
//
// Four places in this package built a money string by hand:
//
//     `$${(cents / 100).toFixed(2)}`
//
// which has no thousands separator, so a wholesale buyer stopped at checkout was
// told "Insufficient credit: $50000.00 available, $52340.00 required". Every
// trade account on the platform carries a credit limit of $10,000, $25,000 or
// $50,000, so that message has never once been readable — the digits a person
// needs to count are exactly the ones the separator is for, and this is the
// screen where someone is being told they cannot buy.
//
// It also hardcodes a dollar sign onto a figure that carries its own currency
// code one field away.
//
// `Intl.NumberFormat` does both, is in every runtime this ships on, and needs no
// dependency. The locale is pinned to `en-US` rather than left to the server's:
// this is a SERVER-rendered string, so "whatever locale the container happens to
// boot with" is not a reader's preference, it is a coin toss. A surface that
// knows its reader formats on the client instead.

/** One formatter per currency — constructing an `Intl.NumberFormat` is the
 *  expensive half, and these strings are built inside request paths. */
const cache = new Map<string, Intl.NumberFormat>();

function formatterFor(currency: string): Intl.NumberFormat {
  const key = currency.toUpperCase();
  const existing = cache.get(key);
  if (existing) return existing;
  let made: Intl.NumberFormat;
  try {
    made = new Intl.NumberFormat('en-US', { style: 'currency', currency: key });
  } catch {
    // An unknown or malformed code. Print the number plainly with the code
    // beside it rather than guessing a symbol — a wrong symbol on a figure is
    // worse than no symbol, because it reads as a fact.
    made = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    cache.set(key, made);
    return made;
  }
  cache.set(key, made);
  return made;
}

/** A whole-currency amount (dollars, not cents) as text. */
export function formatAmount(amount: number, currency = 'USD'): string {
  const formatter = formatterFor(currency);
  const text = formatter.format(amount);
  // The fallback formatter has no currency style, so the code goes on the end.
  return formatter.resolvedOptions().style === 'currency'
    ? text
    : `${text} ${currency.toUpperCase()}`;
}

/** A minor-unit amount (cents) as text. */
export function formatCents(cents: number, currency = 'USD'): string {
  return formatAmount(cents / 100, currency);
}
