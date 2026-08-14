// The labour deriver — persistence. The arithmetic is in `costing.ts`.
//
// This is the one integration that justifies building staff next to finance
// (docs/149 §4): approved time in, one finance expense per (person, period, site)
// out, filed under the seeded `wages` category, carrying the job allocations that
// make job profitability include labour rather than parts alone.
//
// Two rules it enforces that are easy to lose in a refactor:
//
//   • APPROVAL IS THE TRIGGER, not clock-out. Only `status: 'approved'` entries
//     are read, so a mistyped shift cannot move the month's profit before anyone
//     has looked at it.
//   • IT NEVER INVENTS A CATEGORY. Without finance installed there is no `wages`
//     category, and filing labour somewhere the owner never agreed to is worse
//     than not filing it — so it raises instead.

import { withTenant, type TxClient } from '@sparx/db';
import { categoryBySlug, upsertDerivedExpense } from '@sparx/finance';
import { deriveLabor, type LaborDerivation } from './costing.js';
import { WagesCategoryMissingError } from './errors.js';
import { periodKey } from './pay.js';
import { toPayRate } from './rates.js';

export interface DeriveResult extends LaborDerivation {
  /** One expense id per site that carried cost. Empty when nothing was derivable. */
  expenseIds: string[];
}

/**
 * Derive one person's labour for a period into the finance ledger.
 *
 * Idempotent by construction: `(tenantId, sourceType, sourceId)` is unique on
 * `finance_expenses`, so re-running after a corrected timesheet UPDATES the row
 * rather than doubling the month.
 *
 * THE SITE IS IN THE KEY, deliberately. docs/149 §4 writes the identity as
 * `<staffId>:<periodKey>`, but the same paragraph specifies one expense per staff
 * member per period PER SITE. With the site left out, someone who works both of
 * an owner's businesses would have their second site's cost overwrite the first
 * on every run and the month would silently come up short — so the shipped key is
 * `<staffId>:<periodKey>:<siteId|none>`.
 */
export async function deriveLaborForPeriod(
  tenantId: string,
  input: { staffMemberId: string; periodStart: Date; periodEnd: Date },
  tx?: TxClient
): Promise<DeriveResult> {
  const run = async (client: TxClient): Promise<DeriveResult> => {
    const member = await client.staffMember.findFirst({
      where: { id: input.staffMemberId },
      include: { siteLinks: true, payRates: true },
    });
    if (!member) return emptyResult();

    const entries = await client.staffTimeEntry.findMany({
      where: {
        staffMemberId: input.staffMemberId,
        status: 'approved',
        workedOn: { gte: input.periodStart, lte: input.periodEnd },
      },
    });

    const primary =
      member.siteLinks.find((l) => l.isPrimary)?.propertyId ??
      member.siteLinks[0]?.propertyId ??
      null;

    const derivation = deriveLabor({
      periodStart: input.periodStart,
      periodEnd: input.periodEnd,
      rates: member.payRates.map(toPayRate),
      entries: entries.map((e) => ({
        workedOn: e.workedOn,
        minutes: e.minutes,
        propertyId: e.propertyId,
        jobType: e.jobType as 'order' | 'booking' | null,
        jobId: e.jobId,
      })),
      fallbackPropertyId: primary,
    });

    const payable = derivation.perSite.filter((s) => s.amountCents > 0);
    if (payable.length === 0) return { ...derivation, expenseIds: [] };

    const wages = await categoryBySlug(tenantId, 'wages');
    if (!wages) throw new WagesCategoryMissingError();

    const key = periodKey(input.periodStart, input.periodEnd);
    const name = [member.firstName, member.lastName].filter(Boolean).join(' ');
    const expenseIds: string[] = [];

    // The last day actually WORKED, per site — the date the accrual carries.
    //
    // This used to be `input.periodEnd`, which post-dates the cost whenever the
    // period is still running: approving hours on the 13th filed a cost dated
    // the 31st. Every "so far" range then excluded it, so the timesheet said
    // "your spending and profit figures now include this period's wages" and
    // Spending showed $0.00 on the same screen. Work already done must not
    // produce a cost dated in the future.
    //
    // Profit is unaffected: the last worked day is always inside the period, so
    // the cost buckets into the same month either way, and for a closed period
    // nothing about the figure moves.
    //
    // `?? primary` mirrors `fallbackPropertyId` above — an entry with no site of
    // its own belongs to the person's main business, and must land in the same
    // bucket here as it did in the derivation.
    const lastWorked = new Map<string, Date>();
    for (const entry of entries) {
      const bucket = entry.propertyId ?? primary ?? 'none';
      const current = lastWorked.get(bucket);
      if (!current || entry.workedOn > current) lastWorked.set(bucket, entry.workedOn);
    }

    for (const site of payable) {
      const expense = await upsertDerivedExpense(
        tenantId,
        'staff_period',
        `${input.staffMemberId}:${key}:${site.propertyId ?? 'none'}`,
        {
          propertyId: site.propertyId,
          categoryId: wages.id,
          description: `Wages — ${name}, ${key}`,
          amountCents: site.amountCents,
          currency: 'USD',
          taxCents: 0,
          // The period the cost BELONGS to, which is what profit buckets on —
          // never when anyone was actually paid. Finance's two-date rule. Dated
          // to the last day worked rather than the period's last day, so an
          // open period's accrual is never in the future (see `lastWorked`).
          incurredAt: lastWorked.get(site.propertyId ?? 'none') ?? input.periodEnd,
          allocations: site.allocations.map((a) => ({
            targetType: a.targetType,
            targetId: a.targetId,
            amountCents: a.amountCents,
          })),
          attachmentAssetIds: [],
        },
        'labor',
        client
      );
      expenseIds.push(expense.id);
    }

    return { ...derivation, expenseIds };
  };

  return tx ? run(tx) : withTenant({ tenantId }, run);
}

