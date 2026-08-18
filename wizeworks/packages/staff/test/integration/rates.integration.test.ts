// Effective-dated pay rates, against a real Postgres.
//
// These exist because a rate window is the thing that explains a cost. If the
// window moves, or the reason for it disappears, the owner is left with a figure
// nobody can account for — and the two failures below both shipped:
//
//   • the note round-trip. `note` was validated by the schema, written to the
//     column, and rendered by a Note column on the person surface — but the
//     service's `toPayRate` never copied it out, so every annotated rate read
//     back empty. A write nobody can read is the same as no write at all.
//   • the boundary day. A `@db.Date` comes back at UTC midnight; read with local
//     getters it slides a day west of Greenwich, and a rate that starts a day
//     early is a rate applied to work it never covered.
//
// Excluded under CI (no database there) exactly like the other staff suites.

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createMember } from '../../src/members.js';
import { listRates, setRate } from '../../src/rates.js';
import { dayKey, rateInForceOn } from '../../src/pay.js';
import { createTestTenant, day, dropTestTenant, type TestTenant } from '../helpers.js';

let ctx: TestTenant;

beforeEach(async () => {
  ctx = await createTestTenant();
});

afterEach(async () => {
  await dropTestTenant(ctx.tenantId);
});

async function hire() {
  return createMember(ctx.tenantId, {
    firstName: 'Priya',
    lastName: 'Raghunathan',
    siteIds: [ctx.propertyId],
    primarySiteId: ctx.propertyId,
  });
}

describe('pay rate notes', () => {
  it('reads back the note it was given', async () => {
    const member = await hire();
    await setRate(ctx.tenantId, member.id, {
      basis: 'hourly',
      amountCents: 3250,
      burdenPercent: 22,
      effectiveFrom: day('2026-01-01'),
      note: 'Starting rate on hire',
    });

    const [rate] = await listRates(ctx.tenantId, member.id);
    expect(rate?.note).toBe('Starting rate on hire');
  });

  it('keeps a rate with no note as null rather than an empty string', async () => {
    const member = await hire();
    await setRate(ctx.tenantId, member.id, {
      basis: 'hourly',
      amountCents: 3000,
      effectiveFrom: day('2026-01-01'),
    });

    const [rate] = await listRates(ctx.tenantId, member.id);
    // Null means nobody wrote one. '' would mean somebody wrote nothing, which
    // is a different claim and renders as a blank cell instead of an em-dash.
    expect(rate?.note).toBeNull();
  });

  it('carries a note on each window of a raise, so the history explains itself', async () => {
    const member = await hire();
    await setRate(ctx.tenantId, member.id, {
      basis: 'hourly',
      amountCents: 3250,
      effectiveFrom: day('2026-01-01'),
      note: 'Starting rate on hire',
    });
    await setRate(ctx.tenantId, member.id, {
      basis: 'hourly',
      amountCents: 3600,
      effectiveFrom: day('2026-07-01'),
      note: 'Annual review',
    });

    const rates = await listRates(ctx.tenantId, member.id);
    const byNote = new Map(rates.map((r) => [r.note, r]));
    expect(byNote.get('Annual review')?.effectiveTo).toBeNull();
    // The predecessor was closed the day BEFORE the raise, and kept its own
    // reason — that is what lets last March's cost still explain itself.
    expect(dayKey(byNote.get('Starting rate on hire')!.effectiveTo!)).toBe('2026-06-30');
  });
});

describe('the boundary day', () => {
  it('stores the day it was given, not the day before it', async () => {
    const member = await hire();
    await setRate(ctx.tenantId, member.id, {
      basis: 'hourly',
      amountCents: 3250,
      effectiveFrom: day('2026-01-01'),
    });

    const [rate] = await listRates(ctx.tenantId, member.id);
    expect(dayKey(rate!.effectiveFrom)).toBe('2026-01-01');
  });

  it('is in force ON its first day and not the day before', async () => {
    const member = await hire();
    await setRate(ctx.tenantId, member.id, {
      basis: 'hourly',
      amountCents: 3250,
      effectiveFrom: day('2026-01-01'),
    });
    const rates = await listRates(ctx.tenantId, member.id);

    expect(rateInForceOn(rates, day('2026-01-01'))?.amountCents).toBe(3250);
    expect(rateInForceOn(rates, day('2025-12-31'))).toBeNull();
  });
});
