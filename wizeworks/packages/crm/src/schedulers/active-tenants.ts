// Iterate CRM-active tenants.
//
// Locked decision #6 says disabled tenants get zero scheduled work. Every
// daily scheduler (automation triggers, overdue-task reminders, segment
// recompute) calls this to enumerate the tenants worth processing.
//
// Reads tenant.settings.modules.crm.enabled directly — the same source
// of truth requireModule() consults. tenants is RLS-free (it's the
// dispatch table) so we read with the default prisma client, no
// withTenant wrapper.

import { prisma } from '@wizeworks/db';

/** All tenants where `settings.modules.crm.enabled = true`. Status is
 *  filtered to 'active' so suspended/cancelled tenants don't get cycles. */
export async function listCrmActiveTenants(): Promise<{ id: string }[]> {
  return prisma.tenant.findMany({
    where: {
      status: 'active',
      settings: { path: ['modules', 'crm', 'enabled'], equals: true },
    },
    select: { id: true },
  });
}

/** All tenants where `settings.modules.invoicing.enabled = true`. The invoicing
 *  module is gated independently of CRM (a tenant can bill without the full CRM
 *  surface), so the collected-rollup reconcile enumerates its own active set. */
export async function listInvoicingActiveTenants(): Promise<{ id: string }[]> {
  return prisma.tenant.findMany({
    where: {
      status: 'active',
      settings: { path: ['modules', 'invoicing', 'enabled'], equals: true },
    },
    select: { id: true },
  });
}

/** Tenants with an SLA mark or a signing link due by `now`, in one cross-tenant scan (WW-9). */
export async function listTenantsWithDueSlaWork(now: Date = new Date()): Promise<Set<string>> {
  const rows = await prisma.$queryRaw<{ tenant_id: string }[]>`
    SELECT tenant_id FROM find_tenants_with_due_crm_sweep(${now})
  `;
  return new Set(rows.map((r) => r.tenant_id));
}

/** Tenants with a mailbox the sync polls, in one cross-tenant scan (WW-9). */
export async function listTenantsWithSyncableMailboxes(): Promise<Set<string>> {
  const rows = await prisma.$queryRaw<{ tenant_id: string }[]>`
    SELECT tenant_id FROM find_tenants_with_syncable_mailboxes()
  `;
  return new Set(rows.map((r) => r.tenant_id));
}
