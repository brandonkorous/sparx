// The sentences on the screen where a repeat order is set up.
//
// Pure functions over plain values, because every one of these is a promise a
// shop owner reads out to a customer on the phone. "First delivery on the 19th,
// then every month" is a thing she will be held to, so it is covered by a test
// rather than by having been looked at once.
//
// The two numbers these sentences quote - what it is worth a month, and when the
// first delivery falls - are NOT computed here. They come from
// `repeatOrderMonthlyCents` and `nextOccurrenceAfter` in
// @wizeworks/commerce-schemas, the same two functions the server uses when it
// stores the thing. A second copy would let the figure she reads and the figure
// the platform keeps drift apart, and hers is the one she would never doubt.

import { nextOccurrenceAfter, repeatOrderMonthlyCents } from '@wizeworks/commerce-schemas';

export type RepeatUnit = 'day' | 'week' | 'month' | 'year';

/* -- The cadence, in words ----------------------------------------------- */

/**
 * "every month", "every 2 weeks" - the cadence as she would say it out loud.
 *
 * Never "monthly" or "bi-weekly": one of those is a word for a schedule and the
 * other means two different things to two different people.
 */
export function cadencePhrase(unit: RepeatUnit, count: number): string {
  const n = Math.max(1, Math.round(count));
  if (n === 1) return `every ${unit}`;
  return `every ${String(n)} ${unit}s`;
}

/** The same phrase where a sentence starts: "Every 2 weeks". */
export function cadenceOpener(unit: RepeatUnit, count: number): string {
  const phrase = cadencePhrase(unit, count);
  return phrase.charAt(0).toUpperCase() + phrase.slice(1);
}

/* -- What is on it ------------------------------------------------------- */

export interface RepeatLine {
  unitPriceCents: number;
  quantity: number;
}

/**
 * What goes out each time, and what that comes to.
 *
 * The prompt at zero lines names the thing to do rather than the thing that is
 * missing - an empty list is the start of the job, not a fault.
 */
export function eachTimeNote(
  lines: readonly RepeatLine[],
  money: (cents: number) => string
): string {
  if (lines.length === 0) {
    return 'Pick what goes out each time. Everything here is sent on every delivery.';
  }
  const each = lines.reduce(
    (sum, line) => sum + Math.max(0, line.unitPriceCents) * Math.max(0, line.quantity),
    0
  );
  const things = lines.reduce((sum, line) => sum + Math.max(0, line.quantity), 0);
  const noun = things === 1 ? 'One thing goes out' : `${String(things)} things go out`;
  return `${noun} each time, coming to ${money(each)}.`;
}

/* -- What it is worth ---------------------------------------------------- */

export interface WorthInput {
  lines: readonly RepeatLine[];
  unit: RepeatUnit;
  count: number;
  money: (cents: number) => string;
}

/**
 * What this repeat order brings in per month - the figure the whole area is
 * measured in, said before she agrees to it rather than after.
 *
 * A monthly cadence says nothing extra, because "$58.00 a month, which is
 * $58.00 a month" is noise. Every other cadence earns the sentence, because
 * "every 2 weeks" and "a month" are not the same length and the difference is
 * the entire point of the number.
 */
export function worthNote(input: WorthInput): string | null {
  if (input.lines.length === 0) return null;
  const monthly = repeatOrderMonthlyCents({
    lines: input.lines,
    intervalUnit: input.unit,
    intervalCount: input.count,
    deliveriesPerCycle: 1,
  });
  if (monthly <= 0) return null;
  if (input.unit === 'month' && input.count === 1) {
    return `Worth ${input.money(monthly)} a month while it runs.`;
  }
  return `Sent ${cadencePhrase(input.unit, input.count)}, that is worth about ${input.money(monthly)} a month while it runs.`;
}

/* -- When it actually happens -------------------------------------------- */

export interface ScheduleInput {
  startAt: Date;
  unit: RepeatUnit;
  count: number;
  /** Renders a date the way the rest of the console does. */
  day: (date: Date) => string;
}

/**
 * When the first delivery falls.
 *
 * This sentence exists because the answer is surprising and silence would be
 * read as "today": a repeat order started now does NOT go out now. The first
 * delivery is one whole interval later, which is right - she is setting up the
 * repeat, and today's order is today's order - but nobody would guess it, and a
 * shop owner who guessed wrong has told a customer the wrong week.
 */
