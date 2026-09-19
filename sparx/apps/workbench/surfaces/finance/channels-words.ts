// What "Where money comes from" says above its numbers.
//
// The pane leads with money RECEIVED, and that is the right headline: it is the
// money the business actually has. But it sat alone beside a sales figure four
// times its size, and the reader was left to work out the difference. On one
// real shop the headline read $535.00 against $2,350.50 sold, and the $1,603.50
// between them — seven orders nobody had paid for — appeared nowhere on the
// screen, in any column, at any width.
//
// So the subtitle finishes the sentence the headline starts. It says what else
// happened to the money, and it says nothing at all when nothing else did: a
// shop that is paid on the spot for everything it sells should not be handed a
// line about debt it does not have.

/** The seven numbers behind the pane, already summed. */
export interface TakingsMeasurement {
  /** Orders counted, cancelled ones excluded. */
  orders: number;
  /** How many channels have a row. */
  places: number;
  /** Order value placed. */
  gross: number;
  /** Money actually received. */
  net: number;
  refunds: number;
  /** Sold, not refunded, not paid for. */
  owed: number;
}

/** Formats an amount the way the pane does. Passed in so this stays pure. */
export type Money = (amount: number) => string;

/** "from 14 orders across 2 places" — always true, always shown. */
export function ordersLine(m: TakingsMeasurement): string {
  const orders = m.orders === 1 ? '1 order' : `${String(m.orders)} orders`;
  const places = m.places === 1 ? '1 place' : `${String(m.places)} places`;
  return `from ${orders} across ${places}`;
}

/**
 * What happened to the rest of the money, or null when nothing did.
 *
 * SCOPED TO THIS TABLE, deliberately. "Owed to you" is a pane of its own,
 * counting invoices across all time, and it will not agree with this figure:
 * this one is orders, through these channels, inside the window the reader
 * picked. Two numbers on two screens both saying "you are owed" invite the
 * question of which is right, so this one says "of these sales" and stays
 * inside the table it belongs to.
 *
 * Null rather than "$0.00 is owed" on purpose. A line saying nothing happened
 * is a line the reader still has to read, and on a shop that takes payment at
 * the till it would be on the screen every day saying nothing.
 */
export function unreceivedLine(m: TakingsMeasurement, money: Money): string | null {
  const owed = m.owed > 0;
  const refunded = m.refunds > 0;
  if (!owed && !refunded) return null;

  // Two facts, two sentences. Joining them with "and" makes one long clause
  // where the second number reads as part of the first.
  const parts: string[] = [];
  if (owed) parts.push(`Another ${money(m.owed)} of these sales has not been paid for yet.`);
  if (refunded) parts.push(`${money(m.refunds)} was refunded.`);
  return parts.join(' ');
}

/**
 * Whether the owed figure is big enough to be the thing she does next.
 *
 * Money owed is normal in a business that invoices; money owed that dwarfs
 * money received is a collections problem wearing a sales report. The test is
 * against what was RECEIVED, not against what was sold: a shop owed $2,000 on
 * $40,000 of takings is fine, and one owed $2,000 on $500 is not, and the sales
 * figure cannot tell those apart.
 */
export function owedOutweighsTakings(m: TakingsMeasurement): boolean {
  return m.owed > 0 && m.owed > m.net;
}
