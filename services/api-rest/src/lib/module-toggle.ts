// Canonical module-toggle mechanics — the ONE place that flips a tenant's
// module flags, keeps the Stripe subscription items + the in-process module-gate
// cache in lockstep, and announces the on/off transition on BOTH event buses
// (docs/82 Slice E4). Extracted from the tenant route so the operator console
// (`PATCH /internal/operator/tenants/:id/modules/:slug`, build-plan §5 Slice 8)
// drives the EXACT same path.
//
// This is the F4 footgun made shared: a module toggle is an EVENT, never an
// inline flag write — whoever initiates it (a tenant admin or a WizeWorks
// operator), the seeding consumers (CRM pipeline/segments, default emails,
// system automations) and the billing item sync must all run. Duplicating this
// logic on the operator side would let the two paths drift; one implementation
// keeps them honest.

import { randomUUID } from 'node:crypto';
import type { FastifyBaseLogger } from 'fastify';
import { prisma, type Prisma } from '@sparx/db';
import { publish } from '@sparx/api-core/pubsub';
import {
  ALL_MODULES,
  invalidateModuleCache,
  requiredModules,
  blockingDependents,
  deriveModuleStates,
  type ModuleSlug,
} from '@sparx/auth';
import { publishPlatformEvent } from '@sparx/crm';
import { isBillingConfigured, syncModuleItems } from '@sparx/billing';

/** The closed set of module slugs, in a stable order. Shared so the tenant route
 *  and the operator route probe the same vocabulary.
 *
 *  DERIVED from @sparx/modules rather than re-typed. This was a hand-written copy
 *  of that list, and it fell behind twice: `inventory` and `finance` were both
 *  added to the package and forgotten here, which typechecks perfectly (the array
 *  is `ModuleSlug[]`, not exhaustive over the union) and then fails at the one
 *  moment that matters — the activation toggle refuses the slug as "Request
 *  validation failed", and the module can never be turned on at all. Adding a
 *  module is now one edit. */
export const MODULE_SLUGS: ModuleSlug[] = [...ALL_MODULES];
export const MODULE_SLUG_SET = new Set<string>(MODULE_SLUGS);

/** Read the raw EXPLICIT module flags from `settings.modules.<slug>.enabled`.
 *  BUNDLED_FREE derivation is intentionally NOT applied here — the toggle
 *  decision reasons about explicit purchases; availability is derived later via
 *  `deriveModuleStates`. */
export function readModuleFlags(settings: unknown): Record<string, boolean> {
  const out: Record<string, boolean> = {};
  for (const slug of MODULE_SLUGS) out[slug] = false;
  if (!settings || typeof settings !== 'object' || Array.isArray(settings)) return out;
  const modules = (settings as Record<string, unknown>).modules;
  if (!modules || typeof modules !== 'object') return out;
  for (const slug of MODULE_SLUGS) {
    const slot = (modules as Record<string, unknown>)[slug];
    if (slot && typeof slot === 'object' && (slot as Record<string, unknown>).enabled === true) {
      out[slug] = true;
    }
  }
  return out;
}

// Announce a module on/off transition on BOTH event buses (docs/82 Slice E4).
// The two buses reach two different process spaces:
//
//   1. api-core publish() → the `module.{activated,deactivated}` Pub/Sub topic,
//      which enqueues webhook deliveries + tees to `automation.trigger` (the
//      automation-worker, a SEPARATE process, seeds system automations).
//   2. the in-process platform bus → the CRM + Email activation consumers that
//      run inside THIS api-rest process. publishPlatformEvent awaits every
//      subscriber, so the seed completes before the caller returns.
//
// `actorId` is the event actor: the tenant user id for a self-serve toggle, or
// `null` for a platform-initiated (operator) toggle — an operator is not a
// tenant user, so attributing the EVENT to them would be a category error; the
// operator attribution lives in the tenant's audit_logs + the wize_admin audit.
async function announceModuleTransition(
  log: FastifyBaseLogger,
  tenantId: string,
  actorId: string | null,
  slug: ModuleSlug,
  enabled: boolean
): Promise<void> {
  const type = enabled ? 'module.activated' : 'module.deactivated';
  const data = { module: slug };
  await publish(log, type, tenantId, actorId, data);
  await publishPlatformEvent({
    id: randomUUID(),
    topic: type,
    tenantId,
    occurredAt: new Date(),
    payload: data,
  });
}

