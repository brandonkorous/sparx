// The timesheet grid — a period, everyone on it, and what is waiting to be
// approved.
//
// This is the screen that gates the ledger, so it has one job beyond adding up
// hours: it must show what CANNOT be costed as clearly as what can. A person
// with fourteen approved hours and no pay rate is not a zero on this grid, they
// are a row that says "no pay rate set" — because a zero here becomes a zero in
// the profit figure, and the owner reads that as a month where labour was free.

import { withTenant } from '@sparx/db';
import { deriveLabor, type LaborEntry } from './costing.js';
import { dayKey, type PayBasis } from './pay.js';
import { toPayRate } from './rates.js';

export interface TimesheetRow {
  staffMemberId: string;
  name: string;
  status: string;
  /** Everything logged in the period, whatever its approval state. */
  totalMinutes: number;
  submittedMinutes: number;
  approvedMinutes: number;
  /** Still on the clock right now — deliberately separate, since it has no
   *  duration yet and counting it would make the grid move on every refresh. */
  openEntries: number;
  /**
   * What the approved time costs, or null when it cannot be costed at all.
   *
   * NULL IS NOT ZERO. Null means no pay rate covers this person's work in this
   * period, so the honest cell is "—" with a prompt, never "$0.00".
   */
  costCents: number | null;
  /** Approved minutes that no rate covers. Non-zero means `costCents` is partial. */
  unpricedMinutes: number;
  unpricedDays: string[];
  bases: PayBasis[];
}

export interface TimesheetPeriod {
  from: Date;
  to: Date;
  rows: TimesheetRow[];
  /** The sum of everything costable. Rows that cannot be costed are excluded
   *  rather than counted as zero, and `rowsNeedingRates` says how many. */
  costCents: number;
  approvedMinutes: number;
  pendingMinutes: number;
  rowsNeedingRates: number;
}

/**
 * Build the grid for a period.
 *
 * One read of the roster, one read of the entries, then the same pure
 * `deriveLabor` the ledger uses — so the number on this screen and the number
 * that lands in finance are computed by one function, not two that agree today.
 */
export async function timesheetPeriod(
  tenantId: string,
  period: { from: Date; to: Date; propertyId?: string | null }
): Promise<TimesheetPeriod> {
  const { members, entries } = await withTenant({ tenantId }, async (tx) => {
    const members = await tx.staffMember.findMany({
      where: {
        archivedAt: null,
        ...(period.propertyId ? { siteLinks: { some: { propertyId: period.propertyId } } } : {}),
      },
      include: { siteLinks: true, payRates: true },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
    });
    const entries = await tx.staffTimeEntry.findMany({
      where: {
        workedOn: { gte: period.from, lte: period.to },
        // An hour that NAMES no site still belongs somewhere: to the person's
        // main business, which is what `fallbackPropertyId` below already
        // assumes and what the person surface promises on screen ("the main one
        // is where it goes when a shift names none"). Filtering those out here
        // was a silent data loss of the worst shape — the member row was still
        // listed (it matches on `siteLinks` above), so a real 7h 30m rendered as
        // a confident 0h rather than as anything missing. Ownership of a null
        // entry is settled per member below, so a two-site person's unattributed
        // hours land on ONE grid rather than being counted on both.
        ...(period.propertyId
          ? { OR: [{ propertyId: period.propertyId }, { propertyId: null }] }
          : {}),
      },
    });
    return { members, entries };
  });

  /** The site an unattributed hour falls to — their main one, else their only one. */
  const primaryOf = (member: (typeof members)[number]): string | null =>
    member.siteLinks.find((l) => l.isPrimary)?.propertyId ??
    member.siteLinks[0]?.propertyId ??
    null;

  const primaries = new Map(members.map((member) => [member.id, primaryOf(member)]));

  const byMember = new Map<string, typeof entries>();
  for (const entry of entries) {
    // A null entry only counts on the grid of the person's main business.
    if (
      entry.propertyId === null &&
      period.propertyId &&
      primaries.get(entry.staffMemberId) !== period.propertyId
    ) {
      continue;
    }
    const bucket = byMember.get(entry.staffMemberId) ?? [];
    bucket.push(entry);
    byMember.set(entry.staffMemberId, bucket);
  }

  const rows: TimesheetRow[] = members.map((member) => {
    const mine = byMember.get(member.id) ?? [];
    const approved = mine.filter((e) => e.status === 'approved');
    const submitted = mine.filter((e) => e.status === 'submitted');

    const primary = primaries.get(member.id) ?? null;

    const laborEntries: LaborEntry[] = approved.map((e) => ({
      workedOn: e.workedOn,
      minutes: e.minutes,
      propertyId: e.propertyId,
      jobType: e.jobType as 'order' | 'booking' | null,
      jobId: e.jobId,
    }));

    const derivation = deriveLabor({
      periodStart: period.from,
      periodEnd: period.to,
      rates: member.payRates.map(toPayRate),
      entries: laborEntries,
      fallbackPropertyId: primary,
    });

    // Costable means a rate window actually covered some of the period. A
    // salaried person with no logged time IS costable (their salary accrued);
    // someone with hours and no rate at all is NOT, and gets a null.
    const costable = derivation.bases.length > 0;

    return {
      staffMemberId: member.id,
      name: [member.firstName, member.lastName].filter(Boolean).join(' '),
      status: member.status,
      totalMinutes: mine.reduce((sum, e) => sum + e.minutes, 0),
      submittedMinutes: submitted.reduce((sum, e) => sum + e.minutes, 0),
      approvedMinutes: approved.reduce((sum, e) => sum + e.minutes, 0),
      openEntries: mine.filter((e) => e.status === 'open').length,
      costCents: costable ? derivation.totalCents : null,
      unpricedMinutes: derivation.unpricedMinutes,
      unpricedDays: derivation.unpricedDays,
      bases: derivation.bases,
    };
  });

  return {
    from: period.from,
    to: period.to,
    rows,
    costCents: rows.reduce((sum, r) => sum + (r.costCents ?? 0), 0),
    approvedMinutes: rows.reduce((sum, r) => sum + r.approvedMinutes, 0),
    pendingMinutes: rows.reduce((sum, r) => sum + r.submittedMinutes, 0),
    // The count the screen leads with when it is non-zero: how many people's
    // labour cannot be priced at all.
    rowsNeedingRates: rows.filter((r) => r.costCents === null && r.approvedMinutes > 0).length,
  };
}

/** The calendar month containing `date`, in UTC — the default timesheet period,
 *  and the same span the labour deriver's `periodKey` names by its month. */
export function monthPeriod(date: Date): { from: Date; to: Date } {
  const from = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
  const to = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0));
  return { from, to };
}

/** `2026-03-01` → the period label a person would say out loud. */
export function periodLabel(from: Date, to: Date): string {
  const month = from.toLocaleString('en-US', { month: 'long', timeZone: 'UTC' });
  const sameMonth = dayKey(from).slice(0, 7) === dayKey(to).slice(0, 7);
  return sameMonth ? `${month} ${from.getUTCFullYear()}` : `${dayKey(from)} – ${dayKey(to)}`;
}