/**
 * Derive the whole roster for a period.
 *
 * THE SET IS A UNION OF TWO GROUPS, and missing the second is the obvious bug:
 *
 *   1. everyone with approved time in the period, and
 *   2. everyone on a SALARY whose rate window touches the period, whether or not
 *      they logged a single minute.
 *
 * A salary is incurred by the calendar. Selecting only from timesheets would
 * silently drop every salaried person who did not clock — which, since salaried
 * staff are usually the ones who never clock, means the biggest wages in the
 * business would be the ones missing from the wages figure.
 *
 * Sequential rather than concurrent on purpose: each call opens its own tenant
 * transaction, and a roster of two hundred people firing at once is a connection
 * storm against a pool the rest of the platform shares.
 */
export async function deriveLaborForRoster(
  tenantId: string,
  period: { periodStart: Date; periodEnd: Date }
): Promise<{ derived: DeriveResult[]; staffMemberIds: string[] }> {
  const staffMemberIds = await withTenant({ tenantId }, async (tx) => {
    const worked = await tx.staffTimeEntry.findMany({
      where: {
        status: 'approved',
        workedOn: { gte: period.periodStart, lte: period.periodEnd },
      },
      select: { staffMemberId: true },
      distinct: ['staffMemberId'],
    });
    const salaried = await tx.staffPayRate.findMany({
      where: {
        basis: 'salary',
        effectiveFrom: { lte: period.periodEnd },
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: period.periodStart } }],
      },
      select: { staffMemberId: true },
      distinct: ['staffMemberId'],
    });
    return [...new Set([...worked, ...salaried].map((r) => r.staffMemberId))];
  });

  const derived: DeriveResult[] = [];
  for (const staffMemberId of staffMemberIds) {
    derived.push(await deriveLaborForPeriod(tenantId, { staffMemberId, ...period }));
  }
  return { derived, staffMemberIds };
}

function emptyResult(): DeriveResult {
  return {
    perSite: [],
    totalCents: 0,
    unpricedMinutes: 0,
    unpricedDays: [],
    bases: [],
    expenseIds: [],
  };
}