export function firstDeliveryNote(input: ScheduleInput): string {
  const first = nextOccurrenceAfter(input.startAt, input.unit, input.count);
  if (!first) return 'Choose how often this goes out.';
  return `First delivery ${input.day(first)}, then ${cadencePhrase(input.unit, input.count)} after that. Nothing goes out today, so if they want one now take that as an ordinary sale.`;
}

/* -- How it gets paid ---------------------------------------------------- */

/**
 * How the money arrives, and what she has to do about it.
 *
 * Only ONE answer is offered from here, deliberately. Charging a saved card
 * needs a card the customer put in themselves on a checkout - it is not a thing
 * a shop owner can set up on their behalf from a back office, and a screen that
 * implied she could would be inviting her to read a card number down the phone.
 *
 * It does NOT promise a payment link. Whether the bill carries one depends on
 * the gateway this shop takes money through, and a shop paid by bank transfer
 * has none. Promising a link she cannot produce would be a sentence her customer
 * reads and she cannot honour.
 */
export function paidNote(customerName: string | null): string {
  const who = customerName ?? 'the customer';
  return `Each delivery is billed to ${who} and emailed to them, the same as any other bill you send. Nothing is charged automatically, so nobody has to hand you a card number.`;
}

/* -- Whether it can be saved --------------------------------------------- */

export interface RepeatOrderFacts {
  customerChosen: boolean;
  lineCount: number;
  addressChosen: boolean;
  count: number;
  /** Every line carries a price that reads as a number. */
  everyLinePriced: boolean;
}

/**
 * The one thing still missing, named - or nothing, when it is ready.
 *
 * ONE at a time and in the order the form reads, so the sentence under the
 * button always points at the next thing to do rather than listing four.
 */
export function repeatOrderCheck(facts: RepeatOrderFacts): {
  ok: boolean;
  problem: string | null;
} {
  if (!facts.customerChosen) {
    return { ok: false, problem: 'Choose who this is for. A repeat order belongs to somebody.' };
  }
  if (facts.lineCount === 0) {
    return { ok: false, problem: 'Add at least one thing to send each time.' };
  }
  if (!facts.everyLinePriced) {
    return {
      ok: false,
      problem: 'One of the lines has no price on it. Put a number in every one.',
    };
  }
  if (!facts.addressChosen) {
    return {
      ok: false,
      problem:
        'Choose where it goes. Every delivery uses this address, and you can change it later.',
    };
  }
  if (!Number.isFinite(facts.count) || facts.count < 1) {
    return { ok: false, problem: 'How often it goes out has to be at least 1.' };
  }
  return { ok: true, problem: null };
}

/* -- An address, on one line --------------------------------------------- */

export interface AddressFacts {
  line1: string;
  line2?: string | null;
  city: string;
  region?: string | null;
  postalCode?: string | null;
}

/** "12 Juniper Row, Flat 2, Bristol, BS1 4TR" - enough to tell two apart. */
export function addressLine(address: AddressFacts): string {
  return [address.line1, address.line2, address.city, address.region, address.postalCode]
    .map((part) => (part ?? '').trim())
    .filter((part) => part !== '')
    .join(', ');
}

/* -- The order behind a history line ------------------------------------- */

export interface HistoryOrder {
  id: string;
  number: string;
}

/**
 * The order a history line is about, or null when the line is not about one.
 *
 * Every renewal writes `orderId` and `orderNumber` into its event payload, and
 * the history drew neither: the row said "Renewed: an order was placed" and
 * gave no way to reach the order it had just named. The value was already in
 * the component's hand. [[feedback_fetched_but_never_rendered]]
 *
 * `payload` is `unknown` because it is JSON off a database column, so this
 * reads it defensively: an old event written before the fields existed, or one
 * whose shape changed, returns null and the row renders exactly as it used to.
 */
export function historyOrder(payload: unknown): HistoryOrder | null {
  if (typeof payload !== 'object' || payload === null) return null;
  const row = payload as Record<string, unknown>;
  const id = row.orderId;
  const number = row.orderNumber;
  if (typeof id !== 'string' || id === '') return null;
  if (typeof number !== 'string' || number === '') return null;
  return { id, number };
}
