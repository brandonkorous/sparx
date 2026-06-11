// Boot-time env validation (EX_CONFIG on failure) for the automation-worker.
//
// The worker connects as `sparx_app` via DATABASE_URL — the engine's cross-tenant
// discovery goes through SECURITY DEFINER helpers (migration 20260731000000), so
// it needs NO elevated/owner connection. Two trigger surfaces:
//   - Cloud Scheduler  → POST /internal/cron/tick, guarded by SPARX_INTERNAL_CRON_TOKEN
//   - Pub/Sub push     → POST /,                   guarded by the PUBSUB_INVOKER_SA OIDC claim
// GCP_PROJECT_ID switches the engine publisher from the dev logging-stub to real
// per-topic Pub/Sub (events an action emits, e.g. the loop-guarded cascade).

import 'dotenv/config';
import { z } from 'zod';

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  // Cloud Run injects PORT (default 8080).
  PORT: z.coerce.number().int().min(1).max(65535).default(8080),
  // sparx_app connection (FORCE RLS-bound). The same string the in-cluster app
  // tier uses — bound from the `database-url` secret in serverless.tf.
  DATABASE_URL: z.string().min(1),
  // Unset → engine publisher is the dev logging stub; set → real Pub/Sub.
  GCP_PROJECT_ID: z.string().optional(),
  // Shared secret guarding the Cloud Scheduler tick endpoint (docs/16 §2.5).
  // Same secret family as the CRM/commerce CronJobs (sparx-internal-cron-token).
  // Used for local/manual invocation; in prod the scheduler authenticates via
  // OIDC (TICK_INVOKER_SA) so no secret lands in the scheduler-job config/state.
  SPARX_INTERNAL_CRON_TOKEN: z.string().min(16).optional(),
  // Expected OIDC `email` claim for the Cloud Scheduler tick caller — the SA the
  // scheduler job impersonates (sparx-automation-scheduler@<project>). Set →
  // the tick endpoint accepts a matching OIDC caller in addition to the token.
  TICK_INVOKER_SA: z.string().email().optional(),
  // Expected `email` claim in the Pub/Sub push OIDC token — defense in depth on
  // top of Cloud Run's frontend auth. Set to the push subscription's invoker SA
  // (sparx-pubsub-invoker@<project>). Unset → accept any caller (local dev).
  PUBSUB_INVOKER_SA: z.string().email().optional(),
  // How many due runs to advance per tick (find_due_automation_runs limit).
  TICK_BATCH: z.coerce.number().int().min(1).max(1000).default(100),
});

export type Env = z.infer<typeof EnvSchema>;

function parseEnv(): Env {
  const result = EnvSchema.safeParse(process.env);
  if (!result.success) {
    console.error('[automation-worker] invalid environment:');
    for (const issue of result.error.issues) {
      console.error(`  - ${issue.path.join('.')}: ${issue.message}`);
    }
    process.exit(78); // EX_CONFIG
  }
  return result.data;
}

export const env: Env = parseEnv();
