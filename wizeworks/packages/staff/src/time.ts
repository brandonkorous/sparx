// Time entries — what actually happened, and the approval that releases it into
// the ledger.
//
// A TIME ENTRY IS NOT A SHIFT AND NOT A BOOKING. A booking is a customer's
// appointment; a shift is when someone is rostered; a time entry is what they
// worked. Collapsing any two of the three is how "scheduled hours" and "paid
// hours" become one wrong number.
//
// APPROVAL IS A DELIBERATE ACT, and it is the labour deriver's trigger. Deriving
// on clock-out would mean every mistyped shift moved the month's profit before
// anyone had looked at it — and the person who notices is the owner, three weeks
// later, wondering why March got worse.

import { withTenant, type TxClient } from '@wizeworks/db';
import {
  AlreadyClockedInError,
  ApprovedTimeLockedError,
  StaffMemberNotFoundError,
  TimeEntryNotFoundError,
  NotClockedInError,
} from './errors.js';
import { dayKey } from './pay.js';

export type TimeEntryStatus = 'open' | 'submitted' | 'approved' | 'rejected';
export type TimeEntrySource = 'clock' | 'manual' | 'import';

/**
 * Worked minutes from a clock pair, net of the break.
 *
 * Floors to the minute rather than rounding: a clock reading 7 minutes 59
 * seconds is 7 worked minutes, and rounding up systematically pays for time
 * nobody worked. Never negative — a break longer than the shift is a data-entry
 * mistake, and the honest response is zero rather than a credit.
 */
export function clockedMinutes(startedAt: Date, endedAt: Date, breakMinutes: number): number {
  const gross = Math.floor((endedAt.getTime() - startedAt.getTime()) / 60_000);
  return Math.max(0, gross - Math.max(0, breakMinutes));
}

export interface TimeEntryInput {
  staffMemberId: string;
  workedOn: Date;
  minutes: number;
  breakMinutes?: number;
  propertyId?: string | null;
  jobType?: 'order' | 'booking' | null;
  jobId?: string | null;
  note?: string | null;
  source?: TimeEntrySource;
}

export interface ListTimeQuery {
  staffMemberId?: string;
  from?: Date;
  to?: Date;
  status?: TimeEntryStatus;
  propertyId?: string;
  jobType?: 'order' | 'booking';
  jobId?: string;
}

export async function listTimeEntries(tenantId: string, query: ListTimeQuery = {}) {
  return withTenant({ tenantId }, (tx) =>
    tx.staffTimeEntry.findMany({
      where: {
        ...(query.staffMemberId ? { staffMemberId: query.staffMemberId } : {}),
        ...(query.status ? { status: query.status } : {}),
        ...(query.propertyId ? { propertyId: query.propertyId } : {}),
        ...(query.jobType && query.jobId ? { jobType: query.jobType, jobId: query.jobId } : {}),
        ...(query.from || query.to
          ? {
              workedOn: {
                ...(query.from ? { gte: query.from } : {}),
                ...(query.to ? { lte: query.to } : {}),
              },
            }
          : {}),
      },
      include: { staffMember: { select: { id: true, firstName: true, lastName: true } } },
      orderBy: [{ workedOn: 'desc' }, { startedAt: 'desc' }],
    })
  );
}

export async function createTimeEntry(tenantId: string, input: TimeEntryInput, tx?: TxClient) {
  const run = async (client: TxClient) => {
    const member = await client.staffMember.findFirst({ where: { id: input.staffMemberId } });
    if (!member) throw new StaffMemberNotFoundError(input.staffMemberId);
    return client.staffTimeEntry.create({
      data: {
        tenantId,
        staffMemberId: input.staffMemberId,
        propertyId: input.propertyId ?? null,
        workedOn: input.workedOn,
        minutes: Math.max(0, input.minutes),
        breakMinutes: Math.max(0, input.breakMinutes ?? 0),
        jobType: input.jobType ?? null,
        jobId: input.jobId ?? null,
        note: input.note ?? null,
        source: input.source ?? 'manual',
        // A typed entry is already a claim about work that happened, so it goes
        // straight to `submitted` — `open` means a clock is still running, and
        // an entry nobody can clock out of would sit there forever.
        status: 'submitted',
      },
    });
  };
  return tx ? run(tx) : withTenant({ tenantId }, run);
}

