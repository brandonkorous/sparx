// Golden-blueprint provisioning — the broker consumer + reconcile that install the
// platform's DEFAULT site (the golden `sparx` blueprint) onto every new tenant's
// PRIMARY property. A brand-new tenant should BE the golden template, not merely
// render the base theme through a fallback (theming-spine Phase 3). It lives in
// api-rest (the composition root) rather than a domain package or a standalone worker
// because `installBlueprint` already lives here and pulls in @wizeworks/builder /
// @wizeworks/sitebuilder / @wizeworks/blueprints — api-rest is the only place all of that,
// plus the marketplace catalog resolver, is already on the dependency graph.
//
// TWO mechanisms, one install:
//
//   · FORWARD (the "live in under 5 minutes" path): a durable broker consumer of
//     `tenant.created`. That event is published from @wizeworks/auth's signup, which runs
//     in the WORKBENCH process — so it never reaches api-rest's in-process platform bus
//     (getPlatformBus), only the cross-service broker. api-rest subscribes here under
//     its OWN durable name (`api-rest-golden-blueprint`), distinct from
//     legal-seed-worker's, so JetStream delivers it an independent copy. Under a
//     non-NATS transport startConsumer returns null and the forward path is absent —
//     the reconcile below is then the only mechanism (slower, but lossless).
//
//   · RECONCILE (the self-heal): an advisory-lock singleton tick that scans for primary
//     properties with NO blueprint install and back-fills. It covers dropped events,
//     tenants that predate this feature, and the non-NATS case. Mirrors
//     module-provisioning.ts / email-provisioning.ts.
//
// The install is GATED on "the primary property carries NO blueprint install yet".
// The onboarding wizard may have installed a DIFFERENT pick; the plan has that pick
// REPLACE golden via the Update/Delete+install flow, so golden is the default rather
// than an override. Every path here is therefore an idempotent no-op once anything is
// installed — a redelivered event, a concurrent forward+reconcile, or a re-run all fall
// on the same gate.

import { z } from 'zod';
import type { FastifyBaseLogger } from 'fastify';

import { ADVISORY_LOCKS, prisma, withAdvisoryTickLock, withTenant } from '@wizeworks/db';
import { startConsumer, type RunningConsumer } from '@wizeworks/events';

import { installBlueprint } from './blueprint-installer.js';
import { resolveBlueprintManifest } from './marketplace/resolve.js';
import { resolvePrimaryPropertyId } from './property.js';

/** The platform's default site. Its captured theme IS BASE_SILICA_THEME (the storefront
 *  render fallback), so installing it makes the fallback concrete rather than changing
 *  the look. */
const GOLDEN_BLUEPRINT_KEY = 'sparx';

/** The durable consumer name. Stable + distinct from every other `tenant.created`
 *  subscriber (legal-seed-worker, platform-crm-worker) so JetStream fans the event out
 *  to each independently. Changing it restarts this consumer's cursor. */
const CONSUMER_DURABLE = 'api-rest-golden-blueprint';

export type GoldenInstallOutcome =
  | { installed: true; installId: string }
  | { installed: false; reason: 'already-installed' };

/**
 * Install the golden blueprint onto a tenant's primary property, unless it already
 * carries one. Shared by the forward consumer and the reconcile pass so both apply the
 * exact same gate.
 *
 * Throws (for broker redelivery / reconcile retry) when the catalog can't yet resolve
 * `sparx` — that only happens in the boot window before selfRegisterFirstPartyCatalog
 * has published the shelf, so a redelivery a moment later succeeds. A genuinely absent
 * catalog is bounded by the consumer's maxDeliver and, ultimately, caught by the next
 * reconcile tick.
 */
export async function installGoldenForTenant(
  tenantId: string,
  logger: FastifyBaseLogger
): Promise<GoldenInstallOutcome> {
  const propertyId = await resolvePrimaryPropertyId(tenantId);

  // The gate: ANY install (not just `sparx`) means this property is already dressed —
  // either golden ran already, or onboarding installed a different pick that replaces it.
  const existing = await withTenant({ tenantId }, (tx) =>
    tx.tenantBlueprintInstall.findFirst({ where: { propertyId }, select: { id: true } })
  );
  if (existing) return { installed: false, reason: 'already-installed' };

  const blueprint = await resolveBlueprintManifest(tenantId, GOLDEN_BLUEPRINT_KEY);
  if (!blueprint) {
    // Transient at boot (catalog not yet self-registered); persistent only if the image
    // ships no golden blueprint at all. Throw so the forward path redelivers; the
    // reconcile is the bounded backstop.
    throw new Error(
      `golden-blueprint: catalog has no "${GOLDEN_BLUEPRINT_KEY}" blueprint for tenant ${tenantId}`
    );
  }

  const { installId } = await installBlueprint(
    { tenantId, userId: null, propertyId, logger },
    blueprint
  );
  logger.info({ tenantId, propertyId, installId }, 'golden-blueprint: installed default site');
  return { installed: true, installId };
}

