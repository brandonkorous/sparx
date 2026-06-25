import 'dotenv/config';
import { z } from 'zod';

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  DATABASE_URL: z.string().min(1).optional(),
  PORT: z.coerce.number().int().min(1).max(65535).default(8080),
  PUBSUB_INVOKER_SA: z.string().email().optional(),
  GCP_PROJECT_ID: z.string().optional(),
  // AES-256-GCM key decrypting the per-tenant channel OAuth tokens stored on
  // channel_connections (must match api-rest's CHANNELS_TOKEN_KEY). Read directly
  // by @sparx/channels/crypto; declared here for boot visibility. Unset → token
  // decryption throws and pushes are skipped with a recorded error.
  CHANNELS_TOKEN_KEY: z.string().optional(),
  // Storefront base for the product landing URL feeds require ({slug} placeholder,
  // e.g. https://{slug}.sparx.zone) — mirrors the email path's SPARX_SITE_BASE.
  // Unset → products are skipped (no absolute URL to feed).
  SPARX_SITE_BASE: z.string().optional(),
  // Public media resolution for feed image URLs (read by the projection's inlined
  // mediaUrl, mirroring @sparx/commerce). One of CDN or a public bucket.
  SPARX_MEDIA_CDN_URL: z.string().optional(),
  GCS_MEDIA_PUBLIC_BUCKET: z.string().optional(),
  GCS_MEDIA_BUCKET: z.string().optional(),
});

export type Env = z.infer<typeof EnvSchema>;

function parseEnv(): Env {
  const result = EnvSchema.safeParse(process.env);
  if (!result.success) {
    console.error('[channel-sync-worker] invalid environment:');
    for (const issue of result.error.issues) {
      console.error(`  - ${issue.path.join('.')}: ${issue.message}`);
    }
    process.exit(78);
  }
  return result.data;
}

export const env: Env = parseEnv();
