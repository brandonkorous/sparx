// The labour deriver, against a real Postgres.
//
// The unit suites prove the arithmetic. This proves the CHAIN: staff tables →
// approved time → a finance expense filed under `wages`, with the job
// allocations that make job profitability include labour. Everything here runs
// through `withTenant`, so it is also a live check that RLS lets the deriver do
// its job.
//
// Excluded under CI (no database there) exactly like the finance suites.

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { prisma, withTenant } from '@wizeworks/db';
import { categoryBySlug } from '@wizeworks/finance';

import { createMember } from '../../src/members.js';
import { setRate } from '../../src/rates.js';
import { approveTimeEntries, createTimeEntry } from '../../src/time.js';
import { deriveLaborForPeriod, deriveLaborForRoster } from '../../src/labor.js';
import { timesheetPeriod } from '../../src/timesheets.js';
import { createTestTenant, day, dropTestTenant, type TestTenant } from '../helpers.js';

let ctx: TestTenant;

const MARCH = { periodStart: day('2026-03-01'), periodEnd: day('2026-03-31') };

beforeEach(async () => {
  ctx = await createTestTenant();
});

afterEach(async () => {
  await dropTestTenant(ctx.tenantId);
});

/** An hourly person on the primary site, with a rate covering all of March. */
async function hireHourly(rateCents = 3000, burdenPercent = 0) {
  const member = await createMember(ctx.tenantId, {
    firstName: 'Sam',
    lastName: 'Okafor',
    siteIds: [ctx.propertyId],
    primarySiteId: ctx.propertyId,
  });
  await setRate(ctx.tenantId, member.id, {
    basis: 'hourly',
    amountCents: rateCents,
    burdenPercent,
    effectiveFrom: day('2026-01-01'),
  });
  return member;
}

async function logAndApprove(
  staffMemberId: string,
  entries: { workedOn: string; minutes: number; jobId?: string; propertyId?: string }[]
) {
  const ids: string[] = [];
  for (const e of entries) {
    const row = await createTimeEntry(ctx.tenantId, {
      staffMemberId,
      workedOn: day(e.workedOn),
      minutes: e.minutes,
      propertyId: e.propertyId ?? null,
      jobType: e.jobId ? 'order' : null,
      jobId: e.jobId ?? null,
    });
    ids.push(row.id);
  }
  return approveTimeEntries(ctx.tenantId, ids, null, new Date('2026-04-01T09:00:00Z'));
}

