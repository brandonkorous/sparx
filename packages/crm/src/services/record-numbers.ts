// Tenant-scoped sequential record numbering for orders + quotes.
//
// Postgres SEQUENCE-per-tenant would be the textbook solution, but creating
// a sequence per tenant on tenant signup is operational overhead we don't
// need yet. Instead: numbers are derived from a count of existing rows for
// that tenant, then padded. Collisions are caught by the
// (tenant_id, order_number) / (tenant_id, quote_number) unique constraint —
// if a write loses the race, the caller retries with the next number.
//
// Numbers are not gap-free (cancellations leave gaps) but they ARE
// monotonic per tenant — sufficient for human-readable identifiers.

import type { TxClient } from '@sparx/db';

const ORDER_PREFIX = 'O';
const QUOTE_PREFIX = 'Q';
const PAD_LENGTH = 6; // O-000001, Q-000001

export async function nextOrderNumber(tx: TxClient, tenantId: string): Promise<string> {
  const count = await tx.order.count({ where: { tenantId } });
  return formatNumber(ORDER_PREFIX, count + 1);
}

export async function nextQuoteNumber(tx: TxClient, tenantId: string): Promise<string> {
  const count = await tx.quote.count({ where: { tenantId } });
  return formatNumber(QUOTE_PREFIX, count + 1);
}

// ── Invoicing module billing documents (docs/87 §9) ──────────────────────────
// A billing document carries ONE stable per-tenant sequence for life. The
// human-facing number swaps prefix as the document advances (EST-000123 →
// INV-000123) but the numeric suffix never changes — so numbering allocates the
// sequence once (on first `numberOnEnter` stage) and later stages only re-format
// it with their own prefix. The (tenant_id, number_seq) unique constraint is the
// collision backstop, identical in spirit to the order/quote number guard.

/** Next stable per-tenant document sequence. Count of already-numbered documents
 *  + 1 — monotonic, gap-prone on voids (fine for a human id). */
export async function nextBillingDocumentSeq(tx: TxClient, tenantId: string): Promise<number> {
  const count = await tx.billingDocument.count({
    where: { tenantId, numberSeq: { not: null } },
  });
  return count + 1;
}

/** Format a document number from a stage's prefix + the document's stable
 *  sequence. The configured prefix already carries its own separator ("INV-",
 *  "EST-"), so it is concatenated verbatim — `('INV-', 123)` → `'INV-000123'`. */
export function formatBillingNumber(prefix: string, seq: number): string {
  return `${prefix}${seq.toString().padStart(PAD_LENGTH, '0')}`;
}

function formatNumber(prefix: string, value: number): string {
  return `${prefix}-${value.toString().padStart(PAD_LENGTH, '0')}`;
}
