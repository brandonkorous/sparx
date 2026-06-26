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
  // TikTok Shop ISV app credentials — the order-channel adapter signs every
  // outbound call (catalog/inventory/fulfillment push) with them. Read directly by
  // @sparx/channels' TikTok adapter; declared here for boot visibility. Unset →
  // a connected TikTok shop's pushes fail with a recorded sync error until ops sets
  // the approved app creds.
  TIKTOK_APP_KEY: z.string().optional(),
  TIKTOK_APP_SECRET: z.string().optional(),
  // P3 order-channel app credentials — the worker's outbound push (catalog /
  // inventory / fulfillment) signs/authorizes calls with them, read directly by the
  // @sparx/channels adapters. Unset → a connected shop's pushes fail with a recorded
  // sync error until ops sets the approved app creds (the channel stays coming_soon).
  ETSY_API_KEY: z.string().optional(),
  ETSY_API_SECRET: z.string().optional(),
  WALMART_CLIENT_ID: z.string().optional(),
  WALMART_CLIENT_SECRET: z.string().optional(),
  EBAY_CLIENT_ID: z.string().optional(),
  EBAY_CLIENT_SECRET: z.string().optional(),
  EBAY_RU_NAME: z.string().optional(),
  FAIRE_CLIENT_ID: z.string().optional(),
  FAIRE_CLIENT_SECRET: z.string().optional(),
  // Amazon SP-API (P4) — the worker's outbound push uses the Feeds API (token-scoped,
  // no seller-id). LWA creds refresh the access token; marketplace/region default the
  // SP-API host when a connection's stored params don't carry them.
  AMAZON_LWA_CLIENT_ID: z.string().optional(),
  AMAZON_LWA_CLIENT_SECRET: z.string().optional(),
  AMAZON_MARKETPLACE_ID: z.string().optional(),
  AMAZON_REGION: z.string().optional(),
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
