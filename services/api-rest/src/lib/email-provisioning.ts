// Default-email provisioning — the in-process consumer that materializes a
// tenant's 13 default Builder emails (docs/91) when the email module activates.
//
// The SECOND writer on `module.activated(email)` (docs/91 §7). The automation
// module separately seeds its email-sending system automations (in the
// automation-worker, off the Pub/Sub leg); this provisions the BuilderEmail rows
// those automations send by KEY — getPublishedByKey is the dispatch-time join.
// Different tables, same event, so the two writers never collide.
//
// Runs in THIS api-rest process against the same in-process platform bus the CRM
// activation consumers use (registry.ts) — NOT inside @sparx/crm, which would
// force a crm→builder package dependency. publishPlatformEvent awaits every
// subscriber, so the seed completes before the tenant-module route returns (no
// separate /bootstrap round-trip). provisionDefaultEmails is idempotent — only
// the missing keys are created — so a re-activation or duplicate event is a safe
// no-op.

import { ADVISORY_LOCKS } from '@sparx/db';
import { emailService } from '@sparx/builder';
import { getPlatformBus, type PlatformEvent } from '@sparx/crm';
import { prisma } from '@sparx/db';
import type { FastifyBaseLogger } from 'fastify';

/** Subscribe the default-email provisioner to `module.activated`. Returns the
 *  unsubscribe handle (api-rest holds it for the process lifetime; tests drop it
 *  on teardown). Mirrors registerModuleActivationConsumers in @sparx/crm, but
 *  lives here to keep @sparx/crm free of a @sparx/builder dependency. */
export function registerEmailProvisioningConsumer(): () => void {
  const bus = getPlatformBus();
  return bus.subscribe('module.activated', async (event: PlatformEvent) => {
    const slug = (event.payload as { module?: string } | null)?.module;
    if (slug !== 'email') return;
    await emailService.provisionDefaultEmails({ tenantId: event.tenantId, userId: undefined });
  });
}

// ─── nightly reconcile (docs/90 §6, docs/91 §7) ──────────────────────────────
//
// The consumer above provisions the 13 defaults FORWARD, on `module.activated`.
// A tenant whose email module was active before this shipped — or whose
// activation event was dropped — would hold no default templates, so its
// send-by-key automations would resolve to nothing. This pass self-heals that
// gap: it discovers email-active tenants via the SAME `find_tenants_with_active_
// module` SECURITY DEFINER scan the automation-seed reconcile uses, and
// idempotently re-provisions each (provisionDefaultEmails creates only the
// missing keys). The provisioning half is here, not in the lean automation-worker,
// because it needs @sparx/builder's emailService (absent from that image).

const EMAIL_PROVISIONING_RECONCILE_LOCK_KEY = ADVISORY_LOCKS.EMAIL_PROVISIONING_RECONCILE;
// Every 6h — a generous self-heal cadence: activation already provisions
// synchronously, so this only catches the rare dropped-event tenant.
const RECONCILE_INTERVAL_MS = 6 * 60 * 60_000;

export interface EmailProvisioningReconcileResult {
  acquired: boolean;
  tenants: number;
  provisioned: number;
}

/**
 * Back-fill the 13 default Builder emails for every email-active tenant.
 * Singleton across pods via a Postgres advisory lock (distinct key from the
 * other api-rest ticks). The cross-tenant discovery rides the SECURITY DEFINER
 * scan; per-tenant provisioning rides provisionDefaultEmails' own withTenant, so
 * every write stays RLS-scoped. Idempotent — only missing keys are created.
 */
export async function reconcileEmailProvisioning(
  logger: FastifyBaseLogger
): Promise<EmailProvisioningReconcileResult> {
  const lock = await prisma.$queryRaw<{ acquired: boolean }[]>`
    SELECT pg_try_advisory_lock(${EMAIL_PROVISIONING_RECONCILE_LOCK_KEY}::int) AS acquired
  `;
  if (!lock[0]?.acquired) {
    logger.debug('email-provisioning-reconcile: lock held by another pod, skipping');
    return { acquired: false, tenants: 0, provisioned: 0 };
  }

  try {
    const rows = await prisma.$queryRaw<{ tenant_id: string }[]>`
      SELECT tenant_id FROM find_tenants_with_active_module('email')
    `;
    let provisioned = 0;
    for (const { tenant_id } of rows) {
      try {
        const result = await emailService.provisionDefaultEmails({
          tenantId: tenant_id,
          userId: undefined,
        });
        provisioned += result.provisioned;
      } catch (err) {
        // One tenant's failure must not abort the fleet pass — log and continue.
        logger.error({ err, tenantId: tenant_id }, 'email-provisioning-reconcile: tenant failed');
      }
    }
    if (provisioned > 0) {
      logger.info(
        { tenants: rows.length, provisioned },
        'email-provisioning-reconcile: backfilled default emails'
      );
    }
    return { acquired: true, tenants: rows.length, provisioned };
  } finally {
    await prisma.$queryRaw`SELECT pg_advisory_unlock(${EMAIL_PROVISIONING_RECONCILE_LOCK_KEY}::int)`;
  }
}

/** Drive reconcileEmailProvisioning on an interval. Mirrors startEmailDispatchLoop
 *  (self-rescheduling setTimeout, stop handle). The first pass fires one interval
 *  after boot — activation provisioning already covers the common path. */
export function startEmailProvisioningReconcileLoop(
  logger: FastifyBaseLogger,
  intervalMs: number = RECONCILE_INTERVAL_MS
): () => void {
  let stopped = false;
  let timer: NodeJS.Timeout | null = null;

  const tick = async (): Promise<void> => {
    if (stopped) return;
    try {
      await reconcileEmailProvisioning(logger);
    } catch (err) {
      logger.error({ err }, 'email-provisioning-reconcile: tick threw — will retry next interval');
    }
    if (stopped) return;
    timer = setTimeout(() => void tick(), intervalMs);
  };

  timer = setTimeout(() => void tick(), intervalMs);
  logger.info({ intervalMs }, 'email-provisioning-reconcile: loop started');

  return () => {
    stopped = true;
    if (timer) clearTimeout(timer);
    logger.info('email-provisioning-reconcile: loop stopped');
  };
}
