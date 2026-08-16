// The ten things a small business is usually paying for separately, and the
// arithmetic that turns what somebody types into what the receipt says.
//
// ── NO PRICE BUT OURS ───────────────────────────────────────────────────────
//
// There is not a single dollar figure in this file except $49. Every other
// number on the section comes from the person reading it. A calculator that
// arrives pre-filled with plausible market prices is a calculator that has
// already decided its own answer, and this page's whole argument is that nothing
// here is rigged — the same reason two-questions.tsx refuses to put a figure on
// an individual app.
//
// The names in `like` are the nine instead-of.tsx already names on Brandon's
// instruction, and no others. They are RECOGNITION, not endorsement: "Turning up
// in search" is not a phrase anybody has on a bank statement, so the row needs
// something a reader can match against theirs. Their prices are not ours to
// publish and change weekly anyway.

export interface BillRow {
  id: BillId;
  /** What the thing DOES, because that is how somebody thinks about it. */
  label: string;
  /** A name they might know it by. Nine of the ten have one. */
  like?: string;
}

export type BillId =
  | 'website'
  | 'search'
  | 'selling'
  | 'customers'
  | 'email'
  | 'bookings'
  | 'invoices'
  | 'books'
  | 'stock'
  | 'other';

export const BILL_ROWS: BillRow[] = [
  { id: 'website', label: 'Your website', like: 'Squarespace, WordPress' },
  { id: 'search', label: 'Turning up in search', like: 'Semrush' },
  { id: 'selling', label: 'Selling online', like: 'Shopify' },
  { id: 'customers', label: 'Keeping track of customers', like: 'HubSpot' },
  { id: 'email', label: 'Sending email to customers', like: 'Mailchimp' },
  { id: 'bookings', label: 'Taking bookings', like: 'Calendly' },
  { id: 'invoices', label: 'Invoicing and getting paid', like: 'FreshBooks' },
  { id: 'books', label: 'Your books', like: 'QuickBooks' },
  { id: 'stock', label: 'What you have in stock', like: 'a spreadsheet' },
  { id: 'other', label: 'Anything else you pay for' },
];

/** Ticked, and how much — two separate facts. Somebody who knows they pay for a
 *  website but not what it costs still has a bill, and the count of bills is
 *  half the argument. */
export interface Bill {
  on: boolean;
  amount: string;
}

export type Bills = Record<BillId, Bill>;

export const EMPTY_BILLS: Bills = Object.fromEntries(
  BILL_ROWS.map((row) => [row.id, { on: false, amount: '' }])
) as Bills;

/** One plan, one price. Local, as two-questions.tsx keeps it — `PRODUCT` carries
 *  hosts and names, not commercial terms. */
export const PRICE = 49;

const WEEKS = 52;

export interface Figures {
  /** How many things they are paying for. Works with no amounts typed. */
  bills: number;
  /** How many of those they put a number against. */
  priced: number;
  monthly: number;
  yearly: number;
  /** What the hours cost them a year. `null` until both halves are given. */
  hoursYearly: number | null;
  /** Their monthly total less $49. Negative when Piggles is the dearer one. */
  difference: number;
}

/**
 * "$49", "$1,234.50".
 *
 * Not tools/lib's `formatMoney`, which always prints two decimals: "$49.00"
 * contradicts every other statement of the price on this site, and the price is
 * the one figure here that has to match the rest of the page exactly. Cents
 * appear only when there are cents.
 */
export function usd(n: number): string {
  const digits = Number.isInteger(n) ? 0 : 2;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(n);
}

/** Spelled, and carrying its own plural.
 *
 *  Spelled because the panel is already full of figures and "9 bills" would read
 *  as one more of them; this line is prose. Plural because every sentence in the
 *  receipt has to survive a reader who ticks exactly one box — "one things that
 *  have never spoken to each other" is how a page stops sounding written. */
const WORDS = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];

export const count = (n: number, one: string, many: string) =>
  `${WORDS[n] ?? String(n)} ${n === 1 ? one : many}`;

/** The same, starting a sentence. */
export function countCap(n: number, one: string, many: string): string {
  const said = count(n, one, many);
  return said[0]!.toUpperCase() + said.slice(1);
}

/** What somebody typed, as a number. Strips the currency sign and the commas,
 *  because "$29.99" pasted off a bank statement is the commonest way this field
 *  gets filled in and rejecting it would be the tool's fault, not theirs. */
export const amountOf = (value: string) => {
  const n = Number(value.replace(/[^0-9.]/g, ''));
  return Number.isFinite(n) && n > 0 ? n : 0;
};

export function figures(bills: Bills, hours: string, rate: string): Figures {
  const on = BILL_ROWS.map((row) => bills[row.id]).filter((bill) => bill.on);
  const monthly = on.reduce((sum, bill) => sum + amountOf(bill.amount), 0);
  const hoursNum = amountOf(hours);
  const rateNum = amountOf(rate);

  return {
    bills: on.length,
    priced: on.filter((bill) => amountOf(bill.amount) > 0).length,
    monthly,
    yearly: monthly * 12,
    hoursYearly: hoursNum > 0 && rateNum > 0 ? hoursNum * rateNum * WEEKS : null,
    difference: monthly - PRICE,
  };
}
