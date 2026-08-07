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
  // Direct-origin media host (DNS-only, NOT Cloudflare-proxied) for platforms that
  // publish by handing their OWN servers an image_url to fetch — Instagram, Threads,
  // Pinterest. Cloudflare serves any `Range: bytes=0-` request a `206 Partial Content`
  // (even the whole file), and those platforms reject a 206, so a post silently drops
  // its image. Facebook/LinkedIn sidestep this by byte-uploading (they download via
  // this worker, which sends no Range) so they KEEP the CDN host. This host bypasses
  // CF's edge, so the origin's clean 200 reaches the platform. Unset → those platforms
  // fall back to MEDIA_PUBLIC_BASE_URL (the pre-fix behavior). See cloudflare.tf
  // `sparx_works_media_direct` + the Caddy `media-direct.sparx.works` vhost.
  MEDIA_DIRECT_BASE_URL: z.string().url().optional(),
  // Where a notification email's buttons point is no longer declared here. It was
  // one of four environment variables naming the same URL, each read by a
  // different emitter — and this one's links were dead regardless, since they
  // used a query parameter the workbench has never read. `appOrigin()` in
  // `@sparx/links/server` reads every such variable, in one fixed order, once.
  // WORKBENCH_BASE_URL still works; it is simply not this service's private
  // opinion any more.
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
