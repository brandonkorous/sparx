// What one refund says, for an automation to read.
//
// Where it came from (sparx persona issue 347): a return records the money it
// gives back as refund rows carrying `returnId` in their metadata (return-service
// `issueRefund`). Every other refund was made on the order itself.
//
// Where the money goes (sparx persona issue 352): back through the gateway that
// took it, or by hand. The order refund path writes `settledBy` on the row; a row
// without it was recorded as already settled elsewhere, and reads as by hand, the
// way it was paid.
//
// How much it was (sparx persona issue 350): the refund's own amount. The order's
// `refundTotal` is every refund so far, so a $15.00 refund after a $93.44 return
// told Renée "Refund amount $108.44".

export type RefundSource = 'return' | 'order';

/** `return` when the refund row's metadata names a return, else `order`. */
export function refundSource(metadata: unknown): RefundSource {
  if (metadata === null || typeof metadata !== 'object' || Array.isArray(metadata)) return 'order';
  const returnId = (metadata as { returnId?: unknown }).returnId;
  return typeof returnId === 'string' && returnId.trim() !== '' ? 'return' : 'order';
}

/** `card` when the refund went back through a gateway, else `hand`. */
export function refundGoesTo(metadata: unknown): 'card' | 'hand' {
  if (metadata === null || typeof metadata !== 'object' || Array.isArray(metadata)) return 'hand';
  return (metadata as { settledBy?: unknown }).settledBy === 'gateway' ? 'card' : 'hand';
}

/** The refund's amount as money, "$15.00". Empty when there is no amount, so a
 *  bound row drops rather than printing "$0.00" or the raw token. */
export function refundAmount(amount: unknown, currency: unknown): string {
  const n = Number(amount);
  if (amount === null || amount === undefined || !Number.isFinite(n)) return '';
  const code = typeof currency === 'string' && /^[A-Z]{3}$/.test(currency) ? currency : 'USD';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: code }).format(n);
}
