// Customer merge / dedupe.
//
// The "two customers, one person" problem is real for every CRM the moment
// you accept guest checkouts: same email shows up twice (case difference,
// trailing whitespace), same person uses two emails, same household. The
// merge service collapses N duplicates into a chosen primary by:
//
//   1. Moving ALL activities, deals, tasks from each duplicate onto the
//      primary's customer_id.
//   2. Stitching the duplicate's commerce stats into the primary (sum of
//      total_spent, sum of order_count, min(first_order_at), max(last_order_at)).
//   3. Unifying tags (union).
//   4. Filling primary fields the primary is missing from the most recent
//      duplicate that has them (email, phone, names — but never overwrite
//      existing primary fields).
//   5. Soft-deleting the duplicate, setting merged_into_customer_id so the
//      audit trail survives, and recording a customer.merged activity on
//      the primary.
//
// All of the above runs in a single transaction. If any step fails the
// merge is fully reverted.

import { MergeCustomersInput } from '@sparx/crm-schemas';
import { withTenant } from '@sparx/db';
import type { Customer, Prisma } from '@sparx/db';

import { writeAuditLog } from '../audit';
import { crmSettings } from './crm-settings-service';
import { publishCrmEvent } from '../events';
import type { ServiceContext } from '../errors';
import { CrmNotFoundError, CrmValidationError } from '../errors';

export interface MergeResult {
  primary: Customer;
  /** Soft-deleted duplicates — `mergedIntoCustomerId` is set on each. */
  merged: Customer[];
  /** Activity / deal / task rows reattached to the primary. */
  reattached: {
    activities: number;
    deals: number;
    tasks: number;
    addresses: number;
  };
}

/**
 * Move every relationship off the duplicates and onto the primary (docs/144 §6).
 *
 * Done one row at a time rather than as an `updateMany`, because the unique
 * index on (pair, label) means a duplicate that shared a relationship with the
 * primary — both linked to the same deal as "main contact", which is exactly how
 * a duplicate gets noticed — would make the bulk update fail. The link that
 * would collide is DELETED instead: it says the same thing the primary's already
 * says, so keeping it would be keeping a copy of a fact, not a second fact.
 *
 * A link between a duplicate and the primary itself is also dropped — after the
 * merge it would be the primary related to itself, which the table refuses and
 * which means nothing anyway.
 */
async function moveAssociations(
  tx: Prisma.TransactionClient,
  duplicateIds: string[],
  primaryId: string
): Promise<void> {
  const rows = await tx.crmAssociation.findMany({
    where: {
      OR: [
        { fromType: 'contact', fromId: { in: duplicateIds } },
        { toType: 'contact', toId: { in: duplicateIds } },
      ],
    },
  });

  for (const row of rows) {
    const onFrom = row.fromType === 'contact' && duplicateIds.includes(row.fromId);
    const nextFromId = onFrom ? primaryId : row.fromId;
    const nextToId =
      row.toType === 'contact' && duplicateIds.includes(row.toId) ? primaryId : row.toId;

    if (row.fromType === row.toType && nextFromId === nextToId) {
      await tx.crmAssociation.delete({ where: { id: row.id } });
      continue;
    }

    const clash = await tx.crmAssociation.findFirst({
      where: {
        fromType: row.fromType,
        fromId: nextFromId,
        toType: row.toType,
        toId: nextToId,
        labelKey: row.labelKey,
        id: { not: row.id },
      },
    });
    if (clash) {
      // The primary already holds this exact relationship. Keep whichever is
      // primary, so a merge never demotes a pointer the reports read.
      if (row.isPrimary && !clash.isPrimary) {
        await tx.crmAssociation.update({ where: { id: clash.id }, data: { isPrimary: true } });
      }
      await tx.crmAssociation.delete({ where: { id: row.id } });
      continue;
    }

    await tx.crmAssociation.update({
      where: { id: row.id },
      data: { fromId: nextFromId, toId: nextToId },
    });
  }
}

/** Collapse `duplicateCustomerIds` into `primaryCustomerId`. All ids must
 *  belong to the caller's tenant (RLS is the backstop; service-layer asserts
 *  the relationship explicitly so we can emit a clean validation error). */