export async function updateTimeEntry(
  tenantId: string,
  id: string,
  input: Partial<TimeEntryInput>
) {
  return withTenant({ tenantId }, async (tx) => {
    const existing = await tx.staffTimeEntry.findFirst({ where: { id } });
    if (!existing) throw new TimeEntryNotFoundError(id);
    // Approved time is what the profit figure was built on. Editing it in place
    // would change a number somebody already signed off without telling them.
    if (existing.status === 'approved') throw new ApprovedTimeLockedError();

    return tx.staffTimeEntry.update({
      where: { id },
      data: {
        ...(input.workedOn !== undefined ? { workedOn: input.workedOn } : {}),
        ...(input.minutes !== undefined ? { minutes: Math.max(0, input.minutes) } : {}),
        ...(input.breakMinutes !== undefined
          ? { breakMinutes: Math.max(0, input.breakMinutes) }
          : {}),
        ...(input.propertyId !== undefined ? { propertyId: input.propertyId } : {}),
        ...(input.jobType !== undefined ? { jobType: input.jobType } : {}),
        ...(input.jobId !== undefined ? { jobId: input.jobId } : {}),
        ...(input.note !== undefined ? { note: input.note } : {}),
      },
    });
  });
}

export async function deleteTimeEntry(tenantId: string, id: string): Promise<void> {
  await withTenant({ tenantId }, async (tx) => {
    const existing = await tx.staffTimeEntry.findFirst({ where: { id } });
    if (!existing) throw new TimeEntryNotFoundError(id);
    if (existing.status === 'approved') throw new ApprovedTimeLockedError();
    await tx.staffTimeEntry.delete({ where: { id } });
  });
}

/* ── The clock ──────────────────────────────────────────────────────────────── */

/**
 * Start a clock.
 *
 * Refuses if one is already running. Without that guard a double tap on a phone
 * opens two entries, the person is paid twice for one shift, and because both
 * entries look valid nothing downstream can tell which to discard.
 */
export async function clockIn(
  tenantId: string,
  input: {
    staffMemberId: string;
    at: Date;
    propertyId?: string | null;
    jobType?: 'order' | 'booking' | null;
    jobId?: string | null;
  }
) {
  return withTenant({ tenantId }, async (tx) => {
    const member = await tx.staffMember.findFirst({ where: { id: input.staffMemberId } });
    if (!member) throw new StaffMemberNotFoundError(input.staffMemberId);

    const open = await tx.staffTimeEntry.findFirst({
      where: { staffMemberId: input.staffMemberId, status: 'open', endedAt: null },
    });
    if (open) throw new AlreadyClockedInError(member.firstName);

    return tx.staffTimeEntry.create({
      data: {
        tenantId,
        staffMemberId: input.staffMemberId,
        propertyId: input.propertyId ?? null,
        // The day the shift STARTED, so a night shift ending at 02:10 belongs to
        // the day it began rather than splitting across two.
        workedOn: new Date(`${dayKey(input.at)}T00:00:00.000Z`),
        startedAt: input.at,
        minutes: 0,
        jobType: input.jobType ?? null,
        jobId: input.jobId ?? null,
        source: 'clock',
        status: 'open',
      },
    });
  });
}

export async function clockOut(
  tenantId: string,
  input: { staffMemberId: string; at: Date; breakMinutes?: number; note?: string | null }
) {
  return withTenant({ tenantId }, async (tx) => {
    const member = await tx.staffMember.findFirst({ where: { id: input.staffMemberId } });
    if (!member) throw new StaffMemberNotFoundError(input.staffMemberId);

    const open = await tx.staffTimeEntry.findFirst({
      where: { staffMemberId: input.staffMemberId, status: 'open', endedAt: null },
      orderBy: { startedAt: 'desc' },
    });
    if (!open?.startedAt) throw new NotClockedInError(member.firstName);

    const breakMinutes = Math.max(0, input.breakMinutes ?? open.breakMinutes);
    return tx.staffTimeEntry.update({
      where: { id: open.id },
      data: {
        endedAt: input.at,
        breakMinutes,
        minutes: clockedMinutes(open.startedAt, input.at, breakMinutes),
        note: input.note ?? open.note,
        status: 'submitted',
      },
    });
  });
}