// ─── forward consumer (tenant.created, via the broker) ───────────────────────────

/** The `tenant.created` envelope this consumer needs. Only `tenantId` is required —
 *  the primary property + look are resolved from it. `type` is validated to guard
 *  against a mis-subscription; extra fields (actorId, data.{slug,name}, occurredAt) are
 *  ignored. */
const TenantCreatedEnvelope = z.object({
  type: z.literal('tenant.created'),
  tenantId: z.string().min(1),
});

/**
 * Subscribe api-rest to `tenant.created` on the broker and install golden per tenant.
 * Returns the running consumer (stop() drains it) or null when the transport is not
 * NATS — in which case only the reconcile runs. Register AFTER createApp(): it needs a
 * FastifyBaseLogger, and JetStream is durable so nothing published during startup is
 * lost.
 */
export async function registerGoldenBlueprintConsumer(
  logger: FastifyBaseLogger
): Promise<RunningConsumer | null> {
  return startConsumer({
    durable: CONSUMER_DURABLE,
    events: ['tenant.created'],
    logger,
    handle: async (raw: string) => {
      let parsed: unknown;
      try {
        parsed = JSON.parse(raw);
      } catch (err) {
        // Unparseable is permanent — ack rather than burn the retry budget.
        logger.error({ err }, 'golden-blueprint: broker message not valid JSON; acking');
        return;
      }
      const event = TenantCreatedEnvelope.safeParse(parsed);
      if (!event.success) {
        logger.warn({ raw: parsed }, 'golden-blueprint: off-schema tenant.created; acking');
        return;
      }
      // A throw here nak-s for redelivery (see installGoldenForTenant's catalog case).
      await installGoldenForTenant(event.data.tenantId, logger);
    },
  });
}

// ─── reconcile (self-heal) ───────────────────────────────────────────────────────
//
// Mirrors module-provisioning.ts: an advisory-lock singleton that discovers un-installed
// primary properties via the SECURITY DEFINER scan (20270213000000) and back-fills. It
// covers dropped events, pre-existing tenants, and any deployment without a forward path.

const RECONCILE_LOCK_KEY = ADVISORY_LOCKS.GOLDEN_BLUEPRINT_RECONCILE;
const RECONCILE_INTERVAL_MS = 6 * 60 * 60_000; // every 6h — the forward consumer covers the common path

export interface GoldenBlueprintReconcileResult {
  acquired: boolean;
  tenants: number;
}

/**
 * Install golden onto every tenant primary property that still carries no blueprint.
 * Singleton across pods via a Postgres advisory lock (distinct key from the other
 * api-rest ticks). Per-tenant failures are logged and skipped so one tenant never aborts
 * the fleet pass.
 */
export async function reconcileGoldenBlueprint(
  logger: FastifyBaseLogger
): Promise<GoldenBlueprintReconcileResult> {
  const SKIPPED: GoldenBlueprintReconcileResult = { acquired: false, tenants: 0 };
  return withAdvisoryTickLock(RECONCILE_LOCK_KEY, SKIPPED, async () => {
    const rows = await prisma.$queryRaw<{ tenant_id: string }[]>`
      SELECT tenant_id FROM find_tenants_without_primary_blueprint_install()
    `;
    let tenantsInstalled = 0;
    for (const { tenant_id } of rows) {
      try {
        const outcome = await installGoldenForTenant(tenant_id, logger);
        if (outcome.installed) tenantsInstalled += 1;
      } catch (err) {
        logger.error({ err, tenantId: tenant_id }, 'golden-blueprint-reconcile: tenant failed');
      }
    }
    return { acquired: true, tenants: tenantsInstalled };
  });
}

/** Drive reconcileGoldenBlueprint on an interval. Mirrors the module/email provisioning
 *  loops (self-rescheduling setTimeout, stop handle). The first pass fires one interval
 *  after boot — the forward consumer covers the common path. */
export function startGoldenBlueprintReconcileLoop(
  logger: FastifyBaseLogger,
  intervalMs: number = RECONCILE_INTERVAL_MS
): () => void {
  let stopped = false;
  let timer: NodeJS.Timeout | null = null;

  const tick = async (): Promise<void> => {
    if (stopped) return;
    try {
      await reconcileGoldenBlueprint(logger);
    } catch (err) {
      logger.error({ err }, 'golden-blueprint-reconcile: tick threw — will retry next interval');
    }
    if (stopped) return;
    timer = setTimeout(() => void tick(), intervalMs);
  };

  timer = setTimeout(() => void tick(), intervalMs);
  logger.info({ intervalMs }, 'golden-blueprint-reconcile: loop started');

  return () => {
    stopped = true;
    if (timer) clearTimeout(timer);
    logger.info('golden-blueprint-reconcile: loop stopped');
  };
}