export async function merge(ctx: ServiceContext, rawInput: unknown): Promise<MergeResult> {
  const input = MergeCustomersInput.parse(rawInput);
  if (input.duplicateCustomerIds.includes(input.primaryCustomerId)) {
    throw new CrmValidationError('Primary cannot also be in duplicates list', [
      { field: 'duplicateCustomerIds', message: 'must not include primaryCustomerId' },
    ]);
  }

  const result = await withTenant(ctx, async (tx) => {
    const primary = await tx.customer.findUnique({
      where: { id: input.primaryCustomerId },
    });
    if (primary?.deletedAt !== null) {
      throw new CrmNotFoundError('Customer', input.primaryCustomerId);
    }

    const duplicates = await tx.customer.findMany({
      where: { id: { in: input.duplicateCustomerIds } },
    });
    if (duplicates.length !== input.duplicateCustomerIds.length) {
      const found = new Set(duplicates.map((d) => d.id));
      const missing = input.duplicateCustomerIds.find((id) => !found.has(id))!;
      throw new CrmNotFoundError('Customer', missing);
    }
    const liveDuplicates = duplicates.filter((d) => d.deletedAt === null);
    if (liveDuplicates.length === 0) {
      // Nothing to merge — surface as a no-op rather than an error so the
      // caller can be idempotent.
      return {
        primary,
        merged: [],
        reattached: { activities: 0, deals: 0, tasks: 0, addresses: 0 },
      };
    }

    const duplicateIds = liveDuplicates.map((d) => d.id);

    // 1. Reattach child rows to the primary. Each updateMany is one query.
    const [activities, deals, tasks, addresses] = await Promise.all([
      tx.crmActivity.updateMany({
        where: { customerId: { in: duplicateIds } },
        data: { customerId: input.primaryCustomerId },
      }),
      tx.deal.updateMany({
        where: { customerId: { in: duplicateIds }, deletedAt: null },
        data: { customerId: input.primaryCustomerId },
      }),
      tx.task.updateMany({
        where: { customerId: { in: duplicateIds } },
        data: { customerId: input.primaryCustomerId },
      }),
      tx.customerAddress.updateMany({
        where: { customerId: { in: duplicateIds } },
        data: { customerId: input.primaryCustomerId },
      }),
    ]);

    // 1b. Relationships (docs/144 §6), both directions. Endpoints carry no FK,
    // so nothing else moves them — and a merge that left them behind would
    // silently break "who else is involved" on every deal the duplicate was on.
    await moveAssociations(tx, duplicateIds, input.primaryCustomerId);

    // 2. Roll up commerce stats. Sum across primary + duplicates.
    const totalSpent = liveDuplicates.reduce(
      (acc, d) => acc + Number(d.totalSpent),
      Number(primary.totalSpent)
    );
    const orderCount = liveDuplicates.reduce((acc, d) => acc + d.orderCount, primary.orderCount);
    const allFirstOrderAts = [
      primary.firstOrderAt,
      ...liveDuplicates.map((d) => d.firstOrderAt),
    ].filter((d): d is Date => d != null);
    const allLastOrderAts = [
      primary.lastOrderAt,
      ...liveDuplicates.map((d) => d.lastOrderAt),
    ].filter((d): d is Date => d != null);
    const firstOrderAt =
      allFirstOrderAts.length > 0
        ? new Date(Math.min(...allFirstOrderAts.map((d) => d.getTime())))
        : null;
    const lastOrderAt =
      allLastOrderAts.length > 0
        ? new Date(Math.max(...allLastOrderAts.map((d) => d.getTime())))
        : null;

    // 3. Union tags. 4. Pick up missing scalar fields from the most recent
    // duplicate. Sort newest-first so the "first non-null wins" rule picks
    // the freshest value.
    const sortedDups = [...liveDuplicates].sort(
      (a, b) => b.updatedAt.getTime() - a.updatedAt.getTime()
    );
    const mergedTags = new Set<string>(primary.tags);
    for (const d of liveDuplicates) for (const t of d.tags) mergedTags.add(t);

    const filledScalar = <T>(primary: T | null, candidates: (T | null)[]): T | null =>
      primary ?? candidates.find((c) => c != null) ?? null;
    const dupFields = (k: keyof Customer) => sortedDups.map((d) => d[k] as string | null);

    const updatedPrimary = await tx.customer.update({
      where: { id: primary.id },
      data: {
        totalSpent,
        orderCount,
        firstOrderAt,
        lastOrderAt,
        tags: [...mergedTags],
        email: filledScalar(primary.email, dupFields('email')),
        phone: filledScalar(primary.phone, dupFields('phone')),
        firstName: filledScalar(primary.firstName, dupFields('firstName')),
        lastName: filledScalar(primary.lastName, dupFields('lastName')),
        companyName: filledScalar(primary.companyName, dupFields('companyName')),
        jobTitle: filledScalar(primary.jobTitle, dupFields('jobTitle')),
        companyId: filledScalar(primary.companyId, dupFields('companyId')),
        authUserId: filledScalar(primary.authUserId, dupFields('authUserId')),
      },
    });

    // 5. Soft-delete the duplicates and stamp the merge target.
    const now = new Date();
    await tx.customer.updateMany({
      where: { id: { in: duplicateIds } },
      data: {
        deletedAt: now,
        mergedIntoCustomerId: primary.id,
      },
    });
    const mergedDups = await tx.customer.findMany({
      where: { id: { in: duplicateIds } },
    });

    // Activity on the primary recording the merge — captures the duplicate
    // ids in metadata so a future un-merge tool (out of scope today) can
    // walk the history.
    await tx.crmActivity.create({
      data: {
        tenantId: ctx.tenantId,
        customerId: primary.id,
        type: 'customer.merged',
        description: `Merged ${liveDuplicates.length} duplicate customer record${liveDuplicates.length === 1 ? '' : 's'}`,
        actorId: ctx.userId ?? null,
        actorType: ctx.userId ? 'staff' : 'system',
        occurredAt: now,
        linkedEntityType: 'Customer',
        linkedEntityId: primary.id,
        metadata: {
          duplicateIds,
          reattached: {
            activities: activities.count,
            deals: deals.count,
            tasks: tasks.count,
            addresses: addresses.count,
          },
        },
      },
    });

    await writeAuditLog({
      tx,
      tenantId: ctx.tenantId,
      actorId: ctx.userId ?? null,
      actorType: ctx.userId ? 'user' : 'system',
      action: 'crm.customer.merged',
      entityType: 'Customer',
      entityId: primary.id,
      diff: { after: { mergedDuplicateIds: duplicateIds } },
    });

    return {
      primary: updatedPrimary,
      merged: mergedDups,
      reattached: {
        activities: activities.count,
        deals: deals.count,
        tasks: tasks.count,
        addresses: addresses.count,
      },
    };
  });

  if (result.merged.length > 0) {
    await publishCrmEvent({
      tenantId: ctx.tenantId,
      topic: 'crm.customer.merged',
      payload: {
        primaryCustomerId: result.primary.id,
        duplicateCustomerIds: result.merged.map((d) => d.id),
      },
      dedupeKey: `crm.customer.merged:${result.primary.id}:${result.merged
        .map((d) => d.id)
        .sort()
        .join(',')}`,
    });
  }

  return result;
}

