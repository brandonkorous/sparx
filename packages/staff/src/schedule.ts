// Rostered time and time off — the two things that are PLANNED rather than
// worked.
//
// Neither reaches the ledger. Nobody is paid for a shift; they are paid for the
// time entry that happened during it, and the whole reason the two are separate
// tables is that "scheduled hours" and "paid hours" are different numbers that
// every rota product eventually conflates.

import { withTenant, type TxClient } from '@sparx/db';
import {
  InvalidShiftWindowError,
  ShiftNotFoundError,
  StaffMemberNotFoundError,
  TimeOffRequestNotFoundError,
} from './errors.js';

/* ── Shifts ─────────────────────────────────────────────────────────────────── */

export type ShiftStatus = 'draft' | 'published' | 'cancelled';

export interface ShiftInput {
  staffMemberId: string;
  startsAt: Date;
  endsAt: Date;
  propertyId?: string | null;
  label?: string | null;
  status?: ShiftStatus;
  notes?: string | null;
}

export async function listShifts(
  tenantId: string,
  query: { from?: Date; to?: Date; staffMemberId?: string; propertyId?: string } = {}
) {
  return withTenant({ tenantId }, (tx) =>
    tx.staffShift.findMany({
      where: {
        ...(query.staffMemberId ? { staffMemberId: query.staffMemberId } : {}),
        ...(query.propertyId ? { propertyId: query.propertyId } : {}),
        // Overlap, not containment: a shift that starts before the window and
        // ends inside it is on the screen for that week, and a rota that hides
        // the Sunday night shift because it began on Saturday is wrong in the
        // one way a rota must never be wrong.
        ...(query.from ? { endsAt: { gte: query.from } } : {}),
        ...(query.to ? { startsAt: { lte: query.to } } : {}),
      },
      include: {
        staffMember: { select: { id: true, firstName: true, lastName: true, color: true } },
      },
      orderBy: [{ startsAt: 'asc' }],
    })
  );
}

export async function createShift(tenantId: string, input: ShiftInput, tx?: TxClient) {
  const run = async (client: TxClient) => {
    const member = await client.staffMember.findFirst({ where: { id: input.staffMemberId } });
    if (!member) throw new StaffMemberNotFoundError(input.staffMemberId);
    return client.staffShift.create({
      data: {
        tenantId,
        staffMemberId: input.staffMemberId,
        propertyId: input.propertyId ?? null,
        startsAt: input.startsAt,
        endsAt: input.endsAt,
        label: input.label ?? null,
        // `draft` by default so a manager can build next week without the team
        // seeing a half-finished rota and planning their lives around it.
        status: input.status ?? 'draft',
        notes: input.notes ?? null,
      },
    });
  };
  return tx ? run(tx) : withTenant({ tenantId }, run);
}

export async function updateShift(tenantId: string, id: string, input: Partial<ShiftInput>) {
  return withTenant({ tenantId }, async (tx) => {
    const existing = await tx.staffShift.findFirst({ where: { id } });
    if (!existing) throw new ShiftNotFoundError(id);
    // Validate the PAIR, not the field that moved. Dragging only a shift's end
    // time earlier than its start is a single-field patch, so nothing upstream
    // can see both halves — and the table's CHECK would answer with a constraint
    // violation rather than something a manager can read.
    const startsAt = input.startsAt ?? existing.startsAt;
    const endsAt = input.endsAt ?? existing.endsAt;
    if (endsAt <= startsAt) throw new InvalidShiftWindowError();
    return tx.staffShift.update({
      where: { id },
      data: {
        ...(input.staffMemberId !== undefined ? { staffMemberId: input.staffMemberId } : {}),
        ...(input.propertyId !== undefined ? { propertyId: input.propertyId } : {}),
        ...(input.startsAt !== undefined ? { startsAt: input.startsAt } : {}),
        ...(input.endsAt !== undefined ? { endsAt: input.endsAt } : {}),
        ...(input.label !== undefined ? { label: input.label } : {}),
        ...(input.status !== undefined ? { status: input.status } : {}),
        ...(input.notes !== undefined ? { notes: input.notes } : {}),
      },
    });
  });
}

export async function deleteShift(tenantId: string, id: string): Promise<void> {
  await withTenant({ tenantId }, (tx) => tx.staffShift.delete({ where: { id } }));
}

/** Publish a week's drafts in one act — which is how a rota is actually released. */
export async function publishShifts(tenantId: string, ids: string[]): Promise<number> {
  const result = await withTenant({ tenantId }, (tx) =>
    tx.staffShift.updateMany({
      where: { id: { in: ids }, status: 'draft' },
      data: { status: 'published' },
    })
  );
  return result.count;
}

