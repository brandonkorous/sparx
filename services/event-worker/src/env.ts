// Process-level env validation.
//
// Deliberately SMALL. Each worker library still owns and validates the settings
// only it understands — Typesense keys in @sparx/commerce-indexer, VAPID keys in
// @sparx/push-worker, GoDaddy credentials in @sparx/domain-worker — and those
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
