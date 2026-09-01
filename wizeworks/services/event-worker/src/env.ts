// Process-level env validation.
//
// Deliberately SMALL. Each worker library still owns and validates the settings
// only it understands — Typesense keys in @wizeworks/commerce-indexer, VAPID keys in
// @wizeworks/push-worker, GoDaddy credentials in @wizeworks/domain-worker — and those
// modules parse their own schema when they are imported here. This file covers
// only what the process as a whole needs.
//
// A CONSEQUENCE OF MERGING, stated plainly: those schemas all evaluate in one
// process now, so a missing required variable no longer takes down one handler,
// it stops the whole event worker from booting. In production that is a
// distinction without a difference — every worker read the same `sparx-app-env`
// ConfigMap and `sparx-app-secrets` Secret, so a missing value was already
// missing for all of them. It matters locally: run this and you need the full
// set, not the subset one worker wanted.

import 'dotenv/config';
import { z } from 'zod';

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  DATABASE_URL: z.string().min(1),
  /** The one HTTP listener: /healthz for probes, plus the cron routes. */
  PORT: z.coerce.number().int().min(1).max(65535).default(8080),
  /**
   * How often this process drives the automation engine's tick, in ms. `0` turns
   * the in-process heartbeat off and leaves it entirely to the CronJob.
   *
   * The engine advances runs on a HEARTBEAT, and until this existed the only thing
   * that produced one was `k8s/cronjobs/automation-tick.yaml`. Outside Kubernetes
   * nothing ticked at all, which that file's own header predicts word for word:
   * "the worker runs and subscribes but nothing ever ticks: scheduled automations,
   * delayed steps and drip sequences all simply stop. That is silent — the pod is
   * healthy, the queue is empty, and the only symptom is work that never happens."
   *
   * That is exactly what local development had. A form submission enqueued a run
   * and the run sat at `cursor_index: 0` forever; a first manual tick found 100 due
   * runs and 20 due schedules banked up behind it (issue 354).
   *
   * Safe to run ALONGSIDE the CronJob: `runAutomationTick` takes a Postgres
   * advisory lock, so a second tick that overlaps returns `acquired: false` and
   * does nothing. Matching the CronJob's every-minute schedule.
   */
  AUTOMATION_TICK_INTERVAL_MS: z.coerce.number().int().min(0).max(3_600_000).default(60_000),
});

export type Env = z.infer<typeof EnvSchema>;

function parseEnv(): Env {
  const result = EnvSchema.safeParse(process.env);
  if (!result.success) {
    console.error('[event-worker] invalid environment:');
    for (const issue of result.error.issues) {
      console.error(`  - ${issue.path.join('.')}: ${issue.message}`);
    }
    process.exit(78); // EX_CONFIG
  }
  return result.data;
}

export const env: Env = parseEnv();
