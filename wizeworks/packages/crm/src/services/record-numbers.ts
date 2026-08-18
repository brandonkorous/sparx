// Tenant-scoped sequential record numbering for orders.
//
// Postgres SEQUENCE-per-tenant would be the textbook solution, but creating
// a sequence per tenant on tenant signup is operational overhead we don't
// need yet. Instead: numbers are derived from a count of existing rows for
// that tenant, then padded. Collisions are caught by the
// (tenant_id, order_number) unique constraint — if a write loses the race,
// the caller retries with the next number.
//
// Numbers are not gap-free (cancellations leave gaps) but they ARE
// monotonic per tenant — sufficient for human-readable identifiers.
//
// Quotes numbered through their own scheme — see nextBillingDocumentSeq /
// formatBillingNumber below (they are BillingDocuments, not a separate model).

import type { TxClient } from '@wizeworks/db';

const ORDER_PREFIX = 'O';
const PAD_LENGTH = 6; // O-000001

export async function nextOrderNumber(tx: TxClient, tenantId: string): Promise<string> {
  const count = await tx.order.count({ where: { tenantId } });
  return formatNumber(ORDER_PREFIX, count + 1);
}

// ── Service requests (docs/144 §7) ──────────────────────────────────────────
// A ticket number is an INTEGER, not a prefixed string: people say "ticket
// 1042" out loud and type it into a search box, and `T-001042` is three extra
// characters to get wrong every time. Same count-and-retry scheme as orders,
// with the (tenant_id, number) unique index as the collision backstop.

export async function nextTicketNumber(tx: TxClient, tenantId: string): Promise<number> {
  // Deleted tickets are COUNTED. Skipping them would re-issue a number that a
  // customer may already have in an email, and a gap costs nothing.
  const count = await tx.ticket.count({ where: { tenantId } });
  return count + 1;
}

// ── Invoicing module billing documents (docs/87 §9) ──────────────────────────
// A billing document carries ONE stable per-tenant sequence for life. The
// human-facing number swaps prefix as the document advances (EST-000123 →
// INV-000123) but the numeric suffix never changes — so numbering allocates the
// sequence once (on first `numberOnEnter` stage) and later stages only re-format
// it with their own prefix. The (tenant_id, number_seq) unique constraint is the
// collision backstop, identical in spirit to the order/quote number guard.

/**
 * Next stable per-SITE document sequence (docs/131 §3.6). Count of that site's
 * already-numbered documents + 1 — monotonic, gap-prone on voids (fine for a
 * human id).
 *
 * `propertyId` is the whole point of this function now. Counting per TENANT
 * interleaved two businesses' books — Bob's Parts INV-000123, Savory Donuts
 * INV-000124 — so each set appeared to skip numbers, and the gaps disclosed to
 * customers that two unrelated brands are one entity. Both businesses now start
 * at 1 and count only their own, which is what separate books look like.
 *
 * The collision backstop moved with it: the unique constraint is
 * (tenant_id, property_id, number_seq), so a lost race still fails loudly rather
 * than silently issuing a duplicate invoice number.
 */
export async function nextBillingDocumentSeq(
  tx: TxClient,
  tenantId: string,
  propertyId: string
): Promise<number> {
  const count = await tx.billingDocument.count({
    where: { tenantId, propertyId, numberSeq: { not: null } },
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
