// The payroll handoff (docs/149 §1) — the one thing sparx owes whoever actually
// runs payroll.
//
// THIS IS NOT PAYROLL AND NEVER BECOMES IT. Nothing here withholds anything,
// files anything, or pays anybody. It answers exactly one question — "how many
// approved hours did each person work in this period, and who are they in your
// system?" — and hands the answer over in a file the bureau can read.
//
// TWO COLUMNS EARN THEIR PLACE and would be easy to leave out:
//
//   • `Payroll ID` — their id in whatever runs payroll. Without it somebody
//     matches names in a spreadsheet every fortnight, which is where "M. Reyes"
//     and "Marta Reyes" become two people and one of them gets paid twice.
//   • `Unpriced hours` — approved hours no rate covers. They still have to be
//     PAID even though sparx cannot cost them, so omitting them from a payroll
//     file would underpay a real person. They are reported separately rather
//     than folded in, because the two numbers answer different questions: the
//     bureau needs the total hours, the owner needs to know which of them the
//     cost figure is missing.
//
// Decimal hours here, and only here. A timesheet screen says "7h 30m" because a
// person reads it; a payroll file says 7.50 because a payroll system parses it.

// The RFC-4180 writer @wizeworks/finance already ships. Reused rather than
// re-implemented: a second CSV encoder in the same monorepo is a second set of
// quoting rules, and the one place that difference surfaces is a file somebody
// else's payroll software rejects.
import { toCsv } from '@wizeworks/finance';
import { withTenant } from '@wizeworks/db';
import { deriveLabor, type LaborEntry } from './costing.js';
import { dayKey, type PayRate } from './pay.js';
import { toPayRate } from './rates.js';

export interface PayrollExportRow {
  staffMemberId: string;
  name: string;
  /** Their id in whoever runs payroll. Null when nobody has recorded one. */
  payrollId: string | null;
  employmentType: string;
  /** Approved minutes in the period, priced or not. */
  minutes: number;
  /** Approved minutes no pay rate covers — included in `minutes`, and called
   *  out because the person still worked them. */
  unpricedMinutes: number;
  /** What those hours cost the business, employer costs included. NULL — never
   *  zero — when nothing in the period could be priced at all. */
  costCents: number | null;
  currency: string;
}

export interface PayrollExport {
  from: Date;
  to: Date;
  rows: PayrollExportRow[];
  /** Approved minutes across everybody that no rate covers. Non-zero means the
   *  cost column is short and the caller must say so. */
  unpricedMinutes: number;
  filename: string;
  contentType: string;
  body: string;
}

/** Minutes → the decimal hours a payroll system parses. Two places: a quarter
 *  hour is 0.25, and rounding to one would turn every 10-minute overrun into
 *  either nothing or six. */
function decimalHours(minutes: number): string {
  return (minutes / 60).toFixed(2);
}

/**
 * Build the period's payroll file.
 *
 * Reads the same `deriveLabor` the ledger does rather than re-summing the
 * timesheet — one arithmetic, so the hours sent to payroll and the wages filed
 * in Finance can never disagree about the same fortnight.
 */
export async function buildPayrollExport(
  tenantId: string,
  period: { from: Date; to: Date; propertyId?: string | null }
): Promise<PayrollExport> {
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
        status: 'approved',
        workedOn: { gte: period.from, lte: period.to },
        // Hours that name no site belong to the person's main business — see the
        // identical note in `timesheetPeriod`. Dropping them here is the same bug
        // one step worse: on a screen it understates a cost, but on THIS file it
        // is an hour somebody worked that nobody pays them for.
        ...(period.propertyId
          ? { OR: [{ propertyId: period.propertyId }, { propertyId: null }] }
          : {}),
      },
    });
    return { members, entries };
  });

  const primaries = new Map(
    members.map((member) => [
      member.id,
      member.siteLinks.find((link) => link.isPrimary)?.propertyId ??
        member.siteLinks[0]?.propertyId ??
        null,
    ])
  );

  const byMember = new Map<string, typeof entries>();
  for (const entry of entries) {
    // A two-site person's unattributed hours pay out on ONE file, not both.
    if (
      entry.propertyId === null &&
      period.propertyId &&
      primaries.get(entry.staffMemberId) !== period.propertyId
    ) {
      continue;
    }
    byMember.set(entry.staffMemberId, [...(byMember.get(entry.staffMemberId) ?? []), entry]);
  }

  const rows: PayrollExportRow[] = [];
  for (const member of members) {
    const theirs = byMember.get(member.id) ?? [];
    const rates: PayRate[] = member.payRates.map(toPayRate);
    const salaried = rates.some((rate) => rate.basis === 'salary');

    // A salaried person with no logged time still belongs in the file — they are
    // paid by the calendar, and a payroll file that silently drops them is one
    // fortnight away from somebody not being paid. Everyone else with no hours
    // is simply absent from the period and stays out of it.
    if (theirs.length === 0 && !salaried) continue;

    const laborEntries: LaborEntry[] = theirs.map((entry) => ({
      workedOn: entry.workedOn,
      minutes: entry.minutes,
      propertyId: entry.propertyId,
      jobType: entry.jobType === 'order' || entry.jobType === 'booking' ? entry.jobType : null,
      jobId: entry.jobId,
    }));

    const derived = deriveLabor({
      entries: laborEntries,
      rates,
      periodStart: period.from,
      periodEnd: period.to,
      fallbackPropertyId: member.siteLinks.find((link) => link.isPrimary)?.propertyId ?? null,
    });

    const minutes = theirs.reduce((sum, entry) => sum + entry.minutes, 0);
    rows.push({
      staffMemberId: member.id,
      name: member.lastName ? `${member.firstName} ${member.lastName}` : member.firstName,
      payrollId: member.externalPayrollId,
      employmentType: member.employmentType,
      minutes,
      unpricedMinutes: derived.unpricedMinutes,
      // Null rather than zero when NOTHING could be priced. Zero is a
      // measurement and this is the absence of one.
      costCents:
        derived.totalCents === 0 && derived.unpricedMinutes > 0 ? null : derived.totalCents,
      currency: rates[0]?.currency ?? 'USD',
    });
  }

  const body = toCsv(
    [
      'Payroll ID',
      'Name',
      'Type',
      'Hours',
      'Unpriced hours',
      'Cost to business',
      'Currency',
      'Period start',
      'Period end',
    ],
    rows.map((row) => [
      row.payrollId ?? '',
      row.name,
      row.employmentType,
      decimalHours(row.minutes),
      // Blank, not "0.00", when there are none — an empty cell reads as "nothing
      // to flag" where a zero reads as a figure somebody computed.
      row.unpricedMinutes > 0 ? decimalHours(row.unpricedMinutes) : '',
      // Same rule for the money: unknown is empty, never 0.00.
      row.costCents === null ? '' : (row.costCents / 100).toFixed(2),
      row.currency,
      dayKey(period.from),
      dayKey(period.to),
    ])
  );

  return {
    from: period.from,
    to: period.to,
    rows,
    unpricedMinutes: rows.reduce((sum, row) => sum + row.unpricedMinutes, 0),
    filename: `hours-${dayKey(period.from)}-to-${dayKey(period.to)}.csv`,
    contentType: 'text/csv; charset=utf-8',
    body,
  };
}
