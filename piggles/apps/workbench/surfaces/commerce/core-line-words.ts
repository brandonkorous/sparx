// What a core on one order line says, and which moves it offers (issues 051, 057).
// The order pane and the Cores owed list both read this, so they never disagree.

import { splitCoreDeposit } from '@wizeworks/commerce-schemas';
import { formatMoney, type OrderItem } from './data';
import type { CoreLine, CoreOwed, OpenInvoice } from './cores-data';

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
    if (line.owed === 0) return [{ label: 'Cores settled', tone: 'success' }];
    // Nobody owes an old part for a new one still on the shelf (issue 184).
    const later = line.owed - line.outstanding;
    const badges: { label: string; tone: CoreTone }[] = [];
    if (line.outstanding > 0) {
      badges.push({
        label: `${plural(line.outstanding, 'core', 'cores')} still owed`,
        tone: 'warning',
      });
    }
    if (later > 0) {
      badges.push({
        label: `${plural(later, 'core', 'cores')} due once handed over`,
        tone: 'info',
      });
    }
    return badges;
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

/** The "Deposit" cell on the Cores owed list. A send-first line holds no
 *  deposit, and "$0.00" would read as a deposit of nothing that is owed back. A
 *  deposit on an order whose invoice is still open comes off that invoice, and
 *  says which (sparx persona issue 183). */
export function depositBackText(row: CoreOwed): string {
  if (row.coreFirst) return 'No deposit';
  const amount = formatMoney(row.owedCents / 100, row.currency);
  return row.openInvoice && row.openInvoice.balanceCents > 0
    ? `${amount} off ${row.openInvoice.number ?? 'its open invoice'}`
    : amount;
}

/**
 * Where every deposit on the list would go, per currency: off open invoices or
 * back to the customer. Lines on one order share what its invoice still owes, the
 * way the refund takes them one after another.
 */
function depositOutlook(rows: CoreOwed[]): Map<string, { offCents: number; backCents: number }> {
  const byOrder = new Map<string, { currency: string; deposits: number; balance: number }>();
  for (const row of rows) {
    if (row.coreFirst) continue;
    const entry = byOrder.get(row.orderId) ?? {
      currency: row.currency,
      deposits: 0,
      balance: row.openInvoice?.balanceCents ?? 0,
    };
    entry.deposits += row.owedCents;
    byOrder.set(row.orderId, entry);
  }
  const byCurrency = new Map<string, { offCents: number; backCents: number }>();
  for (const { currency, deposits, balance } of byOrder.values()) {
    const split = splitCoreDeposit(deposits, balance);
    const sum = byCurrency.get(currency) ?? { offCents: 0, backCents: 0 };
    sum.offCents += split.offInvoiceCents;
    sum.backCents += split.backCents;
    byCurrency.set(currency, sum);
  }
  return byCurrency;
}

/** The sentence above the Cores owed list. */
export function coresSummary(rows: CoreOwed[], limit: number): string {
  const cores = rows.reduce((sum, row) => sum + row.coresOwed, 0);
  const parts = [
    `${plural(cores, 'core', 'cores')} owed on ${plural(rows.length, 'order line', 'order lines')}.`,
  ];
  // Summed per currency so a second one can never be added into the first. A
  // deposit an account never paid comes off its invoice, never out of the till
  // (sparx persona issue 183).
  const outlook = [...depositOutlook(rows).entries()];
  const sums = (pick: 'offCents' | 'backCents') =>
    outlook
      .filter(([, sum]) => sum[pick] > 0)
      .map(([currency, sum]) => formatMoney(sum[pick] / 100, currency))
      .join(' and ');
  const off = sums('offCents');
  const back = sums('backCents');
  if (off && back) {
    parts.push(
      `If every deposit came back, ${off} would come off open invoices and you would give back ${back}.`
    );
  } else if (off) {
    parts.push(`If every deposit came back, ${off} would come off open invoices.`);
  } else if (back) {
    parts.push(`If every deposit came back, you would give back ${back}.`);
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

export interface ReceiveCoreWords {
  description: string;
  submitLabel: string;
  submitColor: 'danger' | 'module';
  /** Only money actually going back needs a "where to". */
  asksWhereMoneyGoes: boolean;
  /** False until the order's open invoice is known: a dialog that guessed would
   *  promise money back and then take it off the invoice. */
  ready: boolean;
}

/**
 * What "Core came back" says and does, from the same split the refund makes. It
 * said "Give back $150.00" over an order whose $150.00 deposit sat on an unpaid
 * invoice, and the click took it off the invoice instead (sparx persona issue 183).
 * `invoice` is undefined while it is still being read.
 */
export function receiveCoreWords(
  line: CoreLine,
  counts: { usable: number; unusable: number; invoice: OpenInvoice | null | undefined }
): ReceiveCoreWords {
  const { usable, unusable, invoice } = counts;
  const money = (cents: number) => formatMoney(cents / 100, line.currency);
  // "Still to come back", not "still owed": a core that comes in before the part
  // goes out is recorded here too (sparx persona issue 184).
  const head = `${line.name}: ${plural(line.owed, 'core is', 'cores are')} still to come back from ${line.customerName}.`;
  const keepLabel = `Keep ${plural(unusable, 'deposit', 'deposits')}`;
  if (invoice === undefined) {
    return {
      description: `${head} Checking whether this order still has an invoice to pay.`,
      submitLabel: usable > 0 ? 'Record the core' : keepLabel,
      submitColor: 'module',
      asksWhereMoneyGoes: false,
      ready: usable === 0,
    };
  }
  const { offInvoiceCents, backCents } = splitCoreDeposit(
    usable * line.depositCents,
    invoice?.balanceCents ?? 0
  );
  const each = money(line.depositCents);
  let description = `${head} A usable core gets its ${each} deposit back.`;
  let submitLabel = usable > 0 ? `Give back ${money(backCents)}` : keepLabel;
  if (invoice && offInvoiceCents > 0) {
    const left = money(invoice.balanceCents);
    // An invoice not numbered yet is still owed, so it is named without one.
    const named = invoice.number ? `invoice ${invoice.number}` : 'the open invoice';
    const short = invoice.number ?? 'the invoice';
    description =
      backCents > 0
        ? `${head} ${named.charAt(0).toUpperCase()}${named.slice(1)} still has ${left} to pay, so ${money(offInvoiceCents)} comes off it and ${money(backCents)} goes back.`
        : `${head} A usable core takes its ${each} deposit off ${named}, which still has ${left} to pay. No money goes back.`;
    submitLabel =
      backCents > 0
        ? `Take ${money(offInvoiceCents)} off ${short}, give back ${money(backCents)}`
        : `Take ${money(offInvoiceCents)} off ${short}`;
  }
  return {
    description,
    submitLabel,
    submitColor: backCents > 0 ? 'danger' : 'module',
    asksWhereMoneyGoes: backCents > 0,
    ready: true,
  };
}
