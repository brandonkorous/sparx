// Reading an amount the way a person writes one.
//
// The payment box took `Number(text)`, which knows exactly one spelling of
// money: `8.50`. Everything else a real person types — `8,50`, `$8.00`,
// `1,250.00`, a trailing space off the numpad — comes back NaN, and the only
// thing that happened on screen was the Write it down button going grey with
// nothing said. She has no way to learn what it wanted.
//
// It was also too generous at the other end: `1e9` is a finite positive number,
// so a billion dollars against an eight dollar order was accepted without a
// word, and `0.001` was written down as a payment of nothing.

/** An amount, or the reason it could not be read. Exactly one is set. */
export interface MoneyReading {
  /** Whole currency units, rounded to the cent. */
  readonly amount: number | null;
  /** What to say to her — never the parser's vocabulary. */
  readonly problem: string | null;
}

export interface ReadMoneyOptions {
  /** Whether nothing is a legitimate answer. A price of zero is (a free item, a
   *  discount not yet set); a payment of zero is not, so refusing is the
   *  default and a field that prices things opts in. */
  readonly allowZero?: boolean;
}

const CURRENCY_MARKS = /[$£€¥₹₽\s\u00a0\u202f]/g;

/**
 * Which of `.` and `,` is the decimal point in this text.
 *
 * Both present: the LAST one separates the cents and the other groups the
 * thousands, which is true of `1,250.00` and of `1.250,00` alike. One present:
 * two digits after it is cents (`8,50`), three is a thousands group (`1,250`),
 * and anything else is a decimal point somebody typed loosely.
 */
function decimalMark(text: string): '.' | ',' | null {
  const dot = text.lastIndexOf('.');
  const comma = text.lastIndexOf(',');
  if (dot >= 0 && comma >= 0) return dot > comma ? '.' : ',';
  if (dot < 0 && comma < 0) return null;
  const mark = dot >= 0 ? '.' : ',';
  const tail = text.slice(text.lastIndexOf(mark) + 1);
  if (tail.length === 3 && text.split(mark).length === 2 && mark === ',') return null;
  return mark;
}

/** Digits only, with one `.` where the cents begin. */
function normalize(text: string): string {
  const mark = decimalMark(text);
  if (mark === null) return text.replace(/[.,]/g, '');
  const cut = text.lastIndexOf(mark);
  const whole = text.slice(0, cut).replace(/[.,]/g, '');
  return `${whole}.${text.slice(cut + 1)}`;
}

/**
 * An amount as she wrote it.
 *
 * Exponent form is refused on purpose: `1e9` is a slip on a keyboard, never a
 * price, and the alternative is a billion dollars going in silently.
 */
/**
 * Digits with at most one `.` → whole cents, by STRING arithmetic.
 *
 * Not `Math.round(Number(x) * 100)`. That shortcut is wrong for three-decimal
 * input — `Number('0.145') * 100` is 14.499999999999998, so it rounds DOWN to
 * 14¢ — and a form is exactly where somebody types one. The spending form did
 * this arithmetic correctly in a parser of its own while reading "46,80" as
 * four thousand six hundred and eighty dollars (issue 488); the two halves
 * belong in one place, which is here.
 */
function exactCents(text: string): number | null {
  const negative = text.startsWith('-');
  const unsigned = negative ? text.slice(1) : text;
  if (!/^\d*\.?\d*$/.test(unsigned) || !/\d/.test(unsigned)) return null;
  const [whole = '', fraction = ''] = unsigned.split('.');
  const wholeCents = (whole === '' ? 0 : Number(whole)) * 100;
  if (!Number.isSafeInteger(wholeCents)) return null;
  const cents = Number(`${fraction}00`.slice(0, 2));
  const roundUp = Number(fraction[2] ?? '0') >= 5 ? 1 : 0;
  const total = wholeCents + cents + roundUp;
  return negative ? -total : total;
}

export function readMoney(text: string, options?: ReadMoneyOptions): MoneyReading {
  const cleaned = text.replace(CURRENCY_MARKS, '');
  if (cleaned === '') return { amount: null, problem: null };
  if (!/^-?[\d.,]+$/.test(cleaned)) {
    return { amount: null, problem: 'That does not look like an amount. Try something like 8.50.' };
  }
  const cents = exactCents(normalize(cleaned));
  if (cents === null) {
    return { amount: null, problem: 'That does not look like an amount. Try something like 8.50.' };
  }
  if (cents < 0) return { amount: null, problem: 'An amount cannot be less than nothing.' };
  if (cents === 0 && options?.allowZero !== true) {
    return { amount: null, problem: 'That comes to nothing, so there is nothing to write down.' };
  }
  return { amount: cents / 100, problem: null };
}

