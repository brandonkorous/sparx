// The sentence a stock movement carries when a swap goes out.
//
// Pure, and its own module, because it is read by a shop owner rather than by a
// developer. The note lands on "Every change" — the stock ledger she opens to
// answer "why is this number what it is" — and it used to read
//
//   Replacement sent for return 526b92cc-eecc-4e86-b6c9-5068c68b0db9
//
// which is a line for whoever wrote the code. A return has no number of its own,
// so everywhere else in the product it is named by its ORDER: `Return ·
// O-000016` heads the detail pane, and the order number is the column the
// returns list sorts on. This says the same thing the same way.
//
// The same fault was fixed once already, in the approval toast, when it named a
// return line's uuid at somebody buying a shirt (persona issue 224). It was
// fixed there and left standing here, which is why it is now a named function
// with a test instead of a template string inside a 1200-line service.

/**
 * What the outgoing stock movement says when a replacement is sent.
 *
 * `orderNumber` is null only when the order behind the return has gone, which a
 * hard delete can do. The fallback still says what happened and to what kind of
 * thing; it just cannot say which one. It never falls back to the id.
 */
export function replacementStockNote(orderNumber: string | null): string {
  if (orderNumber === null || orderNumber.trim() === '') {
    return 'Replacement sent for a return';
  }
  return `Replacement sent for the return on order ${orderNumber.trim()}`;
}
