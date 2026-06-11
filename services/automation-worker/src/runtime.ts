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
// NOTE (Slice F): module-owned effect executors (crm.add_tag, email.send, …)
// register through @sparx/automation's `registerAction` seam. They live with
// their service packages and land in Slice F together with the seeded system
// automations that use them. Until then the worker registers only the platform
// built-ins (platform.webhook); an automation referencing an unwired action
// fails its step loudly (UnregisteredActionError) rather than silently skipping.

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
import { prisma } from '@sparx/db';
import { createPublisher } from '@sparx/events';
import type { Logger } from 'pino';
import { env } from './env.js';

function makeDeps(logger: Logger): EngineDeps {
  // Idempotent: registers the built-in resolvers/scanners/actions once.
  installBuiltins();
  // createPublisher caches internally — projectId unset ⇒ dev logging stub.
  const publisher = createPublisher({ projectId: env.GCP_PROJECT_ID, logger });
  return { publisher, logger };
}

export interface TickSummary {
  schedule: ScheduleTickResult;
  runs: TickResult;
}

export async function runTick(logger: Logger): Promise<TickSummary> {
  const deps = makeDeps(logger);
  const schedule = await runScheduleTick(deps, prisma);
  const runs = await runAutomationTick(deps, prisma, env.TICK_BATCH);
  return { schedule, runs };
}

export async function ingest(envelope: TriggerEnvelope, logger: Logger): Promise<void> {
  const deps = makeDeps(logger);
  await handleTrigger(envelope, deps);
}
