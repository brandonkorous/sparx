// Customer merge / dedupe.
//
// The "two customers, one person" problem is real for every CRM the moment
// you accept guest checkouts: same email shows up twice (case difference,
// trailing whitespace), same person uses two emails, same household. The
// merge service collapses N duplicates into a chosen primary by:
//
//   1. Moving everything the duplicate owned onto the primary's customer_id —
//      every one of the 37 tables that carries one, not just the handful this
//      once covered. Orders, invoices, bookings, consents and store credit were
//      all left behind for a long time; `MOVED_MODELS` and its test exist so
//      that cannot quietly happen again.
//   2. Stitching the duplicate's commerce stats into the primary (sum of
//      total_spent, sum of order_count, min(first_order_at), max(last_order_at)).
//   3. Unifying tags (union).
//   4. Filling primary fields the primary is missing from the most recent
//      duplicate that has them (email, phone, names, employer, owner, preferred
//      contact method — but never overwriting a value the primary already has).
//   4b. Taking the SAFEST or FURTHEST value where "missing" is the wrong test:
//      do-not-contact is true if ANY record says so, and lifecycle stage and
//      relationship type take the most advanced of the group. Whichever record
//      somebody chose to keep, a merge must not lose a consent or demote a
//      paying customer back to a lead.
//   5. Soft-deleting the duplicate, setting merged_into_customer_id so the
//      audit trail survives, and recording a customer.merged activity on
//      the primary.
//
// All of the above runs in a single transaction. If any step fails the
// merge is fully reverted.

import { MergeCustomersInput } from '@wizeworks/crm-schemas';
import { withTenant } from '@wizeworks/db';
import type { Customer, Prisma } from '@wizeworks/db';

import { writeAuditLog } from '../audit';
import { crmSettings } from './crm-settings-service';
import { publishCrmEvent } from '../events';
import type { ServiceContext } from '../errors';
import { CrmNotFoundError, CrmValidationError } from '../errors';

/**
 * The journey, in order, for deciding which of two stages is further along.
 *
 * Deliberately NOT the schema enum's declaration order: that ends with `other`,
 * which is "we do not know", not the summit of the funnel. Ranked here so a
 * merge can never demote somebody — and `other` sits at the bottom, where an
 * unknown belongs.
 */
const LIFECYCLE_ORDER = [
  'other',
  'subscriber',
  'lead',
  'marketing_qualified_lead',
  'sales_qualified_lead',
  'opportunity',
  'customer',
  'evangelist',
] as const;

type LifecycleRank = (typeof LIFECYCLE_ORDER)[number];

export interface MergeResult {
  primary: Customer;
  /** Soft-deleted duplicates — `mergedIntoCustomerId` is set on each. */
  merged: Customer[];
  /** Rows reattached to the primary. */
  reattached: {
    activities: number;
    deals: number;
    tasks: number;
    addresses: number;
    /**
     * Everything else the person owned — orders, invoices, bookings, support
     * requests, consents, saved cards, credit. Counted together because the
     * number that matters to whoever pressed Merge is "did all of it come
     * across", not a breakdown of thirty tables.
     */
    everythingElse: number;
  };
}

/**
 * The tables a merge MOVES, beyond the four it reports individually.
 *
 * THIS LIST IS THE FIX FOR A REAL BUG. A merge used to relink activities,
 * deals, tasks and addresses — four of the thirty-seven tables that carry a
 * `customer_id`. Everything else stayed pointed at the record that had just
 * been retired: the invoice you sent them, the order they placed, the booking
 * they hold, the card they saved, the consent they gave. The survivor's totals
 * were rolled up from the duplicate's stats at the same time, so the contact
 * read "3 orders, $2,400" above an empty order list — the numbers said one
 * thing and the history said another, and neither was recoverable from the UI.
 *
 * `merge-covers-every-customer-table.test.ts` fails if a new table with a
 * `customer_id` appears and is not named here or in the exceptions below, so
 * the next table cannot be forgotten the way these thirty-two were.
 */
