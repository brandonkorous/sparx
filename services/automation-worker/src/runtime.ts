// Engine wiring for the worker. Builds the EngineDeps (publisher + logger),
// installs the built-in resolvers/scanners/actions, and exposes the two entry
// points the HTTP server drives:
//
//   runTick(logger)  — schedule tick THEN run tick, in that order, so a run a
//                      schedule just enqueued can start advancing in the same
//                      tick instead of waiting a full interval.
//   ingest(envelope) — one Pub/Sub-delivered trigger → handleTrigger.
//
// Everything runs on the shared `@sparx/db` prisma client (sparx_app, FORCE
// RLS). Cross-tenant discovery inside the ticks goes through the SECURITY
// DEFINER scan helpers; per-run/per-tenant work re-enters withTenant. handleTrigger
// uses the same default client (no override passed).
//
// Module-owned effect executors (crm.add_tag, crm.create_task, …) register
// through @sparx/automation's `registerAction` seam via @sparx/automation-actions
// (the module-effect composition root). @sparx/crm is now backend-clean (its
// dashboard manifest moved to the dashboard; module-gating moved to @sparx/modules),
// so this stays a lean worker — no React/UI/auth in the image.
//
// `installCrmPubSubBridge` swaps @sparx/crm's default LoggingPublisher (which
// discards) for the real per-topic Pub/Sub publisher, so a crm.* event an
// executor produces actually reaches the downstream consumers (email-worker,
// search indexer, webhooks). It no-ops when GCP_PROJECT_ID is unset (dev/test).

import {
  installModuleActions,
  reconcileSystemSeeds,
  seedSystemAutomations,
  type ReconcileSummary,
} from '@sparx/automation-actions';
import {
  handleTrigger,
  installBuiltins,
  runAutomationTick,
  runScheduleTick,
  type EngineDeps,
  type ScheduleTickResult,
  type TickResult,
  type TriggerEnvelope,
} from '@sparx/automation';
import { installCrmPubSubBridge } from '@sparx/crm/pubsub';
import { prisma } from '@sparx/db';
import { drainDueEnrollments, type DrainResult } from '@sparx/email-sequences';
import { createPublisher } from '@sparx/events';
import type { Logger } from 'pino';
import { env } from './env.js';

let engineInstalled = false;

/** One-time engine setup (idempotent guards make repeat calls safe). */
function ensureEngineInstalled(logger: Logger): void {
  if (engineInstalled) return;
  engineInstalled = true;
  installBuiltins();
  installModuleActions();
  // Real Pub/Sub for crm.* events the executors emit (no-op without projectId).
  installCrmPubSubBridge({ projectId: env.GCP_PROJECT_ID, logger });
}

function makeDeps(logger: Logger): EngineDeps {
  ensureEngineInstalled(logger);
  // createPublisher caches internally — projectId unset ⇒ dev logging stub.
  const publisher = createPublisher({ logger });
  return { publisher, logger };
}

export interface TickSummary {
  schedule: ScheduleTickResult;
  runs: TickResult;
  sequences: DrainResult;
}

export async function runTick(logger: Logger): Promise<TickSummary> {
  const deps = makeDeps(logger);
  const schedule = await runScheduleTick(deps, prisma);
  const runs = await runAutomationTick(deps, prisma, env.TICK_BATCH);
  // Advance due email-sequence enrollments (send the current step, schedule the
  // next) — the same durable, resumable, cross-pod-singleton shape as the run tick.
  const sequences = await drainDueEnrollments(prisma, env.TICK_BATCH);
  return { schedule, runs, sequences };
}

/**
 * Daily backfill/reconcile pass: seed system automations for every tenant whose
 * owning module is ALREADY active (docs/84 Slice F2 backfill). Slice E only
 * seeds forward on `module.activated`, so tenants active before the engine
 * shipped — and any whose activation event was dropped — are covered here.
 * Idempotent; runs on the shared sparx_app client (cross-tenant discovery via
 * the `find_tenants_with_active_module` SECURITY DEFINER scan).
 */
export async function reconcileSeeds(logger: Logger): Promise<ReconcileSummary> {
  return reconcileSystemSeeds(prisma, logger);
}

/** The module slug a `module.activated` envelope carries, if any. */
function activatedModule(data: unknown): string | undefined {
  if (data && typeof data === 'object' && !Array.isArray(data)) {
    const m = (data as Record<string, unknown>).module;
    if (typeof m === 'string' && m.length > 0) return m;
  }
  return undefined;
}

export async function ingest(envelope: TriggerEnvelope, logger: Logger): Promise<void> {
  const deps = makeDeps(logger);

  // `module.activated` is a PROVISIONING signal, not an automation trigger:
  // install the activated module's system automations (idempotent), rather than
  // matching automations to fire. This is the event-driven seed path (docs/84
  // Slice E4) replacing the dashboard's direct /v1/<module>/bootstrap calls.
  if (envelope.type === 'module.activated') {
    const module = activatedModule(envelope.data);
    const installed = await seedSystemAutomations(
      { tenantId: envelope.tenantId },
      module ? { module } : {}
    );
    logger.info(
      { tenantId: envelope.tenantId, module, count: installed.length },
      'seeded system automations on module activation'
    );
    return;
  }

  await handleTrigger(envelope, deps);
}