// ─────────────────────────────────────────────────────────────────────────
// Duplicate detection
// ─────────────────────────────────────────────────────────────────────────

export interface DuplicateGroup {
  /**
   * Which signal put these together. `name+company` keeps its old spelling on
   * purpose: it is what the surface renders and what the existing clients read,
   * and the settings key it corresponds to (`name_company`) is a different
   * vocabulary — a stored setting rather than a label.
   */
  reason: 'email' | 'phone' | 'name+company';
  customers: Customer[];
  /**
   * How sure we are, 0-100 — and the whole reason auto-merge is safe to offer.
   *
   * An exact email match is 100: two live records with the same address are the
   * same person by any definition a business uses. A phone match is 90 — shared
   * office lines and family mobiles are real but rare. Last name plus employer
   * is 60, which is below every threshold the settings screen will accept, so
   * it can never auto-merge no matter what somebody sets. That is deliberate:
   * the weakest signal is the one that would merge two brothers at the same firm.
   */
  confidence: number;
}

/** Confidence per signal. Fixed rather than configurable — a number a business
 *  can tune is a number they can set to 100 for a guess. What IS configurable is
 *  which signals run at all, and how sure a merge has to be to happen unwatched. */
const CONFIDENCE: Record<DuplicateGroup['reason'], number> = {
  email: 100,
  phone: 90,
  'name+company': 60,
};

/** Digits only, so `(555) 010-3344` and `+1 555 010 3344` are one number. A
 *  number under 7 digits is an extension or a typo, not a way to identify anyone. */
function phoneKey(raw: string): string | null {
  const digits = raw.replace(/\D/g, '');
  return digits.length >= 7 ? digits.slice(-10) : null;
}

/**
 * Find likely duplicates, using the signals this business has chosen.
 *
 * Which signals run comes from CrmSettings (docs/144 §12) — a parts wholesaler
 * dedupes on the account email, a clinic on the phone number, and running both
 * on both produces merges nobody asked for. Defaults are what this did before it
 * was configurable, so turning the settings surface on changes nothing by itself.
 *
 * STRONGEST SIGNAL WINS. A pair caught by email is not reported again under
 * phone or name: one pair, one reason, the highest confidence that found it.
 * Reporting the same two people three times is how a duplicates page with
 * fourteen real problems shows forty rows and gets closed.
 *
 * Tenant-wide scan, bounded by `limit`. Pagination is the caller's, and the
 * surface says what the bound was rather than implying it saw everything.
 */
