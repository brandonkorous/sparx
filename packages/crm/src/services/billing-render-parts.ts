// Shared render-data resolvers for billing documents (docs/87 §10).
//
// Extracted so all THREE render paths — live document, frozen snapshot, and the
// unsaved draft preview — resolve identity the same way. A draft that printed a
// different bill-to block than the saved document would make the live preview a
// lie, which is the one thing a preview must never be.

import type { Prisma } from '@sparx/db';

import type { BillingRenderParty } from './billing-document-html';

/** Flatten an author-set billTo/shipTo JSON blob into a display block. Tolerant:
 *  accepts a `name`/`company` plus either a pre-split `lines`/`addressLines`
 *  array or the common discrete address fields. */
export function partyFromJson(json: unknown, heading: string): BillingRenderParty | null {
  if (json === null || typeof json !== 'object') return null;
  const o = json as Record<string, unknown>;
  const s = (k: string): string => {
    const v = o[k];
    return typeof v === 'string' ? v : '';
  };

  const name = s('name') || s('company') || s('companyName');
  const lines: string[] = [];

  const explicit = o.lines ?? o.addressLines;
  if (Array.isArray(explicit)) {
    for (const l of explicit) if (typeof l === 'string') lines.push(l);
  } else {
    if (s('company') && s('company') !== name) lines.push(s('company'));
    if (s('attention')) lines.push(`Attn: ${s('attention')}`);
    if (s('line1') || s('address1') || s('address')) {
      lines.push(s('line1') || s('address1') || s('address'));
    }
    if (s('line2') || s('address2')) lines.push(s('line2') || s('address2'));
    const cityLine = [s('city'), s('state') || s('region'), s('postalCode') || s('zip')]
      .filter(Boolean)
      .join(', ');
    if (cityLine) lines.push(cityLine);
    if (s('country')) lines.push(s('country'));
    if (s('email')) lines.push(s('email'));
    if (s('phone')) lines.push(s('phone'));
  }

  if (!name && lines.length === 0) return null;
  return { heading, name, lines };
}

/** Resolve the bill-to block: the document's frozen billTo JSON wins; otherwise
 *  derive a minimal block from the live customer / B2B account record. */
export async function resolveBillTo(
  tx: Prisma.TransactionClient,
  billToJson: unknown,
  customerId: string | null,
  companyId: string | null
): Promise<BillingRenderParty | null> {
  const fromJson = partyFromJson(billToJson, 'Bill to');
  if (fromJson) return fromJson;

  if (companyId) {
    const account = await tx.company.findUnique({
      where: { id: companyId },
      select: { companyName: true, website: true },
    });
    if (account) {
      const lines = [account.website ?? ''].filter(Boolean);
      return { heading: 'Bill to', name: account.companyName, lines };
    }
  }
  if (customerId) {
    const c = await tx.customer.findUnique({
      where: { id: customerId },
      select: { firstName: true, lastName: true, companyName: true, email: true, phone: true },
    });
    if (c) {
      const name =
        [c.firstName, c.lastName].filter(Boolean).join(' ').trim() || (c.companyName ?? '');
      const lines = [
        c.companyName && c.companyName !== name ? c.companyName : '',
        c.email ?? '',
        c.phone ?? '',
      ]
        .filter(Boolean)
        .map(String);
      return { heading: 'Bill to', name, lines };
    }
  }
  return null;
}

/** id → label for the line types referenced by a set of lines (one query). */
export async function lineTypeLabels(
  tx: Prisma.TransactionClient,
  ids: (string | null)[]
): Promise<Map<string, string>> {
  const unique = [...new Set(ids.filter((id): id is string => id !== null))];
  if (unique.length === 0) return new Map();
  const rows = await tx.billingDocumentLineType.findMany({
    where: { id: { in: unique } },
    select: { id: true, label: true },
  });
  return new Map(rows.map((r) => [r.id, r.label]));
}