// Persist a batch of explicit module-flag writes (one read-modify-write), drop
// the tenant's module cache, and announce activation transitions. Read-modify-
// write (not `jsonb_set`) so a tenant with no `settings.modules` yet still gets
// a valid nested structure (the F-01 CRM-activation persistence repro).
//
// Two subtleties this centralizes:
//   • Whole-tenant cache flush, not per-slug: BUNDLED_FREE capabilities (e.g.
//     `invoicing`) are DERIVED from provider flags, so toggling `b2b`/`commerce`
//     changes `invoicing`'s gate result even though no invoicing flag was written.
//   • Announce on DERIVED-state transitions, not raw writes: enabling B2B makes
//     `invoicing` available with no invoicing flag of its own, and its seeding
//     consumer must still run. Billing keys off EXPLICIT flags (source
//     'explicit'), never these availability events, so a bundled capability is
//     announced but never charged.
//
// Returns the effective settings blob (next when anything changed, else the
// original) so callers can shape their response without a re-read.
export async function applyModuleWrites(
  log: FastifyBaseLogger,
  tenantId: string,
  actorId: string | null,
  beforeSettings: unknown,
  writes: Map<ModuleSlug, boolean>
): Promise<unknown> {
  if (writes.size === 0) return beforeSettings;

  const currentSettings = (beforeSettings as Record<string, unknown> | null) ?? {};
  const currentModules = (currentSettings.modules as Record<string, unknown> | undefined) ?? {};
  const nextModules: Record<string, unknown> = { ...currentModules };
  for (const [slug, enabled] of writes) {
    const slot = (currentModules[slug] as Record<string, unknown> | undefined) ?? {};
    nextModules[slug] = { ...slot, enabled };
  }
  const nextSettings = { ...currentSettings, modules: nextModules };

  await prisma.tenant.update({
    where: { id: tenantId },
    data: { settings: nextSettings as Prisma.InputJsonValue },
  });
  invalidateModuleCache(tenantId);

  const beforeStates = deriveModuleStates(beforeSettings);
  const afterStates = deriveModuleStates(nextSettings);
  for (const slug of MODULE_SLUGS) {
    if (beforeStates[slug].enabled !== afterStates[slug].enabled) {
      await announceModuleTransition(log, tenantId, actorId, slug, afterStates[slug].enabled);
    }
  }

  // Keep the tenant's Stripe subscription items in lockstep with the new EXPLICIT
  // module set (docs/67 §4). Only explicit purchases bill — a BUNDLED_FREE
  // capability has source 'bundled', no flag, and so never creates an item.
  // Best-effort + guarded: a no-op until billing is configured, and a Stripe
  // failure never blocks the toggle (the flag is already written; the webhook
  // reconciles authoritative state).
  if (isBillingConfigured()) {
    try {
      const explicitEnabled = MODULE_SLUGS.filter((s) => afterStates[s].source === 'explicit');
      const t = await prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { email: true, name: true },
      });
      if (t) {
        await syncModuleItems({
          tenantId,
          email: t.email,
          name: t.name,
          enabledModules: explicitEnabled,
        });
      }
    } catch (err) {
      log.error({ err }, 'billing: module item sync failed (non-fatal)');
    }
  }

  return nextSettings;
}

/** The pure decision for a SINGLE-module toggle. On enable, turn `target` on plus
 *  every PAID requirement (each is separately billed — enabling B2B also
 *  activates Commerce). On disable, refuse if any ENABLED module still requires
 *  `target` (`blockers` non-empty ⇒ caller rejects with a conflict). No I/O, no
 *  throw — the transport-specific error is the caller's to raise. */
export interface ModuleTogglePlan {
  writes: Map<ModuleSlug, boolean>;
  blockers: ModuleSlug[];
}
export function planModuleToggle(
  currentFlags: Record<string, boolean>,
  target: ModuleSlug,
  enabled: boolean
): ModuleTogglePlan {
  const writes = new Map<ModuleSlug, boolean>();
  if (enabled) {
    for (const m of [target, ...requiredModules(target)]) {
      if (currentFlags[m] !== true) writes.set(m, true);
    }
    return { writes, blockers: [] };
  }
  const blockers = blockingDependents(target, (m) => currentFlags[m] === true);
  if (blockers.length) return { writes, blockers };
  if (currentFlags[target] === true) writes.set(target, false);
  return { writes, blockers: [] };
}

export interface ToggleTenantModuleResult {
  /** Non-empty ⇒ the toggle was REJECTED: these enabled modules require `target`. */
  blocked: ModuleSlug[];
  /** Whether any flag actually changed (a redundant toggle is a no-op). */
  changed: boolean;
  /** The effective settings blob after the write (unchanged blob when no-op). */
  settings: unknown;
}

/** Read → plan → apply a single-module toggle for one tenant. The one entry point
 *  both the tenant route and the operator route call, so the flag write, the
 *  dual-bus announce, the cache flush, and the Stripe sync are identical
 *  regardless of who initiated it. Returns `blocked` (caller raises the conflict)
 *  rather than throwing, to stay transport-agnostic. */
export async function toggleTenantModule(opts: {
  log: FastifyBaseLogger;
  tenantId: string;
  /** Event actor — a tenant user id, or `null` for a platform/operator toggle. */
  actorId: string | null;
  slug: ModuleSlug;
  enabled: boolean;
  beforeSettings: unknown;
}): Promise<ToggleTenantModuleResult> {
  const currentFlags = readModuleFlags(opts.beforeSettings);
  const plan = planModuleToggle(currentFlags, opts.slug, opts.enabled);
  if (plan.blockers.length) {
    return { blocked: plan.blockers, changed: false, settings: opts.beforeSettings };
  }
  const settings = await applyModuleWrites(
    opts.log,
    opts.tenantId,
    opts.actorId,
    opts.beforeSettings,
    plan.writes
  );
  return { blocked: [], changed: plan.writes.size > 0, settings };
}

/** Format the "turn off X first" conflict message shared by both toggle surfaces. */
export function moduleBlockedMessage(blockers: ModuleSlug[], target: ModuleSlug): string {
  return `Turn off ${blockers.join(' and ')} first — ${
    blockers.length > 1 ? 'they require' : 'it requires'
  } ${target}.`;
}
