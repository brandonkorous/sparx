// Certifications — the surface that earns this module for a regulated trade.
//
// A licence that lapsed is a van that cannot leave the yard, an inspection that
// cannot be signed, an insurance policy that has quietly stopped covering the
// job. Nobody finds out from a spreadsheet; they find out from a customer.
//
// THE NULL EXPIRY IS A REAL ANSWER. A qualification that does not expire is not
// "expiring today" and must never sort to the top of the warning list — that is
// the platform rule about never rendering an absent value as a measured one, and
// here it is the difference between a list people act on and a list people mute.

import { withTenant, type TxClient } from '@sparx/db';
import { CertificationNotFoundError, StaffMemberNotFoundError } from './errors.js';
import { dayKey } from './pay.js';

/**
 * Where a certification stands, as a business owner would say it.
 *
 * `none` is deliberately its own state rather than a variant of `valid`: the
 * screen needs to distinguish "this is fine forever" from "this is fine for
 * now", because only the second one is worth watching.
 */
export type CertificationState = 'expired' | 'expiring' | 'valid' | 'none';

/** Pure, so the state a screen shows and the state the reminder sweep acts on
 *  cannot drift apart — they call this. */
export function certificationState(
  certification: { expiresOn: Date | null; reminderLeadDays: number },
  today: Date
): CertificationState {
  if (!certification.expiresOn) return 'none';
  const expires = dayKey(certification.expiresOn);
  const now = dayKey(today);
  if (expires < now) return 'expired';
  const leadEnd = dayKey(
    new Date(today.getTime() + Math.max(0, certification.reminderLeadDays) * 86_400_000)
  );
  return expires <= leadEnd ? 'expiring' : 'valid';
}

/** Whole days until it lapses; negative once it has. Null when it never does —
 *  NOT `Infinity` and NOT a large number, both of which sort and format as if
 *  they were a measurement. */
export function daysUntilExpiry(expiresOn: Date | null, today: Date): number | null {
  if (!expiresOn) return null;
  const a = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  const b = Date.UTC(expiresOn.getUTCFullYear(), expiresOn.getUTCMonth(), expiresOn.getUTCDate());
  return Math.round((b - a) / 86_400_000);
}

export interface CertificationInput {
  staffMemberId: string;
  name: string;
  issuer?: string | null;
  referenceNumber?: string | null;
  issuedOn?: Date | null;
  expiresOn?: Date | null;
  reminderLeadDays?: number;
  documentId?: string | null;
  notes?: string | null;
}

export async function listCertifications(
  tenantId: string,
  query: { staffMemberId?: string; expiringWithinDays?: number } = {}
) {
  const rows = await withTenant({ tenantId }, (tx) =>
    tx.staffCertification.findMany({
      where: {
        ...(query.staffMemberId ? { staffMemberId: query.staffMemberId } : {}),
        ...(query.expiringWithinDays !== undefined
          ? {
              expiresOn: {
                not: null,
                lte: new Date(Date.now() + query.expiringWithinDays * 86_400_000),
              },
            }
          : {}),
      },
      include: {
        staffMember: { select: { id: true, firstName: true, lastName: true, status: true } },
      },
      // Soonest first — and because `expiresOn` is nullable, the never-expiring
      // ones land LAST rather than first. Postgres sorts NULLs last on ASC by
      // default, which is the behaviour we want; it is stated here because the
      // opposite would put every permanent qualification at the top of a screen
      // whose entire job is showing what needs attention.
      orderBy: [{ expiresOn: 'asc' }],
    })
  );
  return rows;
}

export async function createCertification(
  tenantId: string,
  input: CertificationInput,
  tx?: TxClient
) {
  const run = async (client: TxClient) => {
    const member = await client.staffMember.findFirst({ where: { id: input.staffMemberId } });
    if (!member) throw new StaffMemberNotFoundError(input.staffMemberId);
    return client.staffCertification.create({
      data: {
        tenantId,
        staffMemberId: input.staffMemberId,
        name: input.name,
        issuer: input.issuer ?? null,
        referenceNumber: input.referenceNumber ?? null,
        issuedOn: input.issuedOn ?? null,
        expiresOn: input.expiresOn ?? null,
        reminderLeadDays: input.reminderLeadDays ?? 30,
        documentId: input.documentId ?? null,
        notes: input.notes ?? null,
      },
    });
  };
  return tx ? run(tx) : withTenant({ tenantId }, run);
}

export async function updateCertification(
  tenantId: string,
  id: string,
  input: Partial<CertificationInput>
) {
  return withTenant({ tenantId }, async (tx) => {
    const existing = await tx.staffCertification.findFirst({ where: { id } });
    if (!existing) throw new CertificationNotFoundError(id);
    return tx.staffCertification.update({
      where: { id },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.issuer !== undefined ? { issuer: input.issuer } : {}),
        ...(input.referenceNumber !== undefined ? { referenceNumber: input.referenceNumber } : {}),
        ...(input.issuedOn !== undefined ? { issuedOn: input.issuedOn } : {}),
        ...(input.expiresOn !== undefined ? { expiresOn: input.expiresOn } : {}),
        ...(input.reminderLeadDays !== undefined
          ? { reminderLeadDays: input.reminderLeadDays }
          : {}),
        ...(input.documentId !== undefined ? { documentId: input.documentId } : {}),
        ...(input.notes !== undefined ? { notes: input.notes } : {}),
        // A renewed certificate is a new window, so the reminder has to be able
        // to fire again. Leaving the stamp in place is how a renewal silently
        // buys twelve months of silence and then lapses unannounced.
        ...(input.expiresOn !== undefined ? { lastRemindedAt: null } : {}),
      },
    });
  });
}

export async function deleteCertification(tenantId: string, id: string): Promise<void> {
  await withTenant({ tenantId }, (tx) => tx.staffCertification.delete({ where: { id } }));
}

/**
 * Everything inside its own reminder window that has not been reminded about
 * within that window, for the nightly sweep.
 *
 * The `lastRemindedAt` filter is per-certification rather than global, so a
 * ninety-day lead does not send ninety emails. Expired rows keep appearing until
 * somebody deals with them, which is deliberate — an expired licence is not a
 * notification, it is an ongoing problem.
 */
export async function certificationsNeedingReminder(tenantId: string, today: Date) {
  const rows = await withTenant({ tenantId }, (tx) =>
    tx.staffCertification.findMany({
      where: {
        expiresOn: { not: null },
        staffMember: { status: { in: ['active', 'onboarding'] } },
      },
      include: {
        staffMember: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
      orderBy: [{ expiresOn: 'asc' }],
    })
  );
  return rows.filter((row) => {
    const state = certificationState(row, today);
    if (state === 'valid' || state === 'none') return false;
    if (!row.lastRemindedAt) return true;
    // One reminder per lead window: re-notify only once the reminder itself is
    // older than the window, so a 30-day lead sends at most once a month.
    const windowMs = Math.max(1, row.reminderLeadDays) * 86_400_000;
    return today.getTime() - row.lastRemindedAt.getTime() >= windowMs;
  });
}

export async function markReminded(tenantId: string, ids: string[], at: Date): Promise<void> {
  if (ids.length === 0) return;
  await withTenant({ tenantId }, (tx) =>
    tx.staffCertification.updateMany({ where: { id: { in: ids } }, data: { lastRemindedAt: at } })
  );
}