export const MOVED_MODELS = [
  // What they bought, owe and paid
  'order',
  'billingDocument',
  'paymentIntent',
  'customerPaymentMethod',
  'subscription',
  'discountUsage',
  'taxExemption',
  'cart',
  'checkoutSession',
  // What they asked for and said
  'ticket',
  'callRecord',
  'engagementThread',
  'chatConversation',
  'productReview',
  'reviewHelpfulVote',
  'productQuestion',
  'wishlist',
  'formSubmission',
  'customerDocument',
  // What they agreed to — consent especially, because a consent record left
  // behind is a person whose "yes" or "no" stops applying to the record that
  // survives them.
  'consentRecord',
  'emailSuppression',
  'emailEvent',
  'scheduledSend',
  'emailSequenceEnrollment',
  // Where they are expected to turn up
  'booking',
  'bookingAttendee',
  'bookingSeries',
  'waitlistEntry',
  'intakeSubmission',
  // What they are owed, and what is theirs. A backorder is a promise of units
  // to a specific person, so leaving it behind is the survivor waiting on a
  // queue position held by a record nobody can open. A consignment settlement
  // carries a customer when the stock is consigned FROM one — a workshop
  // holding a fleet's own parts — and that is money owed to whoever survives.
  'backorder',
  'consignmentSettlement',
  // The audit trail of segment moves. The membership rows themselves are
  // handled separately — they have a composite primary key that a plain move
  // would collide on.
  'segmentMembershipEvent',
  // Which rungs of which campaigns this person reached. If the two records are
  // one person then so is their campaign history, and leaving it behind makes
  // the survivor look like they never entered a funnel they converted. Nothing
  // here is unique per (funnel, stage, customer) — the repeat check is a read,
  // not a constraint — so a plain move cannot collide.
  'funnelStageEvent',
  // What we texted them, and whether they told us to stop (docs/152 D1).
  //
  // The suppression matters more than the message log. It is keyed on the PHONE
  // NUMBER, so a STOP keeps binding whichever record survives — but its
  // `customerId` pointer has to follow, or the survivor's screen shows a person
  // with no record of having opted out while the sends keep being refused, which
  // reads as a bug in the sending rather than as the person's own decision.
  'smsSuppression',
  'smsMessage',
] as const;

/**
 * Tables a merge handles somewhere other than `MOVED_MODELS` — listed so the
 * coverage test can tell "decided" from "forgotten", which is the whole point
 * of having the test.
 */
export const MERGE_HANDLED_ELSEWHERE = [
  // Moved by the four bulk updates whose counts are reported individually.
  'crmActivity',
  'deal',
  'task',
  'customerAddress',
  // Moved one row at a time, because a unique key already says "one per
  // customer" and a bulk update would raise instead of merging.
  'segmentMember',
  'b2bAccountContact',
  'accountCredit',
] as const;

/** A model that can be moved with one `updateMany`, structurally typed so the
 *  loop below needs no `any` — the coverage test proves each name resolves. */
interface CustomerOwnedModel {
  updateMany(args: {
    where: { customerId: { in: string[] } };
    data: { customerId: string };
  }): Promise<{ count: number }>;
}

/**
 * Move everything in `MOVED_MODELS`, plus the three tables that cannot be moved
 * with a plain update because a unique key already spells "one row per
 * customer" — moving would raise, and a raise here fails the whole merge.
 *
 * Returns how many rows changed hands.
 */