describe('deriveLaborForPeriod', () => {
  it('writes one wage expense, filed under the seeded wages category', async () => {
    const member = await hireHourly();
    await logAndApprove(member.id, [
      { workedOn: '2026-03-02', minutes: 480 },
      { workedOn: '2026-03-03', minutes: 240 },
    ]);

    const result = await deriveLaborForPeriod(ctx.tenantId, {
      staffMemberId: member.id,
      ...MARCH,
    });

    expect(result.expenseIds).toHaveLength(1);
    expect(result.totalCents).toBe(36_000);

    const wages = await categoryBySlug(ctx.tenantId, 'wages');
    const expense = await withTenant({ tenantId: ctx.tenantId }, (tx) =>
      tx.financeExpense.findFirstOrThrow({ where: { id: result.expenseIds[0] } })
    );
    expect(expense.categoryId).toBe(wages?.id);
    expect(expense.amountCents).toBe(36_000);
    expect(expense.source).toBe('labor');
    expect(expense.propertyId).toBe(ctx.propertyId);
    // The period the cost BELONGS to, not when anyone was paid — dated to the
    // last day worked (the 3rd), not the period's last day (the 31st).
    expect(expense.incurredAt.toISOString().slice(0, 10)).toBe('2026-03-03');
  });

  it('never dates an accrual in the future while the period is still running', async () => {
    // The defect this pins: `incurredAt` was the period's END, so approving
    // hours mid-month filed a cost dated the last of the month. Every
    // "1st → today" range excluded it, which is how the timesheet could say
    // "your spending now includes this period's wages" over a $0.00 Spending
    // list. Same month either way, so no profit figure moves.
    const member = await hireHourly();
    await logAndApprove(member.id, [
      { workedOn: '2026-03-02', minutes: 480 },
      { workedOn: '2026-03-11', minutes: 240 },
    ]);

    const result = await deriveLaborForPeriod(ctx.tenantId, {
      staffMemberId: member.id,
      ...MARCH,
    });

    const expense = await withTenant({ tenantId: ctx.tenantId }, (tx) =>
      tx.financeExpense.findFirstOrThrow({ where: { id: result.expenseIds[0] } })
    );
    const incurred = expense.incurredAt.toISOString().slice(0, 10);

    expect(incurred).toBe('2026-03-11');
    // Inside the period, so it still buckets into March.
    expect(incurred >= '2026-03-01' && incurred <= '2026-03-31').toBe(true);
    // Visible to a range that stops on the 13th — the actual user-facing test.
    expect(incurred <= '2026-03-13').toBe(true);
  });

  it('is idempotent — re-running updates the row instead of doubling the month', async () => {
    const member = await hireHourly();
    await logAndApprove(member.id, [{ workedOn: '2026-03-02', minutes: 480 }]);

    const first = await deriveLaborForPeriod(ctx.tenantId, { staffMemberId: member.id, ...MARCH });
    const second = await deriveLaborForPeriod(ctx.tenantId, { staffMemberId: member.id, ...MARCH });

    expect(second.expenseIds).toEqual(first.expenseIds);
    const count = await withTenant({ tenantId: ctx.tenantId }, (tx) =>
      tx.financeExpense.count({ where: { source: 'labor' } })
    );
    expect(count).toBe(1);
  });

  it('re-derives to a NEW total after a timesheet correction', async () => {
    const member = await hireHourly();
    const approved = await logAndApprove(member.id, [{ workedOn: '2026-03-02', minutes: 480 }]);
    await deriveLaborForPeriod(ctx.tenantId, { staffMemberId: member.id, ...MARCH });

    // Reopen, halve the hours, re-approve, re-derive — the correction path.
    await withTenant({ tenantId: ctx.tenantId }, (tx) =>
      tx.staffTimeEntry.updateMany({
        where: { id: { in: approved.approvedIds } },
        data: { minutes: 240, status: 'approved' },
      })
    );
    const again = await deriveLaborForPeriod(ctx.tenantId, { staffMemberId: member.id, ...MARCH });

    expect(again.totalCents).toBe(12_000);
    const expenses = await withTenant({ tenantId: ctx.tenantId }, (tx) =>
      tx.financeExpense.findMany({ where: { source: 'labor' } })
    );
    expect(expenses).toHaveLength(1);
    expect(expenses[0]?.amountCents).toBe(12_000);
  });

  it('writes the job allocations that make job profitability include labour', async () => {
    const member = await hireHourly();
    const orderId = crypto.randomUUID();
    await logAndApprove(member.id, [
      { workedOn: '2026-03-02', minutes: 480, jobId: orderId },
      { workedOn: '2026-03-03', minutes: 120 },
    ]);

    const result = await deriveLaborForPeriod(ctx.tenantId, { staffMemberId: member.id, ...MARCH });

    const allocations = await withTenant({ tenantId: ctx.tenantId }, (tx) =>
      tx.financeExpenseAllocation.findMany({ where: { expenseId: result.expenseIds[0] } })
    );
    expect(allocations).toHaveLength(1);
    expect(allocations[0]?.targetType).toBe('order');
    expect(allocations[0]?.targetId).toBe(orderId);
    // The job's own 8 hours, NOT the whole 10 — the sweeping-up time stays
    // unallocated rather than being charged to the one job that was recorded.
    expect(allocations[0]?.amountCents).toBe(24_000);
  });

  it('keeps two businesses apart instead of overwriting one with the other', async () => {
    // The reason the site is in the idempotency key. With `<staffId>:<period>`
    // alone, the second site's expense would replace the first on every run and
    // the month would silently come up short.
    const member = await createMember(ctx.tenantId, {
      firstName: 'Rae',
      lastName: 'Lindqvist',
      siteIds: [ctx.propertyId, ctx.secondPropertyId],
      primarySiteId: ctx.propertyId,
    });
    await setRate(ctx.tenantId, member.id, {
      basis: 'hourly',
      amountCents: 3000,
      effectiveFrom: day('2026-01-01'),
    });
    await logAndApprove(member.id, [
      { workedOn: '2026-03-02', minutes: 300, propertyId: ctx.propertyId },
      { workedOn: '2026-03-03', minutes: 180, propertyId: ctx.secondPropertyId },
    ]);

    const result = await deriveLaborForPeriod(ctx.tenantId, { staffMemberId: member.id, ...MARCH });
    expect(result.expenseIds).toHaveLength(2);

    const expenses = await withTenant({ tenantId: ctx.tenantId }, (tx) =>
      tx.financeExpense.findMany({ where: { source: 'labor' }, orderBy: { amountCents: 'desc' } })
    );
    expect(expenses.map((e) => [e.propertyId, e.amountCents])).toEqual([
      [ctx.propertyId, 15_000],
      [ctx.secondPropertyId, 9_000],
    ]);
  });

  it('derives NOTHING and reports unpriced hours when nobody set a rate', async () => {
    const member = await createMember(ctx.tenantId, {
      firstName: 'Uma',
      siteIds: [ctx.propertyId],
      primarySiteId: ctx.propertyId,
    });
    await logAndApprove(member.id, [{ workedOn: '2026-03-02', minutes: 480 }]);

    const result = await deriveLaborForPeriod(ctx.tenantId, { staffMemberId: member.id, ...MARCH });

    expect(result.expenseIds).toEqual([]);
    expect(result.unpricedMinutes).toBe(480);
    const count = await withTenant({ tenantId: ctx.tenantId }, (tx) =>
      tx.financeExpense.count({ where: { source: 'labor' } })
    );
    // No $0.00 expense. An unpriced hour is not a free hour.
    expect(count).toBe(0);
  });

  it('ignores time that has not been approved', async () => {
    const member = await hireHourly();
    await createTimeEntry(ctx.tenantId, {
      staffMemberId: member.id,
      workedOn: day('2026-03-02'),
      minutes: 480,
    });

    const result = await deriveLaborForPeriod(ctx.tenantId, { staffMemberId: member.id, ...MARCH });
    expect(result.totalCents).toBe(0);
    expect(result.expenseIds).toEqual([]);
  });

  it('adds employer burden to what reaches the ledger', async () => {
    const member = await hireHourly(3000, 20);
    await logAndApprove(member.id, [{ workedOn: '2026-03-02', minutes: 60 }]);
    const result = await deriveLaborForPeriod(ctx.tenantId, { staffMemberId: member.id, ...MARCH });
    expect(result.totalCents).toBe(3_600);
  });
});

