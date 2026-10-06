/* ── What approving did to stock ───────────────────────────────────────── */
// Placing a held order takes its stock then; a shortfall stays on screen until
// dismissed and points at the Waiting list (sparx persona issue 087).

/** One line of an approved order the shelves could not fully cover. */
export interface ApprovedStockLine {
  variantId: string;
  sku: string | null;
  name: string;
  /** Units of it on the order. */
  ordered: number;
  /** Units taken that were not free to sell. */
  notFree: number;
  /** Units now owed to this customer, on the Waiting list. */
  owed: number;
}

/** What placing the order did to stock, as the approve call sends it. */
export interface ApprovedStock {
  lines: ApprovedStockLine[];
  /** The server's sentence for whoever approved it. */
  note: string;
}

export interface ApprovedStockNotice {
  orderNumber: string;
  title: string;
  detail: string;
  /** Some of it is owed to this customer, so the Waiting list is offered. */
  owed: boolean;
}

// The warning after an approval stock could not fill, or null. Units held for
// ANOTHER order are not owed to this customer, so that case names the other order
// and offers no Waiting list.
export function approvedStockNotice(
  result: { orderNumber: string; status: string; stock?: ApprovedStock | null },
  buyer: string
): ApprovedStockNotice | null {
  if (result.status !== 'placed') return null;
  const stock = result.stock;
  const note = stock?.note.trim() ?? '';
  if (!stock || stock.lines.length === 0 || note === '') return null;
  const owed = stock.lines.some((line) => line.owed > 0);
  return {
    orderNumber: result.orderNumber,
    title: owed
      ? `Order ${result.orderNumber} is placed, but not all of it is in stock`
      : `Order ${result.orderNumber} is placed, and another order is now short`,
    detail: owed
      ? `${note} What ${buyer} is owed is on the Waiting list, which keeps track of it until more arrives.`
      : note,
    owed,
  };
}
