// Boot-time env validation. Cloud Run entrypoint (Pub/Sub push).
//
// Mirrors services/push-worker/src/env.ts. GCP_PROJECT_ID is optional so the
// worker is deployable + locally runnable before it's set — without it the
// @sparx/events publisher falls back to its logging (no-op) transport, exactly
// like dev. The worker still does its DB recompute work; it just logs the
// downstream price.recomputed event instead of publishing it.

import 'dotenv/config';
import { z } from 'zod';

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  DATABASE_URL: z.string().min(1).optional(),
  // Cloud Run injects PORT (default 8080).
  PORT: z.coerce.number().int().min(1).max(65535).default(8080),
  // Expected `email` claim in the Pub/Sub push OIDC token (defense in depth on
  // top of Cloud Run's frontend auth). Unset → accept any caller (local dev).
  PUBSUB_INVOKER_SA: z.string().email().optional(),
  // GCP project — when set, downstream events publish to Pub/Sub; unset → logging publisher.
  GCP_PROJECT_ID: z.string().min(1).optional(),
});

export type Env = z.infer<typeof EnvSchema>;

function parseEnv(): Env {
  const result = EnvSchema.safeParse(process.env);
  if (!result.success) {
    console.error('[markup-recompute-worker] invalid environment:');
    for (const issue of result.error.issues) {
      console.error(`  - ${issue.path.join('.')}: ${issue.message}`);
    }
    process.exit(78); // EX_CONFIG
  }
  return result.data;
}

export const env: Env = parseEnv();
