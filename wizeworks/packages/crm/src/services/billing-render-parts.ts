// Shared render-data resolvers for billing documents (docs/87 §10).
//
// Extracted so all THREE render paths — live document, frozen snapshot, and the
// unsaved draft preview — resolve identity the same way. A draft that printed a
// different bill-to block than the saved document would make the live preview a
// lie, which is the one thing a preview must never be.

import type { Prisma } from '@wizeworks/db';

import type { BillingRenderParty } from './billing-document-html';

/** One stored string becomes one or more printed lines.
 *
 *  The console asks for the billing address in a TEXTAREA whose own placeholder
 *  is two lines ("Street" / "City, State ZIP"), so what it stores is one string
 *  holding the newlines the person typed. That string was pushed here as a
 *  single line, and HTML turns a newline inside one element into a space — so an
 *  address typed on three lines printed as "2140 NE Alberta St Portland, OR
 *  97211 US" on the customer's copy, directly under the SELLER address, which
 *  arrives as an array and printed on three lines correctly. Measured
 *  2026-09-22 on INV-000018: 21 of the 37 documents holding an address had one.
 *
 *  A screen that invites line breaks and then removes them is the promise in its
 *  own placeholder going unkept. [[feedback_honor_the_users_choice]] Splitting
 *  here rather than at each field covers `address`, a pre-split `lines` entry
 *  that itself holds a break, and anything added later.
 */
function pushLines(into: string[], value: string): void {
  for (const part of value.split(/\r?\n/)) {
    const line = part.trim();
    if (line.length > 0) into.push(line);
  }
}

/** Flatten an author-set billTo/shipTo JSON blob into a display block. Tolerant:
 *  accepts a `name`/`company` plus either a pre-split `lines`/`addressLines`
 *  array or the common discrete address fields. A value holding newlines becomes
 *  one printed line per line typed. */
export function partyFromJson(json: unknown, heading: string): BillingRenderParty | null {
  if (json === null || typeof json !== 'object') return null;
  const o = json as Record<string, unknown>;
  const s = (k: string): string => {
    const v = o[k];
    return typeof v === 'string' ? v : '';
  };

  // `recipientName` is what a checkout-captured SHIP-TO carries, and it was not
  // read — so a package whose address block came from an order printed to an
  // address with nobody's name on it. Found 2026-09-22 on INV-000001, whose
  // ship-to holds "Marguerite Adeyemi" and printed none.
  // [[feedback_fetched_but_never_rendered]]
  const name = s('name') || s('company') || s('companyName') || s('recipientName');
  const lines: string[] = [];
  const push = (value: string): void => {
    pushLines(lines, value);
  };

  const explicit = o.lines ?? o.addressLines;
  if (Array.isArray(explicit)) {
    for (const l of explicit) if (typeof l === 'string') push(l);
  } else {
    if (s('company') && s('company') !== name) push(s('company'));
    if (s('attention')) push(`Attn: ${s('attention')}`);
    if (s('line1') || s('address1') || s('address')) {
      push(s('line1') || s('address1') || s('address'));
    }
    if (s('line2') || s('address2')) push(s('line2') || s('address2'));
    // "Portland, OR 97214" — a comma after the town, a SPACE before the code.
    // Joining all three with a comma printed "Portland, OR, 97214", which is not
    // how an address is written anywhere, and this block is what a customer
    // reads off the top of their bill.
    const town = [s('city'), s('state') || s('region')].filter(Boolean).join(', ');
    const code = s('postalCode') || s('zip');
    const cityLine = [town, code].filter(Boolean).join(' ');
    if (cityLine) push(cityLine);
    if (s('country')) push(s('country'));
    if (s('email')) push(s('email'));
    if (s('phone')) push(s('phone'));
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
