// Boot-time env validation. Anything missing or malformed fails fast with a
// readable error, before Fastify starts listening — better than a 500 on the
// first request. Every env var the service reads must be declared here.
//
// Local dev reads `.env` (or `.env.local`) via dotenv; in prod the k8s
// Deployment hydrates the env from the sparx-app-env ConfigMap and the
// sparx-app-secrets Secret, so dotenv silently no-ops when neither file
// exists.

import 'dotenv/config';
import { z } from 'zod';

const EnvSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    PORT: z.coerce.number().int().min(0).max(65535).default(3100),
    HOST: z.string().default('0.0.0.0'),
    LOG_LEVEL: z
      .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
      .default('info'),
    DATABASE_URL: z.string().min(1),
    // Shared with the dashboard (and any other internal sparx service) — used
    // to sign + verify short-lived internal-trust JWTs that carry the staff
    // session's {tenantId, userId, role} from the dashboard to api-rest.
    SPARX_INTERNAL_JWT_SECRET: z.string().min(32),
    // Shared secret for the CRM scheduled-job CronJobs. k8s CronJobs POST
    // to /internal/crm/* with this in the X-sparx-Internal-Cron-Token
    // header. Optional in dev so a fresh checkout boots; missing-in-prod
    // is the operator's responsibility to provision via Secret Manager.
    SPARX_INTERNAL_CRON_TOKEN: z.string().min(16).optional(),
    // Shared secret for the internal L-PLAT acquisition report
    // (GET /internal/acquisition/summary, docs/80 §10). A SEPARATE secret from
    // the cron token because it exposes cross-tenant business intelligence — a
    // different blast radius than triggering a scheduler — so it rotates
    // independently. Optional in dev; unset → the endpoint returns 401.
    SPARX_INTERNAL_ACQUISITION_TOKEN: z.string().min(16).optional(),
    // Shared secret for the internal Partner Program endpoints (docs/114 §B.8):
    // the signup referral-attribution hook (POST /internal/partners/referrals),
    // the first-payment commission-accrual hook, and staff approve/tier/suspend.
    // A SEPARATE secret (writes cross-org referral/commission rows) — its own
    // blast radius, rotates independently. Optional in dev; unset → endpoints 401.
    SPARX_INTERNAL_PARTNERS_TOKEN: z.string().min(16).optional(),
    // Shared secret for the WizeWorks operator console's internal endpoints
    // (GET/POST /internal/operator/*, docs/apps/admin/build-plan.md §2 D6). The
    // admin app authenticates the operator (Better Auth + capabilities) then
    // calls these with this token + an X-sparx-Operator-Id header. A SEPARATE
    // secret from the cron/acquisition tokens — it exposes cross-tenant reads +
    // operator writes, its own blast radius, rotates independently. Optional in
    // dev; unset → the endpoints return 401 (fail-closed).
    SPARX_INTERNAL_OPERATOR_TOKEN: z.string().min(16).optional(),
    // The platform's OWN tenant (docs/80 §2 dogfooding) — sparx/WizeWorks running
    // as a tenant-of-record. Its tenant ID is the ONE allowed to claim a reserved
    // BRAND slug (e.g. `wizeworks`) via PATCH /v1/tenant/slug — the reservation
    // stops OUTSIDE tenants from squatting sparx/WizeWorks subdomains, not the
    // platform itself. Keyed on the immutable ID (not the slug) so the value stays
    // valid across the very rename it authorizes. Ops-controlled, never
    // user-settable. Unset → no carve-out (reserved slugs blocked for everyone).
    SPARX_PLATFORM_TENANT_ID: z.string().optional(),
    // Recipient for internal sparx-team notifications about first-party careers
    // applications (POST /v1/public/careers/apply). Optional with a safe literal
    // fallback (careers@sparx.works) so a fresh env still delivers — mirrors the
    // DASHBOARD_URL-style "optional env, sane default" idiom used elsewhere.
    CAREERS_NOTIFY_EMAIL: z.string().email().optional(),
    // Optional: when set, the Pub/Sub publisher uses Google Cloud Pub/Sub;
    // otherwise it logs to stdout and is a no-op (dev default). The publisher
    // resolves a topic per `EventType` (topic name == event type) — there is
    // no shared/fan-out topic to configure.
    GCP_PROJECT_ID: z.string().optional(),
    // Optional: when set (e.g. redis://redis:6379), the Live Chat WebSocket
    // server uses the socket.io Redis adapter so a message delivered to one
    // api-rest replica fans out to chat sockets on every other replica. Unset
    // (dev / single-instance) → the default in-memory adapter, which is correct
    // for one process. Mirrors the GCP_PROJECT_ID Pub/Sub stub philosophy.
    REDIS_URL: z.string().optional(),
    // Optional: when set, the Live Chat AI handler (docs/69 A-3) auto-responds
    // to storefront messages via Claude Haiku. Unset → AI is disabled and every
    // inbound customer message routes straight to a human (notification fires).
    ANTHROPIC_API_KEY: z.string().optional(),
    // Google Search Console connector (docs/50 §7, docs/97 §4). Per-tenant OAuth:
    // each tenant authorizes THEIR Search Console; a nightly job ingests organic
    // metrics. The whole connector is INERT until these are set — the connect
    // endpoints return a clear "not configured" error and the SEO overview keeps
    // showing representative data.
    //   GOOGLE_OAUTH_CLIENT_ID / _SECRET  — the GCP OAuth 2.0 Web client.
    //   SEARCH_CONSOLE_TOKEN_KEY          — 32-byte AES-256-GCM key (base64 or hex)
    //     encrypting the stored OAuth tokens at rest. Rotating it invalidates every
    //     stored grant (tenants re-authorize) — never log or expose it.
    GOOGLE_OAUTH_CLIENT_ID: z.string().optional(),
    GOOGLE_OAUTH_CLIENT_SECRET: z.string().optional(),
    SEARCH_CONSOLE_TOKEN_KEY: z.string().optional(),
    // Active domain registrar (docs/24). The registrar is abstracted behind the
    // @sparx/registrar `RegistrarClient` contract; this selects the provider.
    // 'godaddy' today; 'namecom' lands once its @sparx/namecom client is wired.
    REGISTRAR: z.enum(['godaddy', 'namecom']).default('godaddy'),
    // GoDaddy Reseller API credentials (docs/24 §3, docs/24 §10).
    // OTE (staging) credentials — used when the resolved env is OTE.
    GODADDY_API_KEY_OTE: z.string().optional(),
    GODADDY_API_SECRET_OTE: z.string().optional(),
    // Production credentials — used when the resolved env is prod.
    GODADDY_API_KEY_PROD: z.string().optional(),
    GODADDY_API_SECRET_PROD: z.string().optional(),
    // Optional override decoupling the GoDaddy environment from NODE_ENV
    // ('prod'|'production' | 'ote'|'test'). Unset → follows NODE_ENV. Lets local
    // dev hit GoDaddy's FREE production read endpoints (available/suggest; only
    // purchase charges), since the OTE sandbox is chronically degraded.
    GODADDY_ENV: z.enum(['prod', 'production', 'ote', 'test']).optional(),
    // Domain-checkout kill-switch. A domain registration is a HARD pass-through
    // cost — the instant we call GoDaddy `purchaseDomain`, ICANN/GoDaddy bills the
    // sparx reseller account for real (no trial, no reversal). So buying a NEW
    // domain (and renewing one) is gated OFF until tenant billing (Stripe
    // card-on-file) is wired and we can charge the tenant BEFORE registering. Off
    // → POST /v1/domains/purchase and /:id/renew return 403, and the dashboard
    // shows "checkout opens soon". Free *.sparx.zone subdomains and connecting a
    // domain you already own are unaffected — they cost nothing. Env is a string;
    // only the literal "true"/"1" enables it (avoids the z.coerce.boolean footgun
    // where the string "false" is truthy).
    DOMAIN_PURCHASE_ENABLED: z
      .string()
      .optional()
      .transform((v) => v === 'true' || v === '1'),
    // Stripe platform-level keys. Used by the webhook handlers and Stripe
    // Connect OAuth. Per-tenant keys live in ProviderInstallation configs.
    // STRIPE_SECRET_KEY       — platform/connect account secret key
    // STRIPE_PUBLISHABLE_KEY  — Stripe.js key; the storefront actually reads it as
    //   the build-time NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY in apps/site, so this
    //   server-side copy is informational (kept for parity / future config endpoint).
    // STRIPE_WEBHOOK_SECRET   — whsec_... legacy pre-gateway single-account commerce
    //   secret (superseded by the per-gateway secrets below).
    // STRIPE_WEBHOOK_SECRET_SPARX_PAY — whsec_... for the sparx Pay (Connect
    //   destination-charge) payment webhook POST /v1/public/webhooks/sparx-pay.
    //   Read by @sparx/payments' SparxPayGateway; declared here so boot validates it
    //   and .env.example documents it. (Stripe Direct uses per-tenant secrets in GSM,
    //   not an env var; the BYO gateways verify with their own stored secrets.)
    // STRIPE_CLIENT_ID        — Connect OAuth client_id (ca_...)
    // STRIPE_WEBHOOK_SECRET_BILLING — whsec_... for the PLATFORM billing webhook
    //   (subscription/invoice events). Separate endpoint, separate signing secret
    //   (docs/67 §6) so a commerce-webhook secret rotation can't break billing.
    STRIPE_SECRET_KEY: z.string().optional(),
    STRIPE_PUBLISHABLE_KEY: z.string().optional(),
    STRIPE_WEBHOOK_SECRET: z.string().optional(),
    STRIPE_WEBHOOK_SECRET_SPARX_PAY: z.string().optional(),
    STRIPE_WEBHOOK_SECRET_BILLING: z.string().optional(),
    STRIPE_CLIENT_ID: z.string().optional(),
    // Media storage. When GCS_MEDIA_BUCKET is set we use Cloud Storage with
    // presigned PUT URLs; otherwise we fall back to a local-disk backend at
    // MEDIA_LOCAL_DIR (the dashboard PUTs through api-rest in that mode).
    // The split: originals + tenant-sensitive objects → private bucket
    // (GCS_MEDIA_BUCKET); derived variants → public bucket
    // (GCS_MEDIA_PUBLIC_BUCKET, world-readable for storefront <img src>).
    // GCS_MEDIA_PUBLIC_BUCKET defaults to "" so it's only required when GCS
    // mode is active — boot validation surfaces a missing-but-required error
    // via the superRefine below.
    GCS_MEDIA_BUCKET: z.string().optional(),
    GCS_MEDIA_PUBLIC_BUCKET: z.string().default(''),
    MEDIA_LOCAL_DIR: z.string().default('.media-tmp'),
    // Public base URL for serving processed variants. In prod this is the
    // Cloudflare-fronted CDN domain; in dev it's the api-rest origin so the
    // dashboard can hit /v1/public/media/variants/<key>.
    MEDIA_PUBLIC_URL: z.string().default(''),
    // SMS provider (docs/79 §10) — the Scheduling booking-notification dispatch
    // tick sends reminders/confirmations over SMS via @sparx/sms. Unset (or any
    // value but 'twilio', or 'twilio' without creds) → the console provider, which
    // logs instead of sending, so local + un-provisioned tenants still exercise the
    // full path safely. Real SMS needs SMS_PROVIDER=twilio + the TWILIO_* creds
    // (a From number OR a Messaging Service SID).
    SMS_PROVIDER: z.string().optional(),
    TWILIO_ACCOUNT_SID: z.string().optional(),
    TWILIO_AUTH_TOKEN: z.string().optional(),
    TWILIO_FROM: z.string().optional(),
    TWILIO_MESSAGING_SERVICE_SID: z.string().optional(),
    // Calendar sync (docs/79 §8) — AES-256-GCM key (32 bytes, base64 or hex)
    // encrypting calendar credentials at rest (iCal feed URLs, OAuth tokens,
    // CalDAV app-passwords) in scheduling_calendar_connections, mirroring
    // SEARCH_CONSOLE_TOKEN_KEY. Unset → the calendar-connection endpoints return a
    // clear "not configured" error and the inbound-sync tick is inert (the rest of
    // Scheduling, incl. outbound iCal, is unaffected). Rotating it invalidates
    // every stored calendar credential (tenants reconnect) — never log it.
    SCHEDULING_CALENDAR_TOKEN_KEY: z.string().optional(),
    // Layer-3 OAuth calendar sync (docs/79 §8.3, §8.5). Google reuses the shared
    // GOOGLE_OAUTH_CLIENT_ID/_SECRET (the same OAuth web client, with the Calendar
    // scopes added) — no separate key. Microsoft needs its own Azure app:
    //   MICROSOFT_OAUTH_CLIENT_ID / _SECRET — the registered app (multitenant; the
    //     per-org admin grants Calendars.ReadWrite consent on connect).
    //   MICROSOFT_OAUTH_TENANT — the directory the authorize/token calls target
    //     ('common' default = any work/school OR personal account; an org may pin
    //     its own tenant id). A set CLIENT_ID requires the matching _SECRET +
    //     SCHEDULING_CALENDAR_TOKEN_KEY (the OAuth tokens are encrypted at rest),
    //     validated below. Until set, the Microsoft connect button reports
    //     "not configured" and BYO/iCal remain the fallbacks.
    MICROSOFT_OAUTH_CLIENT_ID: z.string().optional(),
    MICROSOFT_OAUTH_CLIENT_SECRET: z.string().optional(),
    MICROSOFT_OAUTH_TENANT: z.string().optional(),
    // Public api-rest origin used as the push-notification target for Google
    // watch-channels + Microsoft Graph subscriptions (docs/79 §8.3). Must be a
    // public HTTPS URL the provider can POST to; unset (or localhost) → push
    // channels are skipped and the connection falls back to the polling tick. Also
    // the base the outbound `.ics` feed links use (lib/scheduling-ical.ts).
    SPARX_PUBLIC_API_REST_URL: z.string().optional(),
    // Channel integrations (docs/106) — connect external sales channels (Google
    // Shopping, Meta, Pinterest, …) so catalog/inventory sync out. Per-tenant OAuth
    // tokens are AES-256-GCM encrypted at rest in channel_connections, keyed by
    // CHANNELS_TOKEN_KEY (32 bytes, base64 or hex; rotating it invalidates every
    // stored channel grant — tenants reconnect — never log it). Each channel stays
    // INERT until its platform app credentials are set: the connect endpoint reports
    // it `coming_soon` and the dashboard disables Connect, with no code change when
    // ops later provisions the approved app.
    //   Google Shopping reuses GOOGLE_OAUTH_CLIENT_ID/_SECRET (the same Google OAuth
    //   web client, with the Content API scope added) — no separate key.
    //   META_APP_ID / _SECRET       — the Meta (Facebook/Instagram) app.
    //   PINTEREST_APP_ID / _SECRET  — the Pinterest app.
    //   TIKTOK_APP_KEY / _SECRET    — the TikTok Shop ISV app (signs every call).
    //   TIKTOK_WEBHOOK_SECRET       — order-webhook signature key (defaults to the
    //                                 app secret when unset; set it if TikTok issues
    //                                 a distinct webhook secret).
    //   ETSY_API_KEY / _SECRET      — the Etsy app keystring (= OAuth client_id +
    //                                 x-api-key header) + shared secret. Order ingest
    //                                 is poll-based (Etsy has no order webhooks).
    //   WALMART_CLIENT_ID / _SECRET — the Walmart Marketplace API keys (client-creds
    //                                 token; per-seller / Solution-Provider). Poll ingest.
    //   EBAY_CLIENT_ID / _SECRET    — the eBay App ID / Cert ID. EBAY_RU_NAME is the
    //                                 registered Redirect-URL name (sent as redirect_uri
    //                                 on authorize/exchange when set). Poll ingest.
    //   FAIRE_CLIENT_ID / _SECRET   — the Faire partner app. FAIRE_WEBHOOK_SECRET signs
    //                                 the order webhook (Faire ingests by webhook + poll).
    //   AMAZON_LWA_CLIENT_ID/_SECRET — the Login-with-Amazon app (SP-API token). AMAZON_SP_APP_ID
    //                                 is the SP-API application id for the Seller Central consent
    //                                 URL; AMAZON_MARKETPLACE_ID / AMAZON_REGION default the
    //                                 marketplace + regional host. Order ingest is poll-based
    //                                 (Orders API + a Restricted Data Token for buyer PII); gated
    //                                 additionally on Amazon's restricted-PII security audit.
    CHANNELS_TOKEN_KEY: z.string().optional(),
    META_APP_ID: z.string().optional(),
    META_APP_SECRET: z.string().optional(),
    PINTEREST_APP_ID: z.string().optional(),
    PINTEREST_APP_SECRET: z.string().optional(),
    TIKTOK_APP_KEY: z.string().optional(),
    TIKTOK_APP_SECRET: z.string().optional(),
    TIKTOK_WEBHOOK_SECRET: z.string().optional(),
    ETSY_API_KEY: z.string().optional(),
    ETSY_API_SECRET: z.string().optional(),
    WALMART_CLIENT_ID: z.string().optional(),
    WALMART_CLIENT_SECRET: z.string().optional(),
    EBAY_CLIENT_ID: z.string().optional(),
    EBAY_CLIENT_SECRET: z.string().optional(),
    EBAY_RU_NAME: z.string().optional(),
    FAIRE_CLIENT_ID: z.string().optional(),
    FAIRE_CLIENT_SECRET: z.string().optional(),
    FAIRE_WEBHOOK_SECRET: z.string().optional(),
    AMAZON_LWA_CLIENT_ID: z.string().optional(),
    AMAZON_LWA_CLIENT_SECRET: z.string().optional(),
    AMAZON_SP_APP_ID: z.string().optional(),
    AMAZON_MARKETPLACE_ID: z.string().optional(),
    AMAZON_REGION: z.string().optional(),
    // sparx.market (docs/106 §4.7) — the first-party marketplace. MARKET_ENABLED
    // ('true') flips the channel `available` at runtime (the apps/market storefront
    // is deployed + the platform Stripe account is ready). MARKET_COMMISSION_BPS is
    // the flat platform commission in basis points (default 200 = 2%); a per-tenant
    // override on the merchant profile wins. MARKET_PAYOUTS_PROVIDER selects the ACH
    // disbursement rail (defaults to manual / out-of-band). SPARX_DASHBOARD_URL is
    // the base for settlement-report email links. The MoR checkout reuses the
    // platform STRIPE_SECRET_KEY (above) + CHANNELS_TOKEN_KEY (payout encryption).
    MARKET_ENABLED: z.string().optional(),
    MARKET_COMMISSION_BPS: z.string().optional(),
    MARKET_PAYOUTS_PROVIDER: z.string().optional(),
    SPARX_DASHBOARD_URL: z.string().optional(),
    // In-cluster origin of the dashboard Next.js service, used ONLY for the
    // service-to-service partner account-provisioning call (POST
    // /api/internal/partner-provision, docs/114 §B.2). Distinct from
    // SPARX_DASHBOARD_URL (which is a browser-facing base for email links): this
    // is the private ClusterIP address (e.g. http://dashboard:3000). Account
    // creation runs only where Better Auth lives — the dashboard — so approving an
    // accountless partner delegates here. The call authenticates with
    // SPARX_INTERNAL_JWT_SECRET (already shared both ways). Defaults to the dev
    // dashboard origin so a local checkout works without extra wiring.
    SPARX_DASHBOARD_INTERNAL_URL: z.string().default('http://localhost:3001'),
  })
  .superRefine((data, ctx) => {
    // GCS mode requires both buckets — the public one holds variants,
    // the private one holds originals. Missing the public bucket would
    // mean every storefront <img src> 404s.
    if (data.GCS_MEDIA_BUCKET && !data.GCS_MEDIA_PUBLIC_BUCKET) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['GCS_MEDIA_PUBLIC_BUCKET'],
        message: 'Required when GCS_MEDIA_BUCKET is set (split-bucket setup).',
      });
    }

    // Search Console: enabling the OAuth client means the token-encryption key +
    // client secret are mandatory — a half-configured connector would store
    // plaintext tokens or fail every exchange. Validate as a set, not piecemeal.
    if (data.GOOGLE_OAUTH_CLIENT_ID) {
      if (!data.GOOGLE_OAUTH_CLIENT_SECRET) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['GOOGLE_OAUTH_CLIENT_SECRET'],
          message: 'Required when GOOGLE_OAUTH_CLIENT_ID is set.',
        });
      }
      if (!data.SEARCH_CONSOLE_TOKEN_KEY) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['SEARCH_CONSOLE_TOKEN_KEY'],
          message: 'Required when GOOGLE_OAUTH_CLIENT_ID is set (encrypts stored tokens).',
        });
      }
    }
    // A provided key must decode to exactly 32 bytes (AES-256), as base64 or hex.
    if (data.SEARCH_CONSOLE_TOKEN_KEY && decodeKeyBytes(data.SEARCH_CONSOLE_TOKEN_KEY) !== 32) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['SEARCH_CONSOLE_TOKEN_KEY'],
        message: 'Must be a 32-byte key encoded as base64 (44 chars) or hex (64 chars).',
      });
    }
    if (
      data.SCHEDULING_CALENDAR_TOKEN_KEY &&
      decodeKeyBytes(data.SCHEDULING_CALENDAR_TOKEN_KEY) !== 32
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['SCHEDULING_CALENDAR_TOKEN_KEY'],
        message: 'Must be a 32-byte key encoded as base64 (44 chars) or hex (64 chars).',
      });
    }
    // Microsoft calendar OAuth: enabling the client means the secret + the
    // token-encryption key are mandatory — a half-configured app would store
    // plaintext tokens or fail every exchange. Validate as a set (mirrors Google
    // above). Google calendar reuses GOOGLE_OAUTH_CLIENT_ID, already validated.
    if (data.MICROSOFT_OAUTH_CLIENT_ID) {
      if (!data.MICROSOFT_OAUTH_CLIENT_SECRET) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['MICROSOFT_OAUTH_CLIENT_SECRET'],
          message: 'Required when MICROSOFT_OAUTH_CLIENT_ID is set.',
        });
      }
      if (!data.SCHEDULING_CALENDAR_TOKEN_KEY) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['SCHEDULING_CALENDAR_TOKEN_KEY'],
          message: 'Required when MICROSOFT_OAUTH_CLIENT_ID is set (encrypts stored tokens).',
        });
      }
    }
  });

/** Decode a base64- or hex-encoded key to its byte length (0 if unparseable),
 *  so env validation can reject a wrong-sized AES key at boot. */
function decodeKeyBytes(raw: string): number {
  if (/^[0-9a-fA-F]{64}$/.test(raw)) return 32;
  try {
    return Buffer.from(raw, 'base64').length;
  } catch {
    return 0;
  }
}

export type Env = z.infer<typeof EnvSchema>;

function parseEnv(): Env {
  const result = EnvSchema.safeParse(process.env);
  if (!result.success) {
    console.error('[api-rest] invalid environment:');
    for (const issue of result.error.issues) {
      console.error(`  - ${issue.path.join('.')}: ${issue.message}`);
    }
    process.exit(78); // EX_CONFIG
  }
  return result.data;
}

export const env: Env = parseEnv();
