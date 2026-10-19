// Where a refund came from, for an automation to tell apart (sparx persona issue 347).
//
// A return records the money it gives back as refund rows carrying `returnId` in
// their metadata (return-service `issueRefund`). Every other refund was made on
// the order itself.

export type RefundSource = 'return' | 'order';

/** `return` when the refund row's metadata names a return, else `order`. */
export function refundSource(metadata: unknown): RefundSource {
  if (metadata === null || typeof metadata !== 'object' || Array.isArray(metadata)) return 'order';
  const returnId = (metadata as { returnId?: unknown }).returnId;
  return typeof returnId === 'string' && returnId.trim() !== '' ? 'return' : 'order';
}