describe('deriveLaborForRoster', () => {
  it('includes a salaried person who logged nothing at all', async () => {
    // The obvious bug this guards: selecting only from timesheets drops every
    // salaried person who never clocks — usually the biggest wages in the
    // business.
    const salaried = await createMember(ctx.tenantId, {
      firstName: 'Ines',
      siteIds: [ctx.propertyId],
      primarySiteId: ctx.propertyId,
    });
    await setRate(ctx.tenantId, salaried.id, {
      basis: 'salary',
      amountCents: 7_300_000, // $200/day across a 365-day year
      effectiveFrom: day('2026-01-01'),
    });

    const { staffMemberIds, derived } = await deriveLaborForRoster(ctx.tenantId, MARCH);

    expect(staffMemberIds).toContain(salaried.id);
    expect(derived.reduce((sum, d) => sum + d.totalCents, 0)).toBe(31 * 20_000);
  });
});

describe('timesheetPeriod', () => {
  it('shows an uncostable row as null, never as zero', async () => {
    const paid = await hireHourly();
    await logAndApprove(paid.id, [{ workedOn: '2026-03-02', minutes: 120 }]);

    const unpaid = await createMember(ctx.tenantId, {
      firstName: 'Nas',
      siteIds: [ctx.propertyId],
      primarySiteId: ctx.propertyId,
    });
    await logAndApprove(unpaid.id, [{ workedOn: '2026-03-02', minutes: 480 }]);

    const grid = await timesheetPeriod(ctx.tenantId, {
      from: MARCH.periodStart,
      to: MARCH.periodEnd,
    });

    const paidRow = grid.rows.find((r) => r.staffMemberId === paid.id);
    const unpaidRow = grid.rows.find((r) => r.staffMemberId === unpaid.id);

    expect(paidRow?.costCents).toBe(6_000);
    expect(unpaidRow?.costCents).toBeNull();
    expect(unpaidRow?.costCents).not.toBe(0);
    expect(unpaidRow?.approvedMinutes).toBe(480);
    // The number the screen leads with when it is non-zero.
    expect(grid.rowsNeedingRates).toBe(1);
    // The total counts only what is costable — it does NOT silently include the
    // person whose hours nobody can price.
    expect(grid.costCents).toBe(6_000);
  });

  // Every test above this line calls timesheetPeriod with NO propertyId, which is
  // how the site-scoped path shipped broken: an hour naming no site was filtered
  // out while its OWNER stayed on the grid, so 7h 30m of real work rendered as a
  // confident 0h with nothing to suggest anything was missing.
  it('counts hours that name no site on their main business’s grid', async () => {
    const member = await hireHourly();
    await logAndApprove(member.id, [{ workedOn: '2026-03-02', minutes: 450 }]);

    const grid = await timesheetPeriod(ctx.tenantId, {
      from: MARCH.periodStart,
      to: MARCH.periodEnd,
      propertyId: ctx.propertyId,
    });

    const row = grid.rows.find((r) => r.staffMemberId === member.id);
    expect(row?.approvedMinutes).toBe(450);
    expect(row?.costCents).toBe(22_500);
  });

  it('counts hours still waiting to be approved on a site-scoped grid', async () => {
    const member = await hireHourly();
    await createTimeEntry(ctx.tenantId, {
      staffMemberId: member.id,
      workedOn: day('2026-03-02'),
      minutes: 450,
      propertyId: null,
    });

    const grid = await timesheetPeriod(ctx.tenantId, {
      from: MARCH.periodStart,
      to: MARCH.periodEnd,
      propertyId: ctx.propertyId,
    });

    const row = grid.rows.find((r) => r.staffMemberId === member.id);
    // Waiting, so it is on the grid to be approved but not yet a cost.
    expect(row?.submittedMinutes).toBe(450);
    expect(grid.pendingMinutes).toBe(450);
  });

  it('does not show a second business hours that fall to the first', async () => {
    const member = await createMember(ctx.tenantId, {
      firstName: 'Sam',
      lastName: 'Okafor',
      siteIds: [ctx.propertyId, ctx.secondPropertyId],
      primarySiteId: ctx.propertyId,
    });
    await setRate(ctx.tenantId, member.id, {
      basis: 'hourly',
      amountCents: 3000,
      effectiveFrom: day('2026-01-01'),
    });
    await logAndApprove(member.id, [{ workedOn: '2026-03-02', minutes: 450 }]);

    const other = await timesheetPeriod(ctx.tenantId, {
      from: MARCH.periodStart,
      to: MARCH.periodEnd,
      propertyId: ctx.secondPropertyId,
    });

    // She IS on that roster, so she has a row — but the hours belong to her main
    // business and must not be counted a second time here.
    const row = other.rows.find((r) => r.staffMemberId === member.id);
    expect(row).toBeDefined();
    expect(row?.approvedMinutes).toBe(0);
  });

  it('still counts an hour that names the site it was worked at', async () => {
    const member = await createMember(ctx.tenantId, {
      firstName: 'Sam',
      lastName: 'Okafor',
      siteIds: [ctx.propertyId, ctx.secondPropertyId],
      primarySiteId: ctx.propertyId,
    });
    await setRate(ctx.tenantId, member.id, {
      basis: 'hourly',
      amountCents: 3000,
      effectiveFrom: day('2026-01-01'),
    });
    await logAndApprove(member.id, [
      { workedOn: '2026-03-02', minutes: 480, propertyId: ctx.secondPropertyId },
    ]);

    const other = await timesheetPeriod(ctx.tenantId, {
      from: MARCH.periodStart,
      to: MARCH.periodEnd,
      propertyId: ctx.secondPropertyId,
    });

    expect(other.rows.find((r) => r.staffMemberId === member.id)?.approvedMinutes).toBe(480);
  });
});

describe('tenant isolation', () => {
  it('cascades every staff table from the tenant', async () => {
    const member = await hireHourly();
    await logAndApprove(member.id, [{ workedOn: '2026-03-02', minutes: 60 }]);

    const doomed = ctx.tenantId;
    await dropTestTenant(doomed);

    const [members, entries, rates] = await Promise.all([
      prisma.staffMember.count({ where: { tenantId: doomed } }),
      prisma.staffTimeEntry.count({ where: { tenantId: doomed } }),
      prisma.staffPayRate.count({ where: { tenantId: doomed } }),
    ]);
    expect([members, entries, rates]).toEqual([0, 0, 0]);

    // afterEach deletes again; make that a no-op rather than a failure.
    ctx = await createTestTenant();
  });
});
