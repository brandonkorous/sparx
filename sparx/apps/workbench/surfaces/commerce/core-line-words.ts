// What a core on one order line SAYS, and which moves it offers (sparx persona
// issues 051 and 057).
//
// A rebuilt part is bought one of two ways. With a deposit: the part ships now
// and the deposit comes back with the old part. Or by sending the old part FIRST:
// nothing is paid, and the part ships when the old one arrives. The two read
// differently everywhere a core shows, and they offer different moves: there is
// no deposit to keep on a line that never took one, and nothing to hold on a line
// that already shipped.
//
// The order pane and the Cores owed list both read this module, so the same line
// offers the same buttons in the same words from either screen.

import { formatMoney, type OrderItem } from './data';
import type { CoreLine, CoreOwed } from './cores-data';

export type CoreMove = 'receive' | 'keep' | 'release';
export type CoreTone = 'success' | 'warning' | 'info';

export function plural(count: number, one: string, many: string): string {
  return `${String(count)} ${count === 1 ? one : many}`;
}

/** The moves this line offers, in the order the buttons are drawn. */
export function coreMoves(line: CoreLine): CoreMove[] {
  if (!line.coreFirst) return line.owed > 0 ? ['receive', 'keep'] : [];
  const moves: CoreMove[] = [];
  if (line.owed > 0) moves.push('receive');
  if (line.waiting > 0 && !line.released) moves.push('release');
  return moves;
}

export function moveLabel(line: CoreLine, move: CoreMove): string {
  switch (move) {
    case 'receive':
      return line.coreFirst ? 'Old part arrived' : 'Core came back';
    case 'keep':
      return 'Keep deposit';
    case 'release':
      return "Don't wait for the old part";
  }
}

/** Where this line's core stands, as state badges. */
export function coreBadges(line: CoreLine): { label: string; tone: CoreTone }[] {
  if (!line.coreFirst) {
    return line.owed > 0
      ? [{ label: `${plural(line.owed, 'core', 'cores')} still owed`, tone: 'warning' }]
      : [{ label: 'Cores settled', tone: 'success' }];
  }
  if (line.owed === 0) {
    return [{ label: line.quantity === 1 ? 'Old part in' : 'Old parts in', tone: 'success' }];
  }
  if (line.released) {
    return [
      { label: 'Not waiting for the old part', tone: 'info' },
      { label: `${plural(line.owed, 'old part', 'old parts')} still to come`, tone: 'warning' },
    ];
  }
  if (line.waiting > 0) {
    return [
      {
        label: `${plural(line.waiting, 'part waits', 'parts wait')} for the old part`,
        tone: 'warning',
      },
    ];
  }
  return [
    { label: `${plural(line.owed, 'old part', 'old parts')} still to come`, tone: 'warning' },
  ];
}

/** The line under a part on the order: what kind of core it carries, and what
 *  has come of it so far. */
export function coreSummary(item: OrderItem, currency: string): string {
  if (item.coreFirst) {
    // Once the business chose not to wait, "held until" is no longer true, and the
    // badge beside this already says "Not waiting for the old part" (issue 057).
    const head =
      item.coreHoldReleasedAt !== null
        ? 'Old part first, no deposit. You chose not to wait for it.'
        : 'Old part first, no deposit. Held until the old part arrives.';
    return item.coresReturned > 0
      ? `${head} ${plural(item.coresReturned, 'old part', 'old parts')} in so far.`
      : head;
  }
  const settled = [
    item.coresReturned > 0 ? `${plural(item.coresReturned, 'core', 'cores')} back` : null,
    item.coresKept > 0 ? `${plural(item.coresKept, 'deposit', 'deposits')} kept` : null,
  ].filter(Boolean);
  const head = `Core deposit ${String(item.quantity)} × ${formatMoney(item.coreCharge ?? 0, currency)}`;
  return settled.length > 0 ? `${head} · ${settled.join(' · ')}` : head;
}

/** The "Deposit back" cell on the Cores owed list. A send-first line holds no
 *  deposit, and "$0.00" would read as a deposit of nothing that is owed back. */
export function depositBackText(row: CoreOwed): string {
  return row.coreFirst ? 'No deposit' : formatMoney(row.owedCents / 100, row.currency);
}

/** The sentence above the Cores owed list. */
export function coresSummary(rows: CoreOwed[], limit: number): string {
  const cores = rows.reduce((sum, row) => sum + row.coresOwed, 0);
  const parts = [
    `${plural(cores, 'core', 'cores')} owed on ${plural(rows.length, 'order line', 'order lines')}.`,
  ];
  // Summed per currency so a second one can never be added into the first.
  const owedByCurrency = new Map<string, number>();
  for (const row of rows) {
    if (row.coreFirst) continue;
    owedByCurrency.set(row.currency, (owedByCurrency.get(row.currency) ?? 0) + row.owedCents);
  }
  const money = [...owedByCurrency.entries()]
    .filter(([, cents]) => cents > 0)
    .map(([currency, cents]) => formatMoney(cents / 100, currency));
  if (money.length > 0) {
    parts.push(`If every deposit came back, you would give back ${money.join(' and ')}.`);
  }
  const waiting = rows.reduce((sum, row) => sum + row.waitingToShip, 0);
  if (waiting > 0) {
    parts.push(
      `${plural(waiting, 'part is', 'parts are')} held until the customer's old part arrives.`
    );
  }
  if (rows.length >= limit) parts.push(`Showing the oldest ${String(limit)}.`);
  return parts.join(' ');
}
