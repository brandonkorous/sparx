// Pay rates — persistence. The arithmetic and the window logic live in `pay.ts`,
// which imports nothing; this file is only the part that touches Postgres.

import { withTenant, type TxClient } from '@wizeworks/db';
import { OverlappingPayRateError, StaffMemberNotFoundError } from './errors.js';
import { dayKey, windowsOverlap, type PayBasis, type PayRate } from './pay.js';

/**
 * Prisma's `Decimal` for `burden_percent` is not a number, and everything
 * downstream wants one. Converting in ONE place stops a Decimal reaching
 * arithmetic that would quietly stringify it — `decimal * 2` is `'22'`, not 44.
 */
export function toPayRate(row: {
  id: string;
  basis: string;
  amountCents: number;
  currency: string;
  burdenPercent: { toString(): string };
  commissionPercent: { toString(): string };
  effectiveFrom: Date;
  effectiveTo: Date | null;
  note: string | null;
}): PayRate {
  return {
    id: row.id,
    basis: row.basis as PayBasis,
    amountCents: row.amountCents,
    currency: row.currency,
    burdenPercent: Number(row.burdenPercent.toString()),
    commissionPercent: Number(row.commissionPercent.toString()),
    effectiveFrom: row.effectiveFrom,
    effectiveTo: row.effectiveTo,
    note: row.note,
  };
}

export async function listRates(tenantId: string, staffMemberId: string): Promise<PayRate[]> {
  return withTenant({ tenantId }, async (tx) => {
    const rows = await tx.staffPayRate.findMany({
      where: { staffMemberId },
      orderBy: [{ effectiveFrom: 'desc' }],
    });
    return rows.map(toPayRate);
  });
}

export interface SetRateInput {
  basis: PayBasis;
  amountCents: number;
  currency?: string;
  burdenPercent?: number;
  /** The share of a sale earned, under `basis: 'commission'` only. Zeroed on
   *  every other basis below, for the same reason `amountCents` is zeroed under
   *  `none`: a rate switched off commission must not keep a live percentage that
   *  the calculator would go on paying. The DB CHECK enforces it too. */
  commissionPercent?: number;
  effectiveFrom: Date;
  effectiveTo?: Date | null;
  note?: string | null;
}

/**
 * Open a new rate window.
 *
 * The previous open-ended rate is CLOSED the day before this one starts rather
 * than replaced — that is the whole point of the table. The old rate stays
 * readable, so a cost computed last March still explains itself, and a raise
 * today does not retroactively change what last March cost.
 *
 * Any OTHER overlap is rejected. Two rates in force on one day would leave the
 * deriver picking arbitrarily. Postgres cannot express that without an exclusion
 * index over a range type, so it is enforced here, and `windowsOverlap` is tested
 * on its own.
 */
export async function setRate(
  tenantId: string,
  staffMemberId: string,
  input: SetRateInput,
  tx?: TxClient
): Promise<PayRate> {
  const run = async (client: TxClient): Promise<PayRate> => {
    const member = await client.staffMember.findFirst({ where: { id: staffMemberId } });
    if (!member) throw new StaffMemberNotFoundError(staffMemberId);

    const existing = (await client.staffPayRate.findMany({ where: { staffMemberId } })).map(
      toPayRate
    );
    const incoming = { effectiveFrom: input.effectiveFrom, effectiveTo: input.effectiveTo ?? null };
    const dayBefore = new Date(input.effectiveFrom.getTime() - 86_400_000);

    for (const rate of existing) {
      if (!windowsOverlap(rate, incoming)) continue;
      const isOpenPredecessor =
        rate.effectiveTo === null && dayKey(rate.effectiveFrom) < dayKey(input.effectiveFrom);
      if (!isOpenPredecessor) throw new OverlappingPayRateError(dayKey(rate.effectiveFrom));
      await client.staffPayRate.update({
        where: { id: rate.id },
        data: { effectiveTo: dayBefore },
      });
    }

    const created = await client.staffPayRate.create({
      data: {
        tenantId,
        staffMemberId,
        basis: input.basis,
        // A `none` basis carries no figure. The CHECK enforces it too; zeroing
        // here means the caller gets the row they asked for rather than a 500.
        amountCents: input.basis === 'none' ? 0 : input.amountCents,
        currency: input.currency ?? 'USD',
        burdenPercent: input.burdenPercent ?? 0,
        commissionPercent: input.basis === 'commission' ? (input.commissionPercent ?? 0) : 0,
        effectiveFrom: input.effectiveFrom,
        effectiveTo: input.effectiveTo ?? null,
        note: input.note ?? null,
      },
    });
    return toPayRate(created);
  };

  return tx ? run(tx) : withTenant({ tenantId }, run);
}

/**
 * Remove a rate row.
 *
 * Deliberately a hard delete and deliberately rare: this is for a rate typed in
 * wrong five minutes ago, not for "they no longer earn this". Ending a rate is
 * setting `effectiveTo`, which keeps the history that every past cost was
 * computed from. Deleting a rate that periods have already been derived against
 * does not change those derivations — it only removes the ability to explain
 * them, which is why the UI offers "end this rate" first.
 */
export async function deleteRate(tenantId: string, id: string): Promise<void> {
  await withTenant({ tenantId }, (tx) => tx.staffPayRate.delete({ where: { id } }));
}
