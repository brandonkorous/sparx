// Where a CRM record lives, and what it is called (docs/144 §6).
//
// An association's endpoints are `(objectKey, recordId)` pairs with no foreign
// key, because the table depends on the key: a contact is in `customers`, a
// company in `b2b_accounts`, a deal in `deals`, and anything a tenant invented in
// `crm_records`. Postgres cannot express that as an FK, so the two things an FK
// would have given us for free have to be written down ONCE, here:
//
//   1. DOES IT EXIST? Without this an association can point at nothing, and the
//      panel that renders it shows a chip nobody can click.
//   2. WHAT IS IT CALLED? A relationship is unreadable as a pair of uuids. Every
//      surface needs a name and a subtitle, and resolving those per-surface is
//      how four different spellings of a person's name end up on one screen.
//
// One table per built-in plus the generic one — a `switch` rather than a
// registry of callbacks, because there are exactly four built-ins and the
// compiler checking the switch is worth more than the indirection.

import type { Prisma } from '@sparx/db';

/** A record as an association panel needs to show it. */
export interface RecordRef {
  objectKey: string;
  recordId: string;
  /** What to put on the chip. Never empty — falls back to something honest. */
  title: string;
  /** The second line: a company, an email, an amount. Omitted when there is none. */
  subtitle?: string;
  /** True when the row is soft-deleted — the panel shows it struck through
   *  rather than hiding it, so a link to a removed record is visible and
   *  fixable rather than silently absent. */
  removed?: boolean;
}

function personName(row: {
  firstName: string | null;
  lastName: string | null;
  company: string | null;
  email: string | null;
}): string {
  const name = [row.firstName, row.lastName].filter(Boolean).join(' ').trim();
  if (name !== '') return name;
  if (row.company?.trim()) return row.company.trim();
  if (row.email?.trim()) return row.email.trim();
  return 'Someone with no name yet';
}

/**
 * Resolve a batch of record ids of ONE object kind to display refs.
 *
 * Batched by kind rather than one call per association, because a deal with
 * eight related contacts must not become eight queries — the panel would then be
 * the slowest thing on the pane.
 */
export async function resolveRecordRefs(
  tx: Prisma.TransactionClient,
  tenantId: string,
  objectKey: string,
  ids: readonly string[]
): Promise<Map<string, RecordRef>> {
  const found = new Map<string, RecordRef>();
  if (ids.length === 0) return found;
  const unique = [...new Set(ids)];

  switch (objectKey) {
    case 'contact': {
      const rows = await tx.customer.findMany({
        where: { id: { in: unique } },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          company: true,
          email: true,
          deletedAt: true,
        },
      });
      for (const row of rows) {
        found.set(row.id, {
          objectKey,
          recordId: row.id,
          title: personName(row),
          ...(row.email ? { subtitle: row.email } : {}),
          ...(row.deletedAt ? { removed: true } : {}),
        });
      }
      break;
    }

    case 'company': {
      const rows = await tx.b2BAccount.findMany({
        where: { id: { in: unique } },
        select: { id: true, companyName: true, website: true, deletedAt: true },
      });
      for (const row of rows) {
        found.set(row.id, {
          objectKey,
          recordId: row.id,
          title: row.companyName,
          ...(row.website ? { subtitle: row.website } : {}),
          ...(row.deletedAt ? { removed: true } : {}),
        });
      }
      break;
    }

    case 'deal': {
      const rows = await tx.deal.findMany({
        where: { id: { in: unique } },
        select: {
          id: true,
          title: true,
          value: true,
          currency: true,
          deletedAt: true,
          stage: { select: { name: true } },
        },
      });
      for (const row of rows) {
        // The stage is the one thing worth knowing about a deal at a glance —
        // more than its value, which the title often already implies.
        found.set(row.id, {
          objectKey,
          recordId: row.id,
          title: row.title,
          ...(row.stage?.name ? { subtitle: row.stage.name } : {}),
          ...(row.deletedAt ? { removed: true } : {}),
        });
      }
      break;
    }

    default: {
      // Everything a tenant invented, plus `ticket` until Phase 4 gives it its
      // own table. `title` is denormalized on write precisely so this does not
      // have to parse the values bag.
      const rows = await tx.crmRecord.findMany({
        where: { id: { in: unique }, objectKey },
        select: { id: true, title: true, deletedAt: true },
      });
      for (const row of rows) {
        found.set(row.id, {
          objectKey,
          recordId: row.id,
          title: row.title ?? 'Untitled',
          ...(row.deletedAt ? { removed: true } : {}),
        });
      }
      break;
    }
  }

  return found;
}

/**
 * Whether a record exists at all, for the write path.
 *
 * Separate from the resolver above because a create only needs a yes/no and must
 * not pay for the display columns — and because a soft-deleted record IS a
 * failure here (you may see a link to one, but you may not make a new one).
 */
export async function recordExists(
  tx: Prisma.TransactionClient,
  tenantId: string,
  objectKey: string,
  recordId: string
): Promise<boolean> {
  switch (objectKey) {
    case 'contact':
      return (await tx.customer.count({ where: { id: recordId, deletedAt: null } })) > 0;
    case 'company':
      return (await tx.b2BAccount.count({ where: { id: recordId, deletedAt: null } })) > 0;
    case 'deal':
      return (await tx.deal.count({ where: { id: recordId, deletedAt: null } })) > 0;
    default:
      return (
        (await tx.crmRecord.count({ where: { id: recordId, objectKey, deletedAt: null } })) > 0
      );
  }
}

/**
 * The legacy foreign-key column an association mirrors, if there is one.
 *
 * THIS TABLE IS THE BACK-COMPAT CONTRACT (docs/144 §6). `deals.customer_id` and
 * the columns like it are read by the order consumer, four reports, the segment
 * projection and the storefront — so the primary association does not replace
 * them, it KEEPS THEM CORRECT. Any pair not listed here has no column to mirror,
 * which is the normal case: most relationships never had a column at all, and
 * that is the gap associations exist to fill.
 */
export interface PrimaryMirror {
  /** Which table the column is on — always the `from` side. */
  table: 'deal' | 'customer';
  column: string;
}

export function primaryMirrorFor(fromType: string, toType: string): PrimaryMirror | null {
  if (fromType === 'deal' && toType === 'contact') return { table: 'deal', column: 'customerId' };
  if (fromType === 'deal' && toType === 'company') {
    return { table: 'deal', column: 'b2bAccountId' };
  }
  if (fromType === 'contact' && toType === 'company') {
    return { table: 'customer', column: 'b2bAccountId' };
  }
  return null;
}
