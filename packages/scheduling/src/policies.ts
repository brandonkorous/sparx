// Booking-policy CRUD (docs/79 §9) — the deposit / cancellation / fee / reminder
// rules a service attaches to. No soft-delete: the BookingPolicy FK on services +
// bookings is ON DELETE SET NULL, so removing a policy just detaches it (history
// keeps its denormalized fields). Tenant-scoped via withTenant (FORCE RLS).

import { withTenant, type BookingPolicy } from '@sparx/db';
import type { CreateBookingPolicyInput, UpdateBookingPolicyInput } from '@sparx/scheduling-schemas';

import { BookingPolicyNotFoundError } from './errors';

export async function createBookingPolicy(
  tenantId: string,
  input: CreateBookingPolicyInput
): Promise<BookingPolicy> {
  return withTenant({ tenantId }, (tx) =>
    tx.bookingPolicy.create({
      data: {
        tenantId,
        name: input.name,
        depositType: input.depositType,
        depositAmountCents: input.depositAmountCents ?? null,
        depositPercent: input.depositPercent ?? null,
        cancellationWindowHours: input.cancellationWindowHours,
        lateCancelFeeType: input.lateCancelFeeType ?? null,
        lateCancelFeeValue: input.lateCancelFeeValue ?? null,
        noShowFeeType: input.noShowFeeType ?? null,
        noShowFeeValue: input.noShowFeeValue ?? null,
        policyText: input.policyText ?? null,
        reminderOffsetsMin: input.reminderOffsetsMin,
      },
    })
  );
}

export async function updateBookingPolicy(
  tenantId: string,
  input: UpdateBookingPolicyInput
): Promise<BookingPolicy> {
  const { id, ...rest } = input;
  return withTenant({ tenantId }, async (tx) => {
    const existing = await tx.bookingPolicy.findUnique({ where: { id } });
    if (!existing) throw new BookingPolicyNotFoundError(id);
    return tx.bookingPolicy.update({
      where: { id },
      data: {
        ...(rest.name !== undefined ? { name: rest.name } : {}),
        ...(rest.depositType !== undefined ? { depositType: rest.depositType } : {}),
        ...(rest.depositAmountCents !== undefined
          ? { depositAmountCents: rest.depositAmountCents }
          : {}),
        ...(rest.depositPercent !== undefined ? { depositPercent: rest.depositPercent } : {}),
        ...(rest.cancellationWindowHours !== undefined
          ? { cancellationWindowHours: rest.cancellationWindowHours }
          : {}),
        ...(rest.lateCancelFeeType !== undefined
          ? { lateCancelFeeType: rest.lateCancelFeeType }
          : {}),
        ...(rest.lateCancelFeeValue !== undefined
          ? { lateCancelFeeValue: rest.lateCancelFeeValue }
          : {}),
        ...(rest.noShowFeeType !== undefined ? { noShowFeeType: rest.noShowFeeType } : {}),
        ...(rest.noShowFeeValue !== undefined ? { noShowFeeValue: rest.noShowFeeValue } : {}),
        ...(rest.policyText !== undefined ? { policyText: rest.policyText } : {}),
        ...(rest.reminderOffsetsMin !== undefined
          ? { reminderOffsetsMin: rest.reminderOffsetsMin }
          : {}),
      },
    });
  });
}

export async function getBookingPolicy(tenantId: string, id: string): Promise<BookingPolicy> {
  return withTenant({ tenantId }, async (tx) => {
    const policy = await tx.bookingPolicy.findUnique({ where: { id } });
    if (!policy) throw new BookingPolicyNotFoundError(id);
    return policy;
  });
}

export async function listBookingPolicies(tenantId: string): Promise<BookingPolicy[]> {
  return withTenant({ tenantId }, (tx) => tx.bookingPolicy.findMany({ orderBy: { name: 'asc' } }));
}

export async function deleteBookingPolicy(tenantId: string, id: string): Promise<void> {
  await withTenant({ tenantId }, async (tx) => {
    const existing = await tx.bookingPolicy.findUnique({ where: { id } });
    if (!existing) throw new BookingPolicyNotFoundError(id);
    // FK ON DELETE SET NULL detaches the policy from services + bookings.
    await tx.bookingPolicy.delete({ where: { id } });
  });
}