/* ── Time off ───────────────────────────────────────────────────────────────── */

export type TimeOffKind = 'vacation' | 'sick' | 'unpaid' | 'other';
export type TimeOffStatus = 'requested' | 'approved' | 'denied' | 'cancelled';

export interface TimeOffInput {
  staffMemberId: string;
  kind?: TimeOffKind;
  startsAt: Date;
  endsAt: Date;
  allDay?: boolean;
  reason?: string | null;
}

export async function listTimeOff(
  tenantId: string,
  query: { status?: TimeOffStatus; staffMemberId?: string; from?: Date; to?: Date } = {}
) {
  return withTenant({ tenantId }, (tx) =>
    tx.staffTimeOffRequest.findMany({
      where: {
        ...(query.status ? { status: query.status } : {}),
        ...(query.staffMemberId ? { staffMemberId: query.staffMemberId } : {}),
        ...(query.from ? { endsAt: { gte: query.from } } : {}),
        ...(query.to ? { startsAt: { lte: query.to } } : {}),
      },
      include: { staffMember: { select: { id: true, firstName: true, lastName: true } } },
      orderBy: [{ startsAt: 'asc' }],
    })
  );
}

export async function requestTimeOff(tenantId: string, input: TimeOffInput, tx?: TxClient) {
  const run = async (client: TxClient) => {
    const member = await client.staffMember.findFirst({ where: { id: input.staffMemberId } });
    if (!member) throw new StaffMemberNotFoundError(input.staffMemberId);
    return client.staffTimeOffRequest.create({
      data: {
        tenantId,
        staffMemberId: input.staffMemberId,
        kind: input.kind ?? 'vacation',
        startsAt: input.startsAt,
        endsAt: input.endsAt,
        allDay: input.allDay ?? true,
        reason: input.reason ?? null,
        status: 'requested',
      },
    });
  };
  return tx ? run(tx) : withTenant({ tenantId }, run);
}

/**
 * Approve or deny a request.
 *
 * On approval, an `AvailabilityException` is written against the person's
 * scheduling resource so the booking engine stops offering them — WHEN they have
 * one. Scheduling is an optional module and plenty of staff are not bookable, so
 * a missing resource is the normal case and not an error; the decision is still
 * recorded, it simply has nothing to block.
 *
 * The exception id is kept so a later cancellation can take it back. Without it,
 * cancelling approved leave would leave the person permanently unbookable and
 * nobody would connect the two.
 */
export async function decideTimeOff(
  tenantId: string,
  id: string,
  decision: {
    status: 'approved' | 'denied';
    decidedBy: string | null;
    note?: string | null;
    at: Date;
  }
) {
  return withTenant({ tenantId }, async (tx) => {
    const request = await tx.staffTimeOffRequest.findFirst({
      where: { id },
      include: { staffMember: true },
    });
    if (!request) throw new TimeOffRequestNotFoundError(id);

    let availabilityExceptionId: string | null = request.availabilityExceptionId;

    if (decision.status === 'approved' && request.staffMember.resourceId) {
      const exception = await tx.availabilityException.create({
        data: {
          tenantId,
          resourceId: request.staffMember.resourceId,
          // `blackout` is scheduling's own word for "this resource is not
          // available in this window" — the same vocabulary the booking engine
          // already honours, rather than a staff-specific kind it would have to
          // learn about.
          kind: 'blackout',
          startAt: request.startsAt,
          endAt: request.endsAt,
          reason: request.kind === 'sick' ? 'Off sick' : 'Time off',
        },
      });
      availabilityExceptionId = exception.id;
    }

    return tx.staffTimeOffRequest.update({
      where: { id },
      data: {
        status: decision.status,
        decidedAt: decision.at,
        decidedBy: decision.decidedBy,
        decisionNote: decision.note ?? null,
        availabilityExceptionId,
      },
    });
  });
}

/** Withdraw a request, and release the availability block it created. */
export async function cancelTimeOff(tenantId: string, id: string) {
  return withTenant({ tenantId }, async (tx) => {
    const request = await tx.staffTimeOffRequest.findFirst({ where: { id } });
    if (!request) throw new TimeOffRequestNotFoundError(id);

    if (request.availabilityExceptionId) {
      // deleteMany, not delete: the exception may already be gone (a scheduling
      // resource deleted, a manual tidy-up), and a cancellation that throws
      // because the thing it wanted to remove is already removed is a dead end
      // for the person trying to get their week back.
      await tx.availabilityException.deleteMany({
        where: { id: request.availabilityExceptionId },
      });
    }

    return tx.staffTimeOffRequest.update({
      where: { id },
      data: { status: 'cancelled', availabilityExceptionId: null },
    });
  });
}
