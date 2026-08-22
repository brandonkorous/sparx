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
export function readMoney(text: string, options?: ReadMoneyOptions): MoneyReading {
  const cleaned = text.replace(CURRENCY_MARKS, '');
  if (cleaned === '') return { amount: null, problem: null };
  if (!/^-?[\d.,]+$/.test(cleaned)) {
    return { amount: null, problem: 'That does not look like an amount. Try something like 8.50.' };
  }
  const value = Number(normalize(cleaned));
  if (!Number.isFinite(value)) {
    return { amount: null, problem: 'That does not look like an amount. Try something like 8.50.' };
  }
  if (value < 0) return { amount: null, problem: 'An amount cannot be less than nothing.' };
  const cents = Math.round(value * 100);
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
