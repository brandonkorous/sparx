// The customer Better Auth instance (Layer 2 — site shoppers). See docs/27 v2.
//
// A DEDICATED instance, isolated from the staff instance (@sparx/auth) in every
// dimension: its own secret (CUSTOMER_AUTH_SECRET), its own cookie
// (sparx_customer_session), its own tenant-scoped tables (customer_*), and
// application-level multi-tenancy so the same email is a separate account per
// tenant. Tenant scoping is enforced by the tenant-scoping adapter (tenant-adapter.ts)
// + Postgres RLS; this file wires the Better Auth options.

import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { mcp } from 'better-auth/plugins';
import { APIError, createAuthMiddleware, getSessionFromCtx } from 'better-auth/api';

import { hashPassword, verifyPassword } from './hash';
import { publishCustomerAuthEmail } from './email';
import { resolveStoreBaseUrl } from './store-url';
import { SESSION_COOKIE_NAME } from './session';
import { tenantScopedClient } from './tenant-adapter';
import { CUSTOMER_MCP_SCOPES, verifyCustomerConsentGrant } from './mcp-scopes';

declare global {
  var __sparxCustomerAuth: ReturnType<typeof createCustomerAuth> | undefined;
}

/** Reset-token lifetime surfaced in the email copy (Better Auth default is 1h). */
const RESET_EXPIRES_MINUTES = 60;

/** The secret the customer Better Auth instance is constructed with — the SINGLE
 *  source so the consent-grant minter (api-rest) and the /mcp/authorize guard
 *  (which reads `ctx.context.secret`) sign + verify with the identical key. */
export function customerAuthSecret(): string {
  return process.env.CUSTOMER_AUTH_SECRET ?? process.env.BETTER_AUTH_SECRET ?? '';
}

/** Reconstruct the store's own public origin from the forwarded request headers.
 *  The AS lives on the store origin (Caddy routes `<store>/v1/public/auth/*` to
 *  api-rest), so the browser stays same-origin with its session cookie. api-rest
 *  runs behind Caddy (trustProxy), which sets X-Forwarded-Host/Proto. */
function storeOriginFromHeaders(headers: Headers | undefined): string | null {
  if (!headers) return null;
  const host = headers.get('x-forwarded-host') ?? headers.get('host');
  if (!host) return null;
  const firstHost = host.split(',')[0]?.trim();
  if (!firstHost) return null;
  const rawProto = headers.get('x-forwarded-proto')?.split(',')[0]?.trim();
  const proto = rawProto && rawProto.length > 0 ? rawProto : 'https';
  return `${proto}://${firstHost}`;
}

// Consent guard for the customer instance's `/mcp/authorize` (mirrors the operator
// flow, @sparx/auth server.ts). That endpoint mints an auth code for ANY requested
// scope the moment a shopper has a session — it only shows a consent screen on
// `prompt=consent`, which an attacker's self-registered DCR client won't send. On
// a PUBLIC surface that is a confused-deputy hole. So we require a signed,
// session-bound, short-lived consent grant (minted only by the store-branded
// consent page after the shopper explicitly picks scopes); any /mcp/authorize hit
// without a valid grant is bounced to that page ON THE STORE'S OWN ORIGIN.
const customerMcpAuthorizeGuard = createAuthMiddleware(async (ctx) => {
  if (ctx.path !== '/mcp/authorize') return;

  const storeOrigin = storeOriginFromHeaders(ctx.headers);
  const query = (ctx.query ?? {}) as Record<string, unknown>;

  // Rebuild the consent-page URL (store origin) from the original authorize params
  // (minus our own grant param). toConsent() returns `never`, so each guard below
  // both terminates and narrows. If we can't resolve the store origin we cannot
  // safely build a redirect — fail closed with a plain error.
  const toConsent = (): never => {
    if (!storeOrigin)
      throw new APIError('BAD_REQUEST', { message: 'Unable to resolve store origin.' });
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(query)) {
      if (k === 'sparx_grant') continue;
      if (typeof v === 'string') params.set(k, v);
    }
    throw ctx.redirect(`${storeOrigin}/account/authorize?${params.toString()}`);
  };

  const grant = verifyCustomerConsentGrant(
    typeof query.sparx_grant === 'string' ? query.sparx_grant : null,
    ctx.context.secret
  );
  if (!grant) return toConsent();

  // The grant must bind the EXACT client, redirect, and scope in this request — a
  // signed approval can't be replayed onto a different one.
  if (
    grant.clientId !== query.client_id ||
    grant.redirectUri !== query.redirect_uri ||
    grant.scope !== query.scope
  ) {
    return toConsent();
  }

  // …and it must belong to the shopper who is actually signed in now (their
  // session cookie, resolved under RLS via the ambient tenantStore).
  const session = await getSessionFromCtx(ctx);
  if (session?.user.id !== grant.userId) return toConsent();

  // Valid, bound, and session-matched — let Better Auth mint the code.
});

/** The shopper MCP OAuth authorization server (docs/113 customer tier). Hardened
 *  per OAuth 2.1: PKCE-S256 only, short TTLs, our shopper scope vocabulary. The
 *  handler mount + first-party consent guard + per-store login-page redirect +
 *  resource-server advertisement are wired in the storefront-MCP customer-tier
 *  slice (docs/27 §6); this registration makes the instance + its tenant-scoped
 *  oauth tables OAuth-ready. Extracted so createCustomerAuth stays cohesive. */
