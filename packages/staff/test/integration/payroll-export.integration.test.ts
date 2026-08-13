// The payroll handoff, against a real Postgres.
//
// Four of these tests exist because getting them wrong UNDERPAYS A REAL PERSON,
// which is a different class of bug from a wrong figure on a screen:
//
//   • unpriced hours are ON the file (they were worked, so they must be paid)
//     and flagged separately (sparx cannot say what they cost);
//   • a salaried person with no logged time is on the file, because they are
//     paid by the calendar and a payroll file that drops them is one fortnight
//     from somebody not being paid;
//   • the cost column is EMPTY, never 0.00, when nothing could be priced;
//   • only APPROVED time travels — unapproved hours are a claim, not a fact.
//
// Excluded under CI (no database there) exactly like the other staff suites.

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createMember } from '../../src/members.js';
import { setRate } from '../../src/rates.js';
import { approveTimeEntries, createTimeEntry } from '../../src/time.js';
import { buildPayrollExport } from '../../src/payroll-export.js';
import { createTestTenant, day, dropTestTenant, type TestTenant } from '../helpers.js';

let ctx: TestTenant;

const MARCH = { from: day('2026-03-01'), to: day('2026-03-31') };

beforeEach(async () => {
  ctx = await createTestTenant();
});

afterEach(async () => {
  await dropTestTenant(ctx.tenantId);
});

async function hire(firstName: string, payrollId: string | null) {
  return createMember(ctx.tenantId, {
    firstName,
    lastName: 'Okonjo',
    externalPayrollId: payrollId,
    siteIds: [ctx.propertyId],
    primarySiteId: ctx.propertyId,
  });
}

async function logApproved(staffMemberId: string, entries: { on: string; minutes: number }[]) {
  const ids: string[] = [];
  for (const entry of entries) {
    const row = await createTimeEntry(ctx.tenantId, {
      staffMemberId,
      workedOn: day(entry.on),
      minutes: entry.minutes,
      propertyId: ctx.propertyId,
    });
    ids.push(row.id);
  }
  await approveTimeEntries(ctx.tenantId, ids, null, new Date('2026-04-01T09:00:00Z'));
}

/** The data rows of the CSV, split on CRLF, header dropped. */
function dataLines(body: string): string[] {
  return body.trim().split('\r\n').slice(1);
}

describe('buildPayrollExport', () => {
  it('carries the payroll id so nobody matches names in a spreadsheet', async () => {
    const member = await hire('Dave', 'EMP-0114');
    await setRate(ctx.tenantId, member.id, {
      basis: 'hourly',
      amountCents: 2800,
      burdenPercent: 22,
      effectiveFrom: day('2026-01-01'),
    });
    await logApproved(member.id, [
      { on: '2026-03-02', minutes: 480 },
      { on: '2026-03-03', minutes: 240 },
    ]);

    const result = await buildPayrollExport(ctx.tenantId, MARCH);

    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]?.payrollId).toBe('EMP-0114');
    expect(result.rows[0]?.minutes).toBe(720);
    // 12 hours at $28 plus 22% employer costs.
    expect(result.rows[0]?.costCents).toBe(40992);
    expect(dataLines(result.body)[0]).toContain('EMP-0114');
    // Decimal hours, because a payroll system parses this — not "12h".
    expect(dataLines(result.body)[0]).toContain('12.00');
  });

  it('puts unpriced hours ON the file and flags them — they still have to be paid', async () => {
    const member = await hire('Marta', 'EMP-0119');
    // No rate at all. The hours are real; their cost is unknown.
    await logApproved(member.id, [{ on: '2026-03-02', minutes: 480 }]);

    const result = await buildPayrollExport(ctx.tenantId, MARCH);

    expect(result.rows[0]?.minutes).toBe(480);
    expect(result.rows[0]?.unpricedMinutes).toBe(480);
    // NULL, never 0 — zero is a measurement and this is the absence of one.
    expect(result.rows[0]?.costCents).toBeNull();
    expect(result.unpricedMinutes).toBe(480);

    const cells = dataLines(result.body)[0]?.split(',') ?? [];
    // Payroll ID, Name, Type, Hours, Unpriced hours, Cost, …
    expect(cells[3]).toBe('8.00');
    expect(cells[4]).toBe('8.00');
    // Empty, not "0.00" — a zero here reads as a figure somebody computed.
    expect(cells[5]).toBe('');
  });

  it('includes a salaried person who logged nothing', async () => {
    const salaried = await hire('Priya', 'EMP-0130');
    await setRate(ctx.tenantId, salaried.id, {
      basis: 'salary',
      amountCents: 6_000_000,
      effectiveFrom: day('2026-01-01'),
    });

    const result = await buildPayrollExport(ctx.tenantId, MARCH);

    // On the file with zero HOURS — which is true — and a real cost, because a
    // salary is incurred by the calendar rather than by the timesheet.
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]?.minutes).toBe(0);
    expect(result.rows[0]?.costCents).toBeGreaterThan(0);
  });

  it('leaves out an hourly person with no hours in the period', async () => {
    const member = await hire('Sam', 'EMP-0122');
    await setRate(ctx.tenantId, member.id, {
      basis: 'hourly',
      amountCents: 2200,
      effectiveFrom: day('2026-01-01'),
    });
    await logApproved(member.id, [{ on: '2026-02-10', minutes: 480 }]);

    const result = await buildPayrollExport(ctx.tenantId, MARCH);

    // February's hours are February's. Nobody worked in March, so March's file
    // is empty rather than carrying a row of zeroes.
    expect(result.rows).toHaveLength(0);
  });

  it('ignores time nobody has approved', async () => {
    const member = await hire('Dave', 'EMP-0114');
    await setRate(ctx.tenantId, member.id, {
      basis: 'hourly',
      amountCents: 2800,
      effectiveFrom: day('2026-01-01'),
    });
    // Created but never approved — a claim, not a fact.
    await createTimeEntry(ctx.tenantId, {
      staffMemberId: member.id,
      workedOn: day('2026-03-02'),
      minutes: 480,
      propertyId: ctx.propertyId,
    });

    const result = await buildPayrollExport(ctx.tenantId, MARCH);
    expect(result.rows).toHaveLength(0);
  });

  it('names the file after the period it covers', async () => {
    const result = await buildPayrollExport(ctx.tenantId, MARCH);
    expect(result.filename).toBe('hours-2026-03-01-to-2026-03-31.csv');
    expect(result.contentType).toContain('text/csv');
  });
});
