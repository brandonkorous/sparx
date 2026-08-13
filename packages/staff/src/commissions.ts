// Staff commission — `PartnerCommission`'s shape, for the people who actually do
// the work.
//
// The partner programme has had a commission ledger since it shipped; there has
// never been an equivalent for staff, which is why a shop that pays its counter
// team on sales has had nowhere to record it. Same lifecycle vocabulary
// (pending → approved → paid, or void) so the two read alike.
//
// COMMISSION IS NOT WAGES, and the labour deriver deliberately skips anyone on a
// `commission` basis. Counting a sale-based payment in both places would bill
// the business twice for one person.

import { withTenant, type TxClient } from '@sparx/db';
import { StaffMemberNotFoundError } from './errors.js';

export type CommissionSource = 'order' | 'deal';
export type CommissionStatus = 'pending' | 'approved' | 'paid' | 'void';

export interface CommissionInput {
  staffMemberId: string;
  sourceType: CommissionSource;
  sourceId: string;
  sourceLabel?: string | null;
  basisCents: number;
  ratePercent?: number | null;
  amountCents: number;
  currency?: string;
  earnedOn: Date;
  propertyId?: string | null;
  note?: string | null;
}

/**
 * Commission from a percentage of a sale, in integer cents.
 *
 * Basis points rather than a float multiply, for the same reason every other
 * money path here avoids one: `12345 * 0.075` is 925.875 and the way it rounds
 * depends on binary representation rather than on a rule anyone chose.
 */
export function commissionCents(basisCents: number, ratePercent: number): number {
  if (basisCents <= 0 || ratePercent <= 0) return 0;
  const bps = Math.round(ratePercent * 1000);
  return Math.round((basisCents * bps) / 100_000);
}

export async function listCommissions(
  tenantId: string,
  query: { staffMemberId?: string; status?: CommissionStatus; from?: Date; to?: Date } = {}
) {
  return withTenant({ tenantId }, (tx) =>
    tx.staffCommission.findMany({
      where: {
        ...(query.staffMemberId ? { staffMemberId: query.staffMemberId } : {}),
        ...(query.status ? { status: query.status } : {}),
        ...(query.from || query.to
          ? {
              earnedOn: {
                ...(query.from ? { gte: query.from } : {}),
                ...(query.to ? { lte: query.to } : {}),
              },
            }
          : {}),
      },
      include: { staffMember: { select: { id: true, firstName: true, lastName: true } } },
      orderBy: [{ earnedOn: 'desc' }],
    })
  );
}

/**
 * Record a commission, idempotently.
 *
 * Upserted on `(tenant, staffMember, sourceType, sourceId)` — one commission per
 * person per sale. That unique is what makes whatever calculates commission safe
 * to re-run: a recalculated order updates the row instead of paying someone
 * twice, and an event replay is a no-op rather than a payroll incident.
 */
export async function recordCommission(tenantId: string, input: CommissionInput, tx?: TxClient) {
  const run = async (client: TxClient) => {
    const member = await client.staffMember.findFirst({ where: { id: input.staffMemberId } });
    if (!member) throw new StaffMemberNotFoundError(input.staffMemberId);

    const data = {
      propertyId: input.propertyId ?? null,
      sourceLabel: input.sourceLabel ?? null,
      basisCents: input.basisCents,
      ratePercent: input.ratePercent ?? null,
      amountCents: input.amountCents,
      currency: input.currency ?? 'USD',
      earnedOn: input.earnedOn,
      note: input.note ?? null,
    };

    return client.staffCommission.upsert({
      where: {
        tenantId_staffMemberId_sourceType_sourceId: {
          tenantId,
          staffMemberId: input.staffMemberId,
          sourceType: input.sourceType,
          sourceId: input.sourceId,
        },
      },
      // A recalculation updates the figures but must NOT resurrect a commission
      // somebody voided, or reset one already paid back to pending — those are
      // decisions a human made about money that has moved.
      update: data,
      create: {
        tenantId,
        staffMemberId: input.staffMemberId,
        sourceType: input.sourceType,
        sourceId: input.sourceId,
        status: 'pending',
        ...data,
      },
    });
  };
  return tx ? run(tx) : withTenant({ tenantId }, run);
}

export async function setCommissionStatus(
  tenantId: string,
  ids: string[],
  status: CommissionStatus,
  at: Date
): Promise<number> {
  const result = await withTenant({ tenantId }, (tx) =>
    tx.staffCommission.updateMany({
      where: { id: { in: ids } },
      data: { status, paidAt: status === 'paid' ? at : null },
    })
  );
  return result.count;
}

export async function deleteCommission(tenantId: string, id: string): Promise<void> {
  await withTenant({ tenantId }, (tx) => tx.staffCommission.delete({ where: { id } }));
}