function customerMcpPlugin() {
  const loginPage = process.env.CUSTOMER_MCP_LOGIN_PAGE ?? '/account/login';
  return mcp({
    loginPage,
    resource: process.env.STOREFRONT_MCP_PUBLIC_ORIGIN ?? 'http://localhost:3200',
    oidcConfig: {
      loginPage,
      requirePKCE: true,
      allowPlainCodeChallengeMethod: false,
      accessTokenExpiresIn: 60 * 60, // 1h
      refreshTokenExpiresIn: 60 * 60 * 24 * 30, // 30d
      codeExpiresIn: 5 * 60, // 5m
      scopes: [...CUSTOMER_MCP_SCOPES],
      metadata: { scopes_supported: [...CUSTOMER_MCP_SCOPES] },
    },
  });
}

// Session config, extracted so createCustomerAuth stays cohesive. cookieCache is
// DELIBERATELY OFF (docs/27 §3): it stores the session in a secret-signed cookie
// and returns it WITHOUT a DB read — bypassing the RLS tenant scoping. Because the
// same person can hold a session at multiple tenants, a cached cookie presented
// under another tenant's context would resolve to the wrong tenant's user (a
// cross-tenant leak — caught by the smoke test). Every getSession must hit
// customer_sessions under withTenant so RLS enforces isolation (a single indexed
// query). `tenantId` is surfaced as an additionalField (populated by the DB
// default under withTenant) so getCustomerSession can assert it matches the
// request tenant — an app-layer check INDEPENDENT of RLS. input:false so it is
// never client-settable; no defaultValue so BA omits it on insert.
const CUSTOMER_SESSION_CONFIG = {
  modelName: 'customerSession',
  expiresIn: 60 * 60 * 24 * 30, // 30 days
  updateAge: 60 * 60 * 24, // slide daily
  cookieCache: { enabled: false },
  additionalFields: {
    tenantId: { type: 'string', input: false, required: false },
  },
} as const;

function createCustomerAuth() {
  return betterAuth({
    appName: 'sparx-customer',
    // Mounted by api-rest at /v1/public/auth/* (docs/27 §6). baseURL is the
    // api-rest origin; the storefront reaches it through its /api/sparx proxy.
    baseURL: process.env.CUSTOMER_AUTH_URL ?? 'http://localhost:3100',
    basePath: '/v1/public/auth',
    secret: customerAuthSecret(),
    database: prismaAdapter(tenantScopedClient, { provider: 'postgresql' }),

    // Core model → tenant-scoped Prisma model key (the supported remap; the
    // plugin OAuth keys are remapped in tenant-adapter.ts instead).
    user: { modelName: 'customerUser' },
    account: { modelName: 'customerAccount' },
    verification: { modelName: 'customerVerification' },
    session: CUSTOMER_SESSION_CONFIG,

    emailAndPassword: {
      enabled: true,
      requireEmailVerification: false, // 5-minute-store goal (docs/27 §9)
      minPasswordLength: 8,
      autoSignIn: true,
      // Argon2id, identical params to Layer 1 — so the backfilled hashes verify
      // directly (docs/27 §4.2). Never store or log plaintext.
      password: {
        hash: (password) => hashPassword(password),
        verify: ({ hash, password }) => verifyPassword(hash, password),
      },
      // Publish `email.send` (never a direct send) — same path as staff auth.
      // BA's own `url` points at api-rest's baseURL; we build the STORE url so the
      // link lands on the shopper's actual storefront (never a client-supplied
      // origin — a token-phishing vector). Tenant comes from the ambient store.
      sendResetPassword: async ({ user, token }) => {
        const base = await resolveStoreBaseUrl();
        const resetUrl = `${base}/account/reset?token=${encodeURIComponent(token)}`;
        await publishCustomerAuthEmail({
          template: 'password-reset',
          to: user.email,
          props: { resetUrl, expiresInMinutes: RESET_EXPIRES_MINUTES },
        });
      },
    },

    advanced: {
      // DB generates ids (gen_random_uuid()), mirroring the staff instance.
      database: { generateId: false },
      // First-party cookie name expected by the storefront + the /account routes.
      cookies: { session_token: { name: SESSION_COOKIE_NAME } },
    },

    // Throttle the public MCP OAuth surface (mirrors staff, docs/07 §5). DCR is
    // unauthenticated so registration is capped hard.
    rateLimit: {
      customRules: {
        '/mcp/register': { window: 60, max: 5 },
        '/mcp/authorize': { window: 60, max: 30 },
        '/mcp/token': { window: 60, max: 60 },
      },
    },

    // Guard /mcp/authorize (docs/113 §5). See customerMcpAuthorizeGuard: bounce
    // any authorize without a valid, session-bound consent grant to the store's
    // own /account/authorize consent page.
    hooks: {
      before: customerMcpAuthorizeGuard,
    },

    plugins: [customerMcpPlugin()],
  });
}

// Lazy + cached, mirroring @sparx/auth: importing the barrel for a helper must
// not construct the instance (which throws when CUSTOMER_AUTH_SECRET is unset).
let cached: ReturnType<typeof createCustomerAuth> | undefined = globalThis.__sparxCustomerAuth;

export function getCustomerAuth(): ReturnType<typeof createCustomerAuth> {
  if (cached) return cached;
  cached = createCustomerAuth();
  if (process.env.NODE_ENV !== 'production') globalThis.__sparxCustomerAuth = cached;
  return cached;
}

export type CustomerAuth = ReturnType<typeof createCustomerAuth>;
