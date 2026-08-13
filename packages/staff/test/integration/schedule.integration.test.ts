// The rota, the leave queue, and the shape approval hands back — against a real
// Postgres.
//
// Nothing here reaches the ledger (labor.integration.test.ts owns that chain).
// What it covers is the handful of places where the SERVICE has to know
// something the schema and the request schemas cannot:
//
//   • a PATCH that inverts a shift window sees only the field that moved, so the
//     pair has to be validated against the stored row;
//   • approval reports what it ACTUALLY moved, and the caller publishes from
//     that — approving an already-approved timesheet must not re-derive a month;
//   • cancelling approved leave has to take the booking blackout back with it.
//
// Excluded under CI (no database there) exactly like the finance suites.

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { withTenant } from '@sparx/db';

import { createMember } from '../../src/members.js';
import { createTimeEntry, approveTimeEntries } from '../../src/time.js';
import {
  cancelTimeOff,
  createShift,
  decideTimeOff,
  listShifts,
  listTimeOff,
  publishShifts,
  requestTimeOff,
  updateShift,
} from '../../src/schedule.js';
import { InvalidShiftWindowError } from '../../src/errors.js';
import { createTestTenant, day, dropTestTenant, type TestTenant } from '../helpers.js';

let ctx: TestTenant;

beforeEach(async () => {
  ctx = await createTestTenant();
});

afterEach(async () => {
  await dropTestTenant(ctx.tenantId);
});

async function hire(firstName = 'Rae') {
  return createMember(ctx.tenantId, {
    firstName,
    lastName: 'Whitfield',
    siteIds: [ctx.propertyId],
    primarySiteId: ctx.propertyId,
  });
}

const MONDAY_0800 = new Date('2026-03-02T08:00:00Z');
const MONDAY_1600 = new Date('2026-03-02T16:00:00Z');

describe('shifts', () => {
  it('refuses a PATCH that would end a shift before it starts', async () => {
    const member = await hire();
    const shift = await createShift(ctx.tenantId, {
      staffMemberId: member.id,
      startsAt: MONDAY_0800,
      endsAt: MONDAY_1600,
    });

    // Only the END moves. Nothing upstream can see both halves, and the table's
    // CHECK would answer with a constraint violation rather than a message.
    await expect(
      updateShift(ctx.tenantId, shift.id, { endsAt: new Date('2026-03-02T07:00:00Z') })
    ).rejects.toBeInstanceOf(InvalidShiftWindowError);

    // And the stored row is untouched — a rejected edit must not half-apply.
    const [stored] = await listShifts(ctx.tenantId, { staffMemberId: member.id });
    expect(stored?.endsAt.toISOString()).toBe(MONDAY_1600.toISOString());
  });

  it('moving only the START is validated against the stored end', async () => {
    const member = await hire();
    const shift = await createShift(ctx.tenantId, {
      staffMemberId: member.id,
      startsAt: MONDAY_0800,
      endsAt: MONDAY_1600,
    });

    await expect(
      updateShift(ctx.tenantId, shift.id, { startsAt: new Date('2026-03-02T18:00:00Z') })
    ).rejects.toBeInstanceOf(InvalidShiftWindowError);

    // The legal move still works.
    const moved = await updateShift(ctx.tenantId, shift.id, {
      startsAt: new Date('2026-03-02T09:00:00Z'),
    });
    expect(moved.startsAt.toISOString()).toBe('2026-03-02T09:00:00.000Z');
  });

  it('a week is on the rota if it OVERLAPS the window, not if it fits inside it', async () => {
    const member = await hire();
    // Saturday night into Sunday morning — the shift a rota must never hide.
    await createShift(ctx.tenantId, {
      staffMemberId: member.id,
      startsAt: new Date('2026-03-07T22:00:00Z'),
      endsAt: new Date('2026-03-08T06:00:00Z'),
    });

    const sundayOnward = await listShifts(ctx.tenantId, {
      from: new Date('2026-03-08T00:00:00Z'),
      to: new Date('2026-03-14T23:59:59Z'),
    });
    expect(sundayOnward).toHaveLength(1);
  });

  it('publishes only drafts, and reports how many moved', async () => {
    const member = await hire();
    const draft = await createShift(ctx.tenantId, {
      staffMemberId: member.id,
      startsAt: MONDAY_0800,
      endsAt: MONDAY_1600,
    });
    const already = await createShift(ctx.tenantId, {
      staffMemberId: member.id,
      startsAt: new Date('2026-03-03T08:00:00Z'),
      endsAt: new Date('2026-03-03T16:00:00Z'),
      status: 'published',
    });

    expect(await publishShifts(ctx.tenantId, [draft.id, already.id])).toBe(1);
    // Pressing publish twice is a no-op rather than an error — a manager who
    // clicks it again after adding nothing should not be told off.
    expect(await publishShifts(ctx.tenantId, [draft.id, already.id])).toBe(0);
  });
});