/** Whoever is currently on the clock, for the roster's at-a-glance state. */
export async function openEntries(tenantId: string) {
  return withTenant({ tenantId }, (tx) =>
    tx.staffTimeEntry.findMany({
      where: { status: 'open', endedAt: null },
      include: { staffMember: { select: { id: true, firstName: true, lastName: true } } },
      orderBy: { startedAt: 'asc' },
    })
  );
}

/* ── Approval ───────────────────────────────────────────────────────────────── */

/**
 * Approve a set of entries.
 *
 * Returns the entries actually moved, which is not always the ids passed in: an
 * entry still on the clock cannot be approved (its duration is zero until
 * somebody clocks out), and one already approved is a no-op rather than an
 * error. The caller publishes `staff.time.approved` for what came back — never
 * for what it asked for, or a re-approval would re-derive the month for nothing.
 *
 * `approved` carries the day each moved entry belongs to as well as its person,
 * because the event the caller has to publish names a PERIOD. Returning bare ids
 * would send that caller back to the database to re-read rows this function
 * already had in hand.
 */
export interface ApprovedTimeEntry {
  id: string;
  staffMemberId: string;
  workedOn: Date;
}

export async function approveTimeEntries(
  tenantId: string,
  ids: string[],
  approvedBy: string | null,
  at: Date
): Promise<{
  approved: ApprovedTimeEntry[];
  approvedIds: string[];
  staffMemberIds: string[];
  skippedOpen: string[];
}> {
  return withTenant({ tenantId }, async (tx) => {
    const entries = await tx.staffTimeEntry.findMany({ where: { id: { in: ids } } });
    const open = entries.filter((e) => e.status === 'open');
    const movable = entries.filter((e) => e.status === 'submitted' || e.status === 'rejected');
    if (movable.length > 0) {
      await tx.staffTimeEntry.updateMany({
        where: { id: { in: movable.map((e) => e.id) } },
        data: { status: 'approved', approvedAt: at, approvedBy },
      });
    }
    return {
      approved: movable.map((e) => ({
        id: e.id,
        staffMemberId: e.staffMemberId,
        workedOn: e.workedOn,
      })),
      approvedIds: movable.map((e) => e.id),
      staffMemberIds: [...new Set(movable.map((e) => e.staffMemberId))],
      skippedOpen: open.map((e) => e.id),
    };
  });
}

export async function rejectTimeEntries(tenantId: string, ids: string[]): Promise<string[]> {
  return withTenant({ tenantId }, async (tx) => {
    await tx.staffTimeEntry.updateMany({
      where: { id: { in: ids }, status: { in: ['submitted', 'approved'] } },
      data: { status: 'rejected', approvedAt: null, approvedBy: null },
    });
    return ids;
  });
}

/**
 * Reopen approved time so it can be corrected.
 *
 * A visible, deliberate act — which is the point. It tells whoever approved the
 * period that the number they signed off is about to change, and it is what the
 * edit guard sends people to. The already-derived wage expense is NOT deleted
 * here: re-deriving the period after the correction updates it in place through
 * the same `(tenant, source_type, source_id)` unique, and deleting it in the
 * meantime would blank the month for anyone looking at profit right now.
 */
export async function reopenTimeEntries(tenantId: string, ids: string[]): Promise<string[]> {
  return withTenant({ tenantId }, async (tx) => {
    await tx.staffTimeEntry.updateMany({
      where: { id: { in: ids }, status: 'approved' },
      data: { status: 'submitted', approvedAt: null, approvedBy: null },
    });
    return ids;
  });
}