export async function findLikelyDuplicates(
  ctx: ServiceContext,
  args: { limit?: number; propertyId?: string | null } = {}
): Promise<DuplicateGroup[]> {
  const settings = await crmSettings(ctx, args.propertyId ?? null);
  const enabled = new Set(settings.duplicateMatchRules);

  return withTenant(ctx, async (tx) => {
    const customers = await tx.customer.findMany({
      where: { deletedAt: null },
      orderBy: { updatedAt: 'desc' },
      take: Math.min(args.limit ?? 5000, 10_000),
    });

    const buckets: { reason: DuplicateGroup['reason']; map: Map<string, Customer[]> }[] = [
      { reason: 'email', map: new Map() },
      { reason: 'phone', map: new Map() },
      { reason: 'name+company', map: new Map() },
    ];
    const [byEmail, byPhone, byNameCompany] = buckets.map((b) => b.map) as [
      Map<string, Customer[]>,
      Map<string, Customer[]>,
      Map<string, Customer[]>,
    ];

    const push = (map: Map<string, Customer[]>, key: string, c: Customer): void => {
      const bucket = map.get(key);
      if (bucket) bucket.push(c);
      else map.set(key, [c]);
    };

    for (const c of customers) {
      if (enabled.has('email') && c.email) {
        push(byEmail, c.email.trim().toLowerCase(), c);
      }
      if (enabled.has('phone') && c.phone) {
        const key = phoneKey(c.phone);
        if (key) push(byPhone, key, c);
      }
      if (enabled.has('name_company') && c.lastName && c.companyName) {
        push(
          byNameCompany,
          `${c.lastName.trim().toLowerCase()}|${c.companyName.trim().toLowerCase()}`,
          c
        );
      }
    }

    const groups: DuplicateGroup[] = [];
    // Ids already reported under a stronger signal. Checked per-member rather
    // than per-group so a THREE-record cluster where two share an email and the
    // third only shares a phone still surfaces the third.
    const seen = new Set<string>();

    for (const { reason, map } of buckets) {
      for (const bucket of map.values()) {
        if (bucket.length < 2) continue;
        if (bucket.every((c) => seen.has(c.id))) continue;
        const sorted = [...bucket].sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
        groups.push({ reason, customers: sorted, confidence: CONFIDENCE[reason] });
        for (const c of sorted) seen.add(c.id);
      }
    }

    // Most confident first, then largest — the order somebody would work them in.
    return groups.sort(
      (a, b) => b.confidence - a.confidence || b.customers.length - a.customers.length
    );
  });
}

export interface BulkMergeResult {
  /** Groups collapsed, and how many records disappeared into a survivor. */
  merged: number;
  absorbed: number;
  /** Groups left alone, with the reason a person can act on. */
  skipped: { reason: string; count: number }[];
}

/**
 * Merge every duplicate group at or above a confidence floor.
 *
 * THE SURVIVOR IS THE MOST RECENTLY UPDATED RECORD, which is what
 * `findLikelyDuplicates` already sorts each group by. That is the one somebody
 * has touched most recently, so it is the one whose corrections are worth
 * keeping — and every field the survivor is MISSING is filled in from the
 * others, so nothing is actually lost either way.
 *
 * Groups run one at a time in their own transactions rather than one big one. A
 * merge is irreversible: if the fortieth fails, the thirty-nine before it should
 * stay done, because re-running is safe and unwinding is not.
 *
 * `minConfidence` is required and has no default. There is no sensible default
 * for "destroy records without asking" — the caller states the floor, and the
 * settings screen's `autoMergeThreshold` is where a business states theirs.
 */
export async function bulkMerge(
  ctx: ServiceContext,
  args: { minConfidence: number; limit?: number; propertyId?: string | null }
): Promise<BulkMergeResult> {
  const groups = await findLikelyDuplicates(ctx, {
    limit: args.limit,
    propertyId: args.propertyId,
  });

  const result: BulkMergeResult = { merged: 0, absorbed: 0, skipped: [] };
  const skips = new Map<string, number>();
  const note = (reason: string): void => {
    skips.set(reason, (skips.get(reason) ?? 0) + 1);
  };

  for (const group of groups) {
    if (group.confidence < args.minConfidence) {
      note('Not sure enough to merge without someone looking');
      continue;
    }
    const [primary, ...duplicates] = group.customers;
    if (!primary || duplicates.length === 0) continue;

    try {
      await merge(ctx, {
        primaryCustomerId: primary.id,
        duplicateCustomerIds: duplicates.map((d) => d.id),
      });
      result.merged += 1;
      result.absorbed += duplicates.length;
    } catch (error) {
      // One group failing must not stop the rest. The message is kept because
      // "eleven merged, three refused because they are linked to different
      // companies" is a usable sentence and "some failed" is not.
      note(error instanceof Error ? error.message : 'Could not be merged');
    }
  }

  result.skipped = [...skips.entries()].map(([reason, count]) => ({ reason, count }));
  return result;
}
