// Boot-time env validation. Cloud Run entrypoint (Pub/Sub push).
//
// SOCIAL_TOKEN_KEY + the platform OAuth app creds (GOOGLE_OAUTH_CLIENT_ID/_SECRET)
// are OPTIONAL so the service is deployable before they're provisioned — without the
// token key the worker can't decrypt a grant, so it acks each message as a no-op
// (logged), the same stance push-worker takes without VAPID keys. GCP_PROJECT_ID
// unset → the @sparx/events publisher falls back to its logging (no-op) transport, so
// result events log instead of publishing.

import 'dotenv/config';
import { z } from 'zod';

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  DATABASE_URL: z.string().min(1).optional(),
  // Cloud Run injects PORT (default 8080).
  PORT: z.coerce.number().int().min(1).max(65535).default(8080),
  // Expected `email` claim in the Pub/Sub push OIDC token (defense in depth on top of
  // Cloud Run's frontend auth). Unset → accept any caller (local dev).
  PUBSUB_INVOKER_SA: z.string().email().optional(),
  // Set → result events publish to Pub/Sub; unset → logging (no-op) publisher.
  GCP_PROJECT_ID: z.string().min(1).optional(),
  // AES-256-GCM key decrypting the stored social OAuth grants. Unset → the worker
  // cannot publish (it acks each message as a no-op).
  SOCIAL_TOKEN_KEY: z.string().min(1).optional(),
  // Public origin serving processed media variants (the api-rest public base). A
  // platform fetches a post's image from `${base}/v1/public/media/variants/{key}`.
  // Unset → posts publish text-only (media is skipped, logged). Slice 6 layers
  // per-platform aspect variants + focal-point crops on top of this base resolution.
  MEDIA_PUBLIC_BASE_URL: z.string().url().optional(),
});

export type Env = z.infer<typeof EnvSchema>;

function parseEnv(): Env {
  const result = EnvSchema.safeParse(process.env);
  if (!result.success) {
    console.error('[social-worker] invalid environment:');
    for (const issue of result.error.issues) {
      console.error(`  - ${issue.path.join('.')}: ${issue.message}`);
    }
    process.exit(78); // EX_CONFIG
  }
  return result.data;
}

export const env: Env = parseEnv();