/**
 * The settled two-decimal form, for showing back once she leaves the field.
 *
 * Text that could not be read is handed back UNCHANGED. Replacing it with 0.00
 * is what a `<input type="number">` money field did for years: `8,50` reached
 * `onChange` as the empty string, was reported upward as zero, and settled to
 * "0.00" — a price silently becoming free.
 */
export function settleMoney(text: string, options?: ReadMoneyOptions): string {
  const { amount } = readMoney(text, options);
  return amount === null ? text : amount.toFixed(2);
}

/**
 * The text a money FIELD should hold for an amount already stored.
 *
 * `MoneyTextInput` settles itself on BLUR, and only on blur, so whatever a
 * screen seeds it with is what an operator reads until they click into it.
 * "Spending limits" seeded `(minAmountCents / 100).toString()` and the list one
 * screen away printed the same number through `formatCents`: one said
 * **$200.00**, the other said **200**. On a supplier bill it is worse -
 * `(123450 / 100).toString()` is `"1234.5"`, ONE decimal, beside an invoice
 * that says 1,234.50.
 *
 * MEASURED 2026-09-19 across both consoles: 18 places seed a money field from a
 * stored amount, 10 settled and 8 did not, in the same four files each side.
 *
 * Lives here rather than beside the component because the component is a
 * `.tsx` and the guard that keeps this rule is a `.ts` test - importing across
 * that line is a transform error, not a type error, so it fails as "no tests
 * found". Same reason `provenance-copy.ts` sits apart from its pane.
 * [[feedback_the_empty_control_is_the_untested_one]]
 */
export function moneyText(cents: number): string {
  return (Number.isFinite(cents) ? cents / 100 : 0).toFixed(2);
}

/**
 * The text a money field should hold for an amount that may not be set at all.
 *
 * Blank rather than "0.00", because the two mean different things on a field
 * that can be left empty: an answer that adds nothing to the price is 0, and an
 * answer nobody has priced is nothing at all. `moneyText` above cannot say the
 * second, so a field that can be empty uses this one.
 */
export function optionalMoneyText(cents: number | undefined): string {
  return cents === undefined ? '' : moneyText(cents);
}

/**
 * The text `MoneyInput` shows for an amount in whole units, settled to the cent.
 *
 * Null is NOTHING ENTERED and shows as an empty box. The Pricing tab could not
 * say that: it drew `value={cost ?? 0}`, so 777 versions with no cost on record
 * each read 0.00, a cost of nothing presented as a measured one (sparx persona
 * issue 086). [[feedback_never_present_absence_as_measurement]]
 */
export function moneyFieldText(value: number | null): string {
  return value === null ? '' : value.toFixed(2);
}

/**
 * What one keystroke in `MoneyInput` should report upward, or null to report
 * nothing.
 *
 * `blank` is what an empty box means: 0 for an amount every record has (a
 * price, where an empty box is a running total of nothing), null for one that
 * can be missing (a cost nobody has entered). A typed 0 is 0 either way, which
 * is the half the Pricing tab got wrong: it mapped a typed 0 to "not set", so a
 * part that really cost nothing could never be recorded as one.
 *
 * Half-typed text reports nothing rather than zero, so a total does not drop to
 * nothing mid-word on the way from "8," to "8,50".
 */
export function readMoneyField(
  text: string,
  options: { readonly blank: 0 | null }
): { readonly value: number | null } | null {
  if (text.trim() === '') return { value: options.blank };
  const { amount } = readMoney(text, { allowZero: true });
  return amount === null ? null : { value: amount };
}

/** Both readings of what was typed into a money field whose owner stores CENTS. */
export interface CentsReading {
  /** What to store. Undefined means nothing is set. */
  readonly cents: number | undefined;
  /** What to say, or null when there is nothing wrong. Blank is not wrong. */
  readonly problem: string | null;
}

/**
 * What a typed amount means to an owner that stores cents rather than the text.
 *
 * Text that cannot be read keeps the amount ALREADY STORED and returns the
 * sentence to show. The alternative is what the two build editors did: an
 * unreadable amount was coerced to "no change to the price", so a slip halfway
 * through typing wrote a price nobody meant and said nothing about it.
 * [[feedback_never_present_absence_as_measurement]]
 */
export function readCents(text: string, stored: number | undefined): CentsReading {
  if (text.trim() === '') return { cents: undefined, problem: null };
  const { amount, problem } = readMoney(text, { allowZero: true });
  if (amount === null) return { cents: stored, problem };
  return { cents: Math.round(amount * 100), problem: null };
}
