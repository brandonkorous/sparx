// Which tenants the payment-reconcile sweep has anything to look at (WW-9).

import { prisma } from '@wizeworks/db';

/** The sweep leaves a payment alone for its first two minutes (sweepStrandedCheckoutPayments). */
const STRANDED_AFTER_MS = 2 * 60_000;

/** Tenants with a gateway payment still pending or authorized past the cutoff, in one scan. */
export async function listTenantsWithOpenPayments(now: Date = new Date()): Promise<Set<string>> {
  const cutoff = new Date(now.getTime() - STRANDED_AFTER_MS);
  const rows = await prisma.$queryRaw<{ tenant_id: string }[]>`
    SELECT tenant_id FROM find_tenants_with_open_payments(${cutoff})
  `;
  return new Set(rows.map((r) => r.tenant_id));
}
