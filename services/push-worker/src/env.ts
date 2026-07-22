// Boot-time env validation. Cloud Run entrypoint (Pub/Sub push).
//
// VAPID keys are OPTIONAL so the service is deployable before they're
// provisioned — without them the worker boots and acks every message as a no-op
// (logged), the same way the chat concierge stands down until a tenant connects
// their own AI key. (That path used to hang off a platform-level
// ANTHROPIC_API_KEY; it is tenant-BYOK now — sparx holds no AI credential.)
// Generate a pair once with `npx web-push generate-vapid-keys`; the public half
// is also exposed to the dashboard as NEXT_PUBLIC_VAPID_PUBLIC_KEY.

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
  // VAPID application server keys. Both must be present to actually send.
  VAPID_PUBLIC_KEY: z.string().min(1).optional(),
  VAPID_PRIVATE_KEY: z.string().min(1).optional(),
  VAPID_SUBJECT: z.string().min(1).default('mailto:support@sparx.works'),
});

export type Env = z.infer<typeof EnvSchema>;

function parseEnv(): Env {
  const result = EnvSchema.safeParse(process.env);
  if (!result.success) {
    console.error('[push-worker] invalid environment:');
    for (const issue of result.error.issues) {
      console.error(`  - ${issue.path.join('.')}: ${issue.message}`);
    }
    process.exit(78); // EX_CONFIG
  }
  return result.data;
}

export const env: Env = parseEnv();