describe('time off', () => {
  it('approval blocks the booking engine only for someone who is bookable', async () => {
    const member = await hire();
    const request = await requestTimeOff(ctx.tenantId, {
      staffMemberId: member.id,
      kind: 'vacation',
      startsAt: day('2026-04-06'),
      endsAt: day('2026-04-10'),
    });

    const decided = await decideTimeOff(ctx.tenantId, request.id, {
      status: 'approved',
      decidedBy: null,
      at: new Date('2026-03-20T10:00:00Z'),
    });

    expect(decided.status).toBe('approved');
    // No scheduling resource, so there is nothing to block. That is the ORDINARY
    // case — most staff are not bookable — and it must not be an error.
    expect(decided.availabilityExceptionId).toBeNull();
  });

  it('cancelling approved leave releases the availability block it created', async () => {
    const resource = await withTenant({ tenantId: ctx.tenantId }, (tx) =>
      tx.schedulingResource.create({
        data: { tenantId: ctx.tenantId, name: 'Bay 2', kind: 'staff' },
        select: { id: true },
      })
    );
    const member = await createMember(ctx.tenantId, {
      firstName: 'Ines',
      siteIds: [ctx.propertyId],
      primarySiteId: ctx.propertyId,
      resourceId: resource.id,
    });

    const request = await requestTimeOff(ctx.tenantId, {
      staffMemberId: member.id,
      startsAt: day('2026-04-06'),
      endsAt: day('2026-04-10'),
    });
    const approved = await decideTimeOff(ctx.tenantId, request.id, {
      status: 'approved',
      decidedBy: null,
      at: new Date('2026-03-20T10:00:00Z'),
    });
    expect(approved.availabilityExceptionId).not.toBeNull();

    const cancelled = await cancelTimeOff(ctx.tenantId, request.id);
    expect(cancelled.status).toBe('cancelled');
    expect(cancelled.availabilityExceptionId).toBeNull();

    // The point of the whole exercise: without this, cancelled leave would leave
    // the person permanently unbookable and nobody would connect the two.
    const remaining = await withTenant({ tenantId: ctx.tenantId }, (tx) =>
      tx.availabilityException.count({ where: { resourceId: resource.id } })
    );
    expect(remaining).toBe(0);
  });

  it('the queue can be read down to what is actually waiting', async () => {
    const member = await hire();
    const waiting = await requestTimeOff(ctx.tenantId, {
      staffMemberId: member.id,
      startsAt: day('2026-04-06'),
      endsAt: day('2026-04-07'),
    });
    const other = await requestTimeOff(ctx.tenantId, {
      staffMemberId: member.id,
      startsAt: day('2026-05-06'),
      endsAt: day('2026-05-07'),
    });
    await decideTimeOff(ctx.tenantId, other.id, {
      status: 'denied',
      decidedBy: null,
      at: new Date(),
    });

    const requested = await listTimeOff(ctx.tenantId, { status: 'requested' });
    expect(requested.map((row) => row.id)).toEqual([waiting.id]);
  });
});

describe('approveTimeEntries', () => {
  it('reports the days it moved, per person, so the caller can name a period', async () => {
    const sam = await hire('Sam');
    const rae = await hire('Rae');

    const ids: string[] = [];
    for (const [staffMemberId, workedOn] of [
      [sam.id, '2026-03-02'],
      [sam.id, '2026-03-05'],
      [rae.id, '2026-03-09'],
    ] as const) {
      const row = await createTimeEntry(ctx.tenantId, {
        staffMemberId,
        workedOn: day(workedOn),
        minutes: 480,
      });
      ids.push(row.id);
    }

    const result = await approveTimeEntries(ctx.tenantId, ids, null, new Date());

    expect(result.approvedIds).toHaveLength(3);
    expect(result.staffMemberIds.sort()).toEqual([sam.id, rae.id].sort());
    const samsDays = result.approved
      .filter((entry) => entry.staffMemberId === sam.id)
      .map((entry) => entry.workedOn.toISOString().slice(0, 10))
      .sort();
    expect(samsDays).toEqual(['2026-03-02', '2026-03-05']);
  });

  it('skips an entry still on the clock, and says which', async () => {
    const member = await hire();
    const typed = await createTimeEntry(ctx.tenantId, {
      staffMemberId: member.id,
      workedOn: day('2026-03-02'),
      minutes: 480,
    });
    // An open entry has no duration yet — approving it would bank a zero.
    const open = await withTenant({ tenantId: ctx.tenantId }, (tx) =>
      tx.staffTimeEntry.create({
        data: {
          tenantId: ctx.tenantId,
          staffMemberId: member.id,
          workedOn: day('2026-03-03'),
          startedAt: new Date('2026-03-03T08:00:00Z'),
          minutes: 0,
          source: 'clock',
          status: 'open',
        },
        select: { id: true },
      })
    );

    const result = await approveTimeEntries(ctx.tenantId, [typed.id, open.id], null, new Date());
    expect(result.approvedIds).toEqual([typed.id]);
    expect(result.skippedOpen).toEqual([open.id]);
  });

  it('re-approving reports nothing moved, so no event re-derives the month', async () => {
    const member = await hire();
    const entry = await createTimeEntry(ctx.tenantId, {
      staffMemberId: member.id,
      workedOn: day('2026-03-02'),
      minutes: 480,
    });

    await approveTimeEntries(ctx.tenantId, [entry.id], null, new Date());
    const second = await approveTimeEntries(ctx.tenantId, [entry.id], null, new Date());

    expect(second.approved).toEqual([]);
    expect(second.staffMemberIds).toEqual([]);
  });
});