async function moveCustomerOwnedRows(
  tx: Prisma.TransactionClient,
  duplicateIds: string[],
  primaryId: string
): Promise<number> {
  const client = tx as unknown as Record<string, CustomerOwnedModel>;

  const plain = await Promise.all(
    MOVED_MODELS.map((model) =>
      client[model]!.updateMany({
        where: { customerId: { in: duplicateIds } },
        data: { customerId: primaryId },
      })
    )
  );
  let moved = plain.reduce((sum, result) => sum + result.count, 0);

  // Segment membership — primary key (segmentId, customerId). If the primary is
  // already in that segment the duplicate's row says the same thing, so it goes;
  // otherwise it moves. Membership is recomputed anyway, but leaving rows on a
  // retired contact makes the segment's count disagree with its list until the
  // next recompute.
  const memberships = await tx.segmentMember.findMany({
    where: { customerId: { in: duplicateIds } },
    select: { segmentId: true, customerId: true },
  });
  for (const membership of memberships) {
    const taken = await tx.segmentMember.findUnique({
      where: {
        segmentId_customerId: { segmentId: membership.segmentId, customerId: primaryId },
      },
      select: { segmentId: true },
    });
    if (taken === null) {
      await tx.segmentMember.update({
        where: {
          segmentId_customerId: {
            segmentId: membership.segmentId,
            customerId: membership.customerId,
          },
        },
        data: { customerId: primaryId },
      });
      moved += 1;
    } else {
      await tx.segmentMember.delete({
        where: {
          segmentId_customerId: {
            segmentId: membership.segmentId,
            customerId: membership.customerId,
          },
        },
      });
    }
  }

  // Being a named contact on a trade account — unique per (account, customer).
  // Same rule: keep one, drop the copy.
  const contactRoles = await tx.b2bAccountContact.findMany({
    where: { customerId: { in: duplicateIds } },
    select: { id: true, tenantId: true, accountId: true },
  });
  for (const role of contactRoles) {
    const taken = await tx.b2bAccountContact.findFirst({
      where: { tenantId: role.tenantId, accountId: role.accountId, customerId: primaryId },
      select: { id: true },
    });
    if (taken === null) {
      await tx.b2bAccountContact.update({
        where: { id: role.id },
        data: { customerId: primaryId },
      });
      moved += 1;
    } else {
      await tx.b2bAccountContact.delete({ where: { id: role.id } });
    }
  }

  // STORE CREDIT IS MONEY, so it is added rather than moved: one row per
  // (tenant, customer, currency) means the duplicate's balance cannot simply be
  // re-pointed when the primary already has one in that currency. The LEDGER
  // moves first — `AccountCreditTransaction` cascades from the credit row, so
  // deleting the emptied row before its transactions were re-parented would
  // silently destroy the history of where the balance came from.
  const dupCredits = await tx.accountCredit.findMany({
    where: { customerId: { in: duplicateIds } },
  });
  for (const credit of dupCredits) {
    const held = await tx.accountCredit.findFirst({
      where: { tenantId: credit.tenantId, customerId: primaryId, currency: credit.currency },
      select: { id: true, balanceCents: true },
    });
    if (held === null) {
      await tx.accountCredit.update({ where: { id: credit.id }, data: { customerId: primaryId } });
      moved += 1;
      continue;
    }
    await tx.accountCreditTransaction.updateMany({
      where: { accountCreditId: credit.id },
      data: { accountCreditId: held.id },
    });
    await tx.accountCredit.update({
      where: { id: held.id },
      data: { balanceCents: held.balanceCents + credit.balanceCents },
    });
    await tx.accountCredit.delete({ where: { id: credit.id } });
    moved += 1;
  }

  return moved;
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
    // ONE SITE, ONE BOOK. A tenant is a billing container; a SITE is the
    // business a customer actually deals with (docs/58 D2), and the customers
    // table says so itself — its unique key is (tenant, site, email), so the
    // same address on two sites is two legitimate records, not a collision.
    // Someone who books the tattoo studio and also buys from the print shop is
    // one human being and two customers, and collapsing them would hand each
    // business the other's order history. Merging is only ever within one book.
    const strayer = duplicates.find((d) => d.propertyId !== primary.propertyId);
    if (strayer !== undefined) {
      throw new CrmValidationError(
        'These contacts belong to different sites, so they are two separate customers — of two separate businesses. Merge only combines contacts within the same site.',
        [{ field: 'duplicateCustomerIds', message: 'must belong to the same site as the primary' }]
      );
    }

    const liveDuplicates = duplicates.filter((d) => d.deletedAt === null);
    if (liveDuplicates.length === 0) {
      // Nothing to merge — surface as a no-op rather than an error so the
      // caller can be idempotent.
      return {
        primary,
        merged: [],
        reattached: { activities: 0, deals: 0, tasks: 0, addresses: 0, everythingElse: 0 },
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

    // 1c. Everything else the person owned. See `MOVED_MODELS` — this is the
    // difference between "merging combines two halves of one person's history"
    // and a survivor whose totals were rolled up from records it cannot show.
    const everythingElse = await moveCustomerOwnedRows(tx, duplicateIds, input.primaryCustomerId);

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

    // DO-NOT-CONTACT ONLY EVER RATCHETS UP. `false` is not `null`, so the
    // fill-what-is-missing rule above would never have looked at it: merging
    // somebody who had asked not to be contacted into a record that had not
    // would have quietly re-opened them to marketing, and nothing would ever
    // have said so. One "no" in the group is a "no" for the survivor.
    const doNotContact = primary.doNotContact || liveDuplicates.some((d) => d.doNotContact);

    // THE FURTHEST-ALONG STAGE WINS, whichever record is being kept. Merging is
    // combining two halves of one person's history, and somebody who has bought
    // from you does not become a lead again because the record you happened to
    // keep was the newer stub. Same for the relationship type, where the
    // specific beats the default.
    // A stage the ranking has never heard of scores -1, so it can only ever lose
    // to a known one — an unrecognised value must not be able to win by accident.
    const rank = (stage: string): number => LIFECYCLE_ORDER.indexOf(stage as LifecycleRank);
    const stages = [primary.lifecycleStage, ...liveDuplicates.map((d) => d.lifecycleStage)];
    const lifecycleStage = stages.reduce((furthest, stage) =>
      rank(stage) > rank(furthest) ? stage : furthest
    );
    const specificType =
      primary.type !== 'retail'
        ? primary.type
        : (liveDuplicates.find((d) => d.type !== 'retail')?.type ?? primary.type);

    const updatedPrimary = await tx.customer.update({
      where: { id: primary.id },
      data: {
        totalSpent,
        orderCount,
        firstOrderAt,
        lastOrderAt,
        tags: [...mergedTags],
        doNotContact,
        lifecycleStage,
        type: specificType,
        email: filledScalar(primary.email, dupFields('email')),
        phone: filledScalar(primary.phone, dupFields('phone')),
        firstName: filledScalar(primary.firstName, dupFields('firstName')),
        lastName: filledScalar(primary.lastName, dupFields('lastName')),
        companyName: filledScalar(primary.companyName, dupFields('companyName')),
        jobTitle: filledScalar(primary.jobTitle, dupFields('jobTitle')),
        companyId: filledScalar(primary.companyId, dupFields('companyId')),
        authUserId: filledScalar(primary.authUserId, dupFields('authUserId')),
        // The rep who owns the relationship, and how the person asked to be
        // reached — both plain "keep whatever we know" fills, but both are
        // facts a merge used to throw away.
        assignedRepId: filledScalar(primary.assignedRepId, dupFields('assignedRepId')),
        preferredContactMethod: filledScalar(
          primary.preferredContactMethod,
          dupFields('preferredContactMethod')
        ),
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
            everythingElse,
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
        everythingElse,
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
 * NEVER ACROSS SITES. Every bucket key starts with the site the record belongs
 * to, because a site is a whole business (docs/58 D2) and one owner may run two
 * that share nothing. The customers table already draws this line — its unique
 * key is (tenant, site, email) — so the same address on two sites is not a
 * mistake to clean up, it is one person who deals with both businesses. Without
 * the site in the key those two match on email, score 100, and `bulkMerge`
 * combines them unwatched, handing each business the other's order history.
 *
 * Bounded by `limit`. Pagination is the caller's, and the surface says what the
 * bound was rather than implying it saw everything.
 */
export async function findLikelyDuplicates(
  ctx: ServiceContext,
  args: { limit?: number; propertyId?: string | null } = {}
): Promise<DuplicateGroup[]> {
  const settings = await crmSettings(ctx, args.propertyId ?? null);
  const enabled = new Set(settings.duplicateMatchRules);

  return withTenant(ctx, async (tx) => {
    const customers = await tx.customer.findMany({
      where: {
        deletedAt: null,
        // Looking at one site means its own contacts plus the tenant-wide ones,
        // which is exactly the list that site's Customers screen shows. Without
        // a site, every book is scanned — each still grouped separately below.
        ...(args.propertyId != null
          ? { OR: [{ propertyId: args.propertyId }, { propertyId: null }] }
          : {}),
      },
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
      // The site prefix is what keeps two businesses' customers apart; `~` marks
      // the tenant-wide book, which is its own bucket rather than a wildcard
      // that would chain every site's copy of one person into a single group.
      const book = c.propertyId ?? '~';
      if (enabled.has('email') && c.email) {
        push(byEmail, `${book}|${c.email.trim().toLowerCase()}`, c);
      }
      if (enabled.has('phone') && c.phone) {
        const key = phoneKey(c.phone);
        if (key) push(byPhone, `${book}|${key}`, c);
      }
      if (enabled.has('name_company') && c.lastName && c.companyName) {
        push(
          byNameCompany,
          `${book}|${c.lastName.trim().toLowerCase()}|${c.companyName.trim().toLowerCase()}`,
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
