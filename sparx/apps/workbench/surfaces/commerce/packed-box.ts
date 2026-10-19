// A box packed at the bench, and what the order's own "Mark it as sent" sends
// (sparx persona issue 357).
//
// The pack bench seals a box as a delivery that has not gone anywhere yet. The
// order showed it as "Being packed" with nothing to send it by, and beneath it
// "Mark it as sent", which made a NEW delivery for whatever was not in a box.
// Doty packed 2 of Wasatch's 6 injectors, filled that form in to send the box,
// and marked the other 4 as gone: the 4 nobody could find on the shelf. Two
// things follow, and this file holds both so each console says them the same.

/** True for a box sealed at the bench and not sent yet. A collection is handed
 *  over, never "sent", so it is never one. */
export function boxIsWaiting(shipment: { status: string; carrier: string | null }): boolean {
  return shipment.status === 'pending' && shipment.carrier !== 'pickup';
}

/** What the order's own handover form will send, said before it is pressed.
 *  When a packed box is waiting, it says that this is NOT the box. */
export function handoverSends(
  lines: readonly { orderItemId: string; quantity: number }[],
  items: readonly { id: string; name: string; sku?: string | null }[],
  packedBoxWaiting: boolean
): string {
  const named = lines.map((line) => {
    const item = items.find((candidate) => candidate.id === line.orderItemId);
    const name = item ? item.name : 'an item';
    return `${String(line.quantity)} × ${name}`;
  });
  const list = named.join(', ');
  return packedBoxWaiting
    ? `A box is packed and waiting above; send it from there. This sends what is not in it: ${list}.`
    : `This sends ${list}.`;
}

/** The line under an order item that has gone out in part. A box sealed at the
 *  bench counts as fulfilled before it leaves, so "sent so far" counts only what
 *  went, and the box is named apart (sparx persona issue 359). */
export function sentSoFarWords(item: {
  quantity: number;
  quantityFulfilled: number;
  quantityHandedOver?: number;
}): string {
  const sent = Math.min(item.quantityFulfilled, item.quantityHandedOver ?? item.quantityFulfilled);
  const packed = item.quantityFulfilled - sent;
  const sentWords = `${String(sent)} of ${String(item.quantity)} sent so far`;
  return packed > 0 ? `${sentWords} · ${String(packed)} packed, waiting to go` : sentWords;
}
